const { ethers } = require("ethers");
const { Pool: PgPool } = require("pg");

const config = {
  dbUrl: process.env.DATABASE_URL || "postgres://admin:admin@localhost/rodeo",
  chain: parseInt(process.env.RODEO_CHAIN || "1337"),
  rpc: process.env.RODEO_RPC_URL || "http://127.0.0.1:8545",
  api: process.env.RODEO_API_URL || "http://localhost:3000",
  privateKey:
    process.env.RODEO_PRIVATE_KEY ||
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  investor:
    process.env.INVESTOR_ADDRESS ||
    "0x8a791620dd6260079bf849dc5567adc3f2fdc318",
  investorHelper:
    process.env.INVESTOR_HELPER_ADDRESS ||
    "0x959922be3caee4b8cd9a407cc3ac1c251c2007b1",
};

const parseUnits = ethers.utils.parseUnits;
const ONE = parseUnits("1", 18);
const provider = new ethers.providers.StaticJsonRpcProvider(
  config.rpc,
  config.chain
);
const signer = new ethers.Wallet(config.privateKey).connect(provider);
const pgPool = new PgPool({ connectionString: config.dbUrl, max: 10 });
const tasks = {};
const tasksSchedule = {};
const pools = {
  1337: [
    "0xa513e6e4b8f2a923d98304ec87f64353c4d5c853",
    "0x2279b7a0a67db372996a5fab50d91eaa73d2ebe6",
  ],
  42161: ["0x0032F5E1520a66C6E572e96A11fBF54aea26f9bE"],
};
const strategies = {
  1337: [
    {
      address: "0x59b670e9fa9d0a427751af201d676719a970857b",
      apy: { type: "defillama", id: "825688c0-c694-4a6b-8497-177e425b7348" },
    },
  ],
  42161: [
    {
      address: "0x6A77FEC52D8575AC70F5196F833bd4A6c86c81AE",
      apy: { type: "defillama", id: "dde58f35-2d08-4789-a641-1225b72c3147" },
    }, // JonesDAO jUSDC
    {
      address: "0x81E37797D44d348E664247298Faa6A90Db90C1B9",
      apy: { type: "plutus", id: "plvglp" },
    }, // PlutusDAO plvGLP
    {
      address: "0x70116D50c89FC060203d1fA50374CF1B816Bd0f5",
      apy: { type: "defillama", id: "825688c0-c694-4a6b-8497-177e425b7348" },
    }, // GMXGLP
    {
      address: "0xCE0488a9FfD70156d8914C02D95fA320DbBE93Ab",
      apy: {
        type: "traderjoe",
        id: "0x7ec3717f70894f6d9ba0be00774610394ce006ee",
      },
    }, // TraderJoe ETH/USDC
    {
      address: "0xbA8A58Fd6fbc9fAcB8BCf349C94B87717a4BC00f",
      apy: {
        type: "traderjoe",
        id: "0xa51ee8b744e6cc1f2ac12b9eeaae8deb27619c6b",
      },
    }, // TraderJoe MAGIC/ETH
    {
      address: "0x9FA6CaCcE3f868E56Bdab9be85b0a90e2568104d",
      apy: { type: "defillama", id: "78b92cfe-6d41-46d5-af95-ed1005a1840b" },
    }, // Balancer stETH/ETH
    {
      address: "0x390358DEf53f2316671ed3B13D4F4731618Ff6A3",
      apy: { type: "defillama", id: "872bc9c7-5c79-479b-a654-e72b74e4c810" },
    }, // Balancer WBTC/ETH/USDC
    {
      address: "0x6d98F80D9Cfb549264B4B7deD12426eb6Ea47800",
      apy: { type: "defillama", id: "429bbfd9-1496-4871-9406-b64f3d05f38d" },
    }, // Curve WBTC/ETH/USDT
    {
      address: "0xcF03B33851F088d58E921d8aB5D60Dc1c3238758",
      apy: { type: "defillama", id: "5f1e249f-1ac4-48a3-8cba-f13be346cd99" },
    }, // KyberSwap wstETH/ETH
    {
      address: "0x05CBD8C4F171247aa8F4dE87b3d9e09883beD511",
      apy: { type: "defillama", id: "78609c6a-5e49-4a9f-9b34-90f0a1e5f7fd" },
    }, // SS ETH/USDC
    {
      address: "0xFE280C65c328524132205cDd360781484D981e42",
      apy: { type: "defillama", id: "abe3c385-bde7-4350-9f35-2f574ad592d6" },
    }, // SS ETH/USDT
    {
      address: "0xd170cFfd7501bEc329B0c90427f06C9156845Be4",
      apy: {
        type: "uniswapv3",
        id: "0xd170cFfd7501bEc329B0c90427f06C9156845Be4",
      },
    }, // ETH/USDC 0.05 L
  ],
};
const oracles = [
  "0x90DAc5C0073D9406aB25F2eDB0d91a8514e871Ad", // PLS
  "0xb7ad108628b8876f68349d4f150f33e97f5dae03", // MAGIC
];
const defaultBlock = {
  1337: 1,
  42161: 45874600,
};

