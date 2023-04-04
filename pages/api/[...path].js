const { ethers } = require("ethers");
const { Pool: PgPool } = require("pg");

const config = {
  dbUrl: process.env.DATABASE_URL || "postgres://admin:admin@localhost/rodeo",
  rpc: process.env.RODEO_RPC_URL || "http://localhost:8545",
  investor:
    process.env.INVESTOR_ADDRESS ||
    "0x8a791620dd6260079bf849dc5567adc3f2fdc318",
  investorHelper:
    process.env.INVESTOR_HELPER_ADDRESS ||
    "0x959922be3caee4b8cd9a407cc3ac1c251c2007b1",
  strategyHelper:
    process.env.STRATEGY_HELPER_ADDRESS ||
    "0x68b1d87f95878fe05b998f19b66f4baba5de1aed",
};

const parseUnits = ethers.utils.parseUnits;
const ONE = parseUnits("1", 18);
const provider = new ethers.providers.StaticJsonRpcProvider(config.rpc);
const routes = [];
const pgPool = new PgPool({ connectionString: config.dbUrl, max: 10 });

// ROUTES /////////////////////////////////////////////////////////////////////

let poolsData = null;
let poolsTimestamp = 0;

route(
  "/apy/defillama",
  cached(async (req) => {
    if (poolsTimestamp < Date.now() - 5 * 60 * 60 * 1000) {
      poolsData = await (await fetch(`https://yields.llama.fi/pools`)).json();
      poolsTimestamp = Date.now();
    }
    if (!poolsData.data) return { apy: 0, tvl: 0 };
    const data = poolsData.data.find((p) => p.pool == req.query.id);
    return { apy: data.apy, tvl: data.tvlUsd };
  })
);

route(
  "/apy/uniswapv3",
  cached(async (req, res) => {
    const a = req.query.id;
    const p = await call(a, "pool--address");
    const minTick = await call(a, "minTick--int24");
    const maxTick = await call(a, "maxTick--int24");
    const token0 = await call(p, "token0--address");
    const token1 = await call(p, "token1--address");
    const oracle0 = await call(
      config.strategyHelper,
      "oracles-address-address",
      token0
    );
    const oracle1 = await call(
      config.strategyHelper,
      "oracles-address-address",
      token1
    );
    const pid = ethers.utils.solidityKeccak256(
      ["address", "int24", "int24"],
      [a, minTick, maxTick]
    );
    const posLiquidity = (
      await call(
        p,
        "positions-bytes32-uint128,uint256,uint256,uint128,uint128",
        pid
      )
    )[0];

    const query = `{
      poolDayDatas(where:{pool:"${p.toLowerCase()}"} first: 7 orderBy: date orderDirection: desc) { feesUSD }
      pool(id: "${p.toLowerCase()}") { liquidity }
    }`;
    const feeData = await (
      await fetch(
        "https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-dev",
        {
          method: "post",
          body: JSON.stringify({ query }),
        }
      )
    ).json();

    const totalShares = await call(a, "totalShares--uint256");
    const posUsd = (await call(a, "rate-uint256-uint256", totalShares))
      .div(ONE)
      .toNumber();
    const feeArr = feeData.data.poolDayDatas;
    const averageDailyFee =
      feeArr.map((i) => Number(i.feesUSD)).reduce((a, b) => a + b) /
      feeArr.length;
    let apr = 0;
    if (posUsd > 0) {
      apr =
        (averageDailyFee *
          365 *
          (parseInt(posLiquidity.toString()) /
            Number(feeData.data.pool.liquidity))) /
        posUsd;
    }
    const apy = ((1 + apr / 365) ** 365 - 1) * 100;

    const token0Decimals = await call(token0, "decimals--uint8");
    const token1Decimals = await call(token1, "decimals--uint8");
    const oracle0Decimals = await call(oracle0, "decimals--uint8");
    const oracle1Decimals = await call(oracle1, "decimals--uint8");
    const balance0 = await call(token0, "balanceOf-address-uint128", p);
    const balance1 = await call(token1, "balanceOf-address-uint128", p);
    const price0 = await call(oracle0, "latestAnswer--int256");
    const price1 = await call(oracle1, "latestAnswer--int256");
    const tvlToken0 = balance0
      .mul(price0)
      .div(parseUnits("1", oracle0Decimals))
      .div(parseUnits("1", token0Decimals));
    const tvlToken1 = balance1
      .mul(price1)
      .div(parseUnits("1", oracle1Decimals))
      .div(parseUnits("1", token1Decimals));
    const tvl = tvlToken0.add(tvlToken1).toNumber();
    return { apy, tvl };
  })
);