// TASKS //////////////////////////////////////////////////////////////////////

task("pools", 60, async () => {
  const data = await call(
    config.investorHelper,
    "peekPools-address[]-uint256[],uint256[],uint256[],uint256[],uint256[],uint256[]",
    pools[config.chain]
  );

  for (let i = 0; i < pools[config.chain].length; i++) {
    await sqlInsert("pools_history", {
      chain: config.chain,
      address: pools[config.chain][i],
      time: new Date(),
      index: data[0][i].toString(),
      share: data[1][i].toString(),
      supply: data[2][i].toString(),
      borrow: data[3][i].toString(),
      rate: data[4][i].toString(),
      price: data[5][i].toString(),
    });
  }
});

task("apys", 60, async () => {
  for (let s of strategies[config.chain]) {
    const res = await fetch(
      `${config.api}/api/apy/${s.apy.type}?id=${s.apy.id}`
    );
    if (!res.ok) {
      console.error("worker: apys: error fetching:", await res.text());
      continue;
    }
    const data = await res.json();

    await sqlInsert("apys_history", {
      chain: config.chain,
      address: s.address,
      time: new Date(),
      apy: data.apy,
      tvl: data.tvl,
    });
  }
});

task("positions", 60, async () => {
  const positions = await sql(
    `select id, "index", shares from positions order by "index"`
  );
  const lastIndexChain = (
    await call(config.investor, "nextPosition--uint256")
  ).toNumber();

  for (let i = 0; i < lastIndexChain; i++) {
    const p = positions.find((p) => parseInt(p.index) === i);
    if (p && p.shares === 0) continue;

    const data = await call(
      config.investorHelper,
      "peekPosition-uint256-address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256",
      i
    );

    const row = {
      shares: data[2].toString(),
      borrow: data[3].toString(),
      shares_value: data[4].toString(),
      borrow_value: data[5].toString(),
      life: data[6].toString(),
      amount: data[7].toString(),
      price: data[8].toString(),
    };

    if (p) {
      await sqlUpdate(
        "positions",
        Object.assign({ id: p.id, updated: new Date() }, row)
      );
    } else {
      await sqlInsert(
        "positions",
        Object.assign(
          {
            chain: config.chain,
            index: i,
            pool: data[0],
            strategy: data[1].toString(),
            created: new Date(),
            updated: new Date(),
          },
          row
        )
      );
    }

    await sqlInsert(
      "positions_history",
      Object.assign({ chain: config.chain, index: i }, row)
    );
  }
});

task("events", 15, async () => {
  const investorContract = new ethers.Contract(
    config.investor,
    [
      "event Edit(uint256 indexed id, int256 amount, int256 borrow, int256 shares, int256 borrowed)",
      "event Kill(uint256 indexed id, address indexed keeper, uint256 amount, uint256 borrow, uint256 fee)",
    ],
    provider
  );

  const batchSize = 1000000;
  const latestBlock = await provider.getBlockNumber();
  const lastEvent = (
    await sql(`select block from positions_events order by time desc`)
  )[0];
  let currentBlock = lastEvent
    ? parseInt(lastEvent.block) + 1
    : defaultBlock[config.chain];

  while (currentBlock < latestBlock) {
    const logs = await provider.getLogs({
      address: config.investor,
      topics: [
        [
          investorContract.filters.Edit().topics[0],
          investorContract.filters.Kill().topics[0],
        ],
      ],
      fromBlock: currentBlock,
      toBlock: currentBlock + batchSize,
    });
    const parsedLogs = logs.map((l) => investorContract.interface.parseLog(l));

    for (let i in parsedLogs) {
      const l = parsedLogs[i];
      const values = {};
      for (let k of Object.keys(l.args)) {
        if (!Number.isNaN(parseInt(k))) continue;
        values[k] = l.args[k].toString();
      }
      await sqlInsert("positions_events", {
        chain: config.chain,
        index: values.id,
        block: logs[i].blockNumber,
        name: l.name,
        data: values,
      });
    }

    currentBlock += batchSize;
  }
});

task("strategies", 8 * 60, async () => {
  for (let s of strategies[config.chain]) {
    console.log("earning", s.address);
    try {
      await call(s.address, "+earn--");
    } catch (e) {
      console.log("error earn", e);
    }
  }
});

task("liquidations", 5, async () => {
  const positions = await sql(
    `select id, "index", shares from positions where chain = $1 order by "index"`,
    config.chain
  );
  const lastIndexChain = (
    await call(config.investor, "nextPosition--uint256")
  ).toNumber();

  const batchSize = 100;
  const indexes = [];
  for (let i = 0; i < lastIndexChain; i++) {
    const p = positions.find((p) => p.index === i);
    if (p && p.shares === 0) continue;
    indexes.push(i);
  }
  //console.log("liquidations indexes", indexes);

  const indexesToKill = [];
  for (let i = 0; i < indexes.length; i += batchSize) {
    const batch = indexes.slice(i, i + batchSize);
    const data = await call(
      config.investorHelper,
      "lifeBatched-uint256[]-uint256[]",
      batch
    );
    for (let j in data) {
      if (data[j].eq(0) || data[j].gte(ONE)) continue;
      indexesToKill.push(indexes[i + parseInt(j)]);
    }
  }
  //console.log("liquidations indexesToKill", indexesToKill);

  const killBatchSize = 5;
  const signerAddress = await signer.getAddress();
  for (let i = 0; i < indexesToKill.length; i += killBatchSize) {
    const batch = indexesToKill.slice(i, i + killBatchSize);
    const batchData = batch.map(() => "0x");
    console.log("liquidating", batch);
    const tx = await call(
      config.investorHelper,
      "+killBatched-uint256[],bytes[],address-",
      batch,
      batchData,
      signerAddress,
      { gasLimit: 10000000 }
    );
    console.log("batch hash", tx.hash);
  }
});

task("oracles", 5, async () => {
  for (let o of oracles) {
    const ts = await call(o, "lastTimestamp--");
    if (Date.now() / 1000 > ts + 1800) {
      try {
        console.log("oracle", o);
        await call(o, "+update--");
      } catch (e) {
        console.log("error oracle", o, e.error.data.message, e.error.data.data);
      }
    }
  }
});

// UTILS //////////////////////////////////////////////////////////////////////

let newIdSeq = 0n;

function newId() {
  newIdSeq++;
  let id = BigInt(Date.now() - 1262304000000);
  id <<= 12n;
  id |= newIdSeq % 4096n;
  return id.toString(10);
}

function task(name, every, fn) {
  tasks[name] = fn;
  if (every) tasksSchedule[name] = every;
}

function call(address, fn, ...args) {
  //console.log("call", address, fn, args);
  let [name, params, returns] = fn.split("-");
  const rname = name[0] === "+" ? name.slice(1) : name;
  let efn = `function ${rname}(${params}) external`;
  if (name[0] !== "+") efn += " view";
  if (returns) efn += ` returns (${returns})`;
  const contract = new ethers.Contract(address, [efn], signer);
  return contract[rname](...args);
}

async function sql(sql, ...values) {
  //console.log("sql", sql, values);
  const res = await pgPool.query(sql, values);
  return res.rows;
}

async function sqlInsert(table, row) {
  //console.log("sqlInsert", table, row);
  row.id = newId();
  const cols = Object.keys(row);
  const args = cols.map((_, i) => `$${i + 1}`);
  const vals = cols.map((k) => row[k]);
  await pgPool.query(
    `insert into ${table} (${cols
      .map((c) => `"${c}"`)
      .join(",")}) values (${args.join(",")})`,
    vals
  );
}

async function sqlUpdate(table, row) {
  //console.log("sqlUpdate", table, row);
  const cols = Object.keys(row);
  const args = cols.map((k, i) => `"${k}" = $${i + 1}`);
  const vals = cols.map((k) => row[k]);
  const i = cols.findIndex((c) => c === "id") + 1;
  await pgPool.query(
    `update ${table} set ${args.join(",")} where id = $${i}`,
    vals
  );
}

// RUN ////////////////////////////////////////////////////////////////////////

async function run() {
  const schedules = await sql(`select id, time from tasks_schedules`);
  for (let t of Object.keys(tasksSchedule)) {
    const s = schedules.find((s) => s.id === t);
    const interval = tasksSchedule[t] * 60 * 1000;
    const next = Math.ceil((s ? s.time.getTime() : 0) / interval) * interval;
    if (new Date().getTime() >= next) {
      console.log(new Date().toISOString(), "running " + t);
      const q = `insert into tasks_schedules (id, time) values ($1, $2) on conflict (id) do update set time = $2`;
      await sql(q, t, new Date());
      let error = "";
      try {
        await tasks[t]({});
      } catch (e) {
        error = e.message;
        console.log("error", e);
      }
      await sql(
        `insert into tasks (id, task, error) values ($1, $2, $3)`,
        newId(),
        t,
        error
      );
    } else {
      console.log(
        new Date().toISOString(),
        "skipping " + t,
        new Date(next).toISOString()
      );
    }
  }

  console.log("All done!");
  process.exit(0);
}

run();