route(
  "/apy/plutus",
  cached(async (req) => {
    const plsGlpVault = "0x5326E71Ff593Ecc2CF7AcaE5Fe57582D6e74CFF1";
    const tvl = await call(plsGlpVault, "totalAssets--uint256");
    const rate = await call(
      plsGlpVault,
      "convertToAssets-uint256-uint256",
      parseUnits("1", 18)
    );
    const start = new Date(2022, 7, 26);
    const elapsed = Date.now() - start.getTime();
    const year = 365 * 24 * 60 * 60 * 1000;
    const apy =
      (rate.sub(ONE).mul(10000).div(ONE).toNumber() * year) / elapsed / 100;
    return { apy: apy, tvl: (0.94 * tvl.mul(100).div(ONE).toNumber()) / 100 };
  })
);

route(
  "/apy/traderjoe",
  cached(async (req) => {
    const day = 24 * 60 * 60 * 1000;
    const ts = (Math.round((Date.now() - day) / day) * day) / 1000;
    const query = `{
      lbpairDayData(id: "${req.query.id}-${ts}") {
        id
        feesUSD
        totalValueLockedUSD
      }
    }`;
    const res = await fetch(
      "https://api.thegraph.com/subgraphs/name/traderjoe-xyz/joe-v2-arbitrum",
      {
        method: "post",
        body: JSON.stringify({ query }),
      }
    );
    const data = (await res.json()).data.lbpairDayData;
    const tvl = parseFloat(data.totalValueLockedUSD);
    const apr = (parseFloat(data.feesUSD) * 365) / tvl;
    const apy = ((1 + apr / 365) ** 365 - 1) * 100;
    return { apy: apy, tvl };
  })
);

route(
  "/apy/vela",
  cached(async (req) => {
    const usdc = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
    const vault = "0x5957582F020301a2f732ad17a69aB2D8B2741241";
    const res = await fetch(
      "https://vela-public-server-prod-qxq2l.ondigitalocean.app/market/vlp-apr/42161"
    );
    const apr = (await res.json()).VLP_APR;
    const tvl = (await call(usdc, "balanceOf-address-uint256", vault))
      .div(parseUnits("1", 6))
      .toNumber();
    return { apy: aprToApy(apr / 100) * 100, tvl: tvl };
  })
);

route("/tvl", async (req, res) => {
  return (
    await sql(
      `select coalesce(sum(shares_value), 0)/1e18 as tvl from positions where chain = 42161`
    )
  )[0].tvl;
});

route("/pools/history", (req, res) => {
  let { q, interval } = sqlWindowedQuery(req.query);
  q += ` select
    t.t, coalesce(avg("index")::numeric(32), 0) as "index", coalesce(avg(share)::numeric(32), 0) as share, coalesce(avg(supply)::numeric(32), 0) as supply, coalesce(avg(borrow)::numeric(32), 0) as borrow, coalesce(avg(rate)::numeric(32), 0) as rate, coalesce(avg(price)::numeric(32), 0) as price
    from t
    left join pools_history on t.t = date_trunc('${interval}', time)
      and chain = $1 and lower(address) = lower($2)
    group by 1 order by 1`;
  return sql(q, req.query.chain, req.query.address);
});

route("/apys/history", (req, res) => {
  let { q, interval } = sqlWindowedQuery(req.query);
  q += ` select
    t.t, coalesce(avg(apy)::numeric(32, 16), 0) as apy, coalesce(avg(tvl)::numeric(32, 16), 0) as tvl
    from t
    left join apys_history on t.t = date_trunc('${interval}', time)
      and chain = $1 and lower(address) = lower($2)
    group by 1 order by 1`;
  return sql(q, req.query.chain, req.query.address);
});

route("/positions", (req, res) => {
  return sql(
    `select * from positions where chain = $1 and "index" = $2`,
    req.query.chain,
    req.query.index
  );
});

route("/positions/all", (req, res) => {
  return sql(`select * from positions order by chain, "index" desc`);
});

route("/positions/history", (req, res) => {
  let { q, interval } = sqlWindowedQuery(req.query);
  q += ` select
      t.t, coalesce(avg(shares)::numeric(32), 0) as shares, coalesce(avg(borrow)::numeric(32), 0) as borrow, coalesce(avg(shares_value)::numeric(32), 0) as shares_value, coalesce(avg(borrow_value)::numeric(32), 0) as borrow_value, coalesce(avg(life)::numeric(32), 0) as life, coalesce(avg(amount)::numeric(32), 0) as amount, coalesce(avg(price)::numeric(32), 0) as price
    from t
    left join positions_history on t.t = date_trunc('${interval}', time)
      and chain = $1 and "index" = $2
    group by 1 order by 1`;
  return sql(q, req.query.chain, req.query.index);
});

route("/positions/events", (req, res) => {
  const q = `select time, block, name, data from positions_events
    where chain = $1 and "index" = $2 order by time`;
  return sql(q, req.query.chain, req.query.index);
});

route("/liquidations", (req, res) => {
  return sql(`select time, p.chain, p."index", data, p.pool, p.strategy, p.created
    from positions_events
    left join positions p on p."index" = positions_events."index"
    where name = 'Kill' and time > now() - interval '7 days'
    order by time desc`);
});

// UTILS //////////////////////////////////////////////////////////////////////

function aprToApy(rate) {
  return Math.pow(rate / 365 + 1, 365) - 1;
}

function route(path, handler) {
  routes.push([path, handler]);
}

function cached(fn) {
  const cacheTime = {};
  const cacheValue = {};
  return async function (req, res) {
    const key = JSON.stringify(req.query);
    if (cacheTime[key] && Date.now() - cacheTime[key] < 5 * 60 * 1000) {
      return cacheValue[key];
    }
    const result = await fn(req, res);
    cacheTime[key] = Date.now();
    cacheValue[key] = result;
    return result;
  };
}

function call(address, fn, ...args) {
  console.log("call", address, fn, args);
  let [name, params, returns] = fn.split("-");
  const rname = name[0] === "-" ? name.slice(1) : name;
  let efn = `function ${rname}(${params}) external`;
  if (name[0] !== "-") efn += " view";
  if (returns) efn += ` returns (${returns})`;
  const contract = new ethers.Contract(address, [efn], provider);
  return contract[rname](...args);
}

async function sql(sql, ...values) {
  const res = await pgPool.query(sql, values);
  return res.rows;
}

function sqlWindowedQuery(params) {
  const intervals = { hour: "hour", day: "day", week: "week" };
  const interval = intervals[params.interval] || "hour";
  const length = parseInt(params.length || 100) - 2;
  const q = `with t as (select generate_series(
    date_trunc('${interval}', now()) - '${length} ${interval}'::interval,
    date_trunc('${interval}', now()) + '1 ${interval}'::interval,
    '1 ${interval}'::interval
  ) as t)`;
  return { q, interval };
}

export default async function handler(req, res) {
  const path = "/" + req.query.path.join("/");
  for (let route of routes) {
    if (route[0] !== path) continue;
    try {
      const data = await route[1](req, res);
      if (data) res.status(200).json(data);
    } catch (e) {
      console.error("error", e);
      res.status(500).json({ error: e.message });
    }
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "not found" }, null, 2));
}
