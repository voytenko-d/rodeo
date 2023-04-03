import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { ethers } from "ethers";
import {
  assets,
  bnMin,
  checkWhitelist,
  formatChartDate,
  formatError,
  formatNumber,
  formatUnits,
  ONE,
  parseUnits,
  pools,
  runTransaction,
  useWeb3,
  YEAR,
} from "../../utils";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import Layout from "../../components/layout";

export default function LendPool() {
  const router = useRouter();
  const { provider, address, networkName, contracts, chainId } = useWeb3();
  const pool = (pools[networkName] || []).find(
    (p) => p.slug == router.query.pool
  );
  const asset = (assets[networkName] || {})[pool?.asset] || { symbol: "?" };
  const [data, setData] = useState({
    index: parseUnits("0"),
    share: parseUnits("0"),
    supply: parseUnits("0"),
    borrow: parseUnits("0"),
    rate: parseUnits("0"),
    price: parseUnits("0"),
    utilization: parseUnits("0"),
    apr: parseUnits("0"),
    value: parseUnits("0"),
    balance: parseUnits("0"),
    assetBalance: parseUnits("0"),
    tvl: parseUnits("0"),
  });
  const [tab, setTab] = useState("deposit");
  const [historicTab, setHistoricTab] = useState("apr");
  const [histories, setHistories] = useState([]);
  const [chartInterval, setChartInterval] = useState("short");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const chartTitleRef = useRef();
  const chartDateRef = useRef();
  let chartTitle = "";

  const chartData = useMemo(() => calcChartData(), [historicTab, histories]);

  const chartDate =
    chartData.length > 0
      ? formatChartDate(chartData[chartData.length - 1].date)
      : null;

  if (historicTab == "apr") {
    chartTitle = `${formatNumber(data.apr, 16)}%`;
  }

  if (historicTab == "tvl") {
    chartTitle = `$${parseFloat(ethers.utils.formatUnits(data.tvl, 18)).toFixed(
      2
    )}`;
  }

  function cMouseMove(data) {
    if (!data || !data.activePayload) {
      return;
    }

    chartDateRef.current.innerText = formatChartDate(
      data.activePayload[0].payload.date
    );

    if (historicTab == "apr") {
      chartTitleRef.current.innerText = `${formatNumber(
        data.activePayload[0].payload.apr
      )}%`;
    }

    if (historicTab == "tvl") {
      chartTitleRef.current.innerText = `$${formatNumber(
        data.activePayload[0].payload.tvl
      )}`;
    }
  }

  function cMouseOut() {
    chartTitleRef.current.innerText = chartTitle;
    chartDateRef.current.innerText = chartDate;
  }

  function onHistoricTab(newTab) {
    setHistoricTab(newTab);
    setChartInterval("short");
  }

  async function fetchData() {
    if (!pool || !contracts) return;
    const poolContract = contracts.asset(pool.address);
    const assetContract = contracts.asset(pool.asset);
    const values = await contracts.investorHelper.peekPools([pool.address]);
    const data = {
      index: values[0][0],
      share: values[1][0],
      supply: values[2][0],
      borrow: values[3][0],
      rate: values[4][0],
      price: values[5][0],
      utilization: parseUnits("0"),
      value: parseUnits("0"),
      balance: await poolContract.balanceOf(address),
      assetBalance: await assetContract.balanceOf(address),
      assetAllowance: await assetContract.allowance(address, pool.address),
    };
    if (data.supply.gt(0)) {
      data.utilization = data.borrow.mul(parseUnits("1")).div(data.supply);
    }
    data.assetAllowanceOk = data.assetAllowance.gt(parseUnits("1", 30));
    try {
      const parsedAmount = parseUnits(amount, asset.decimals);
      data.assetAllowanceOk = data.assetAllowance.gte(parsedAmount);
    } catch (e) {}

    if (data.share.gt(0)) {
      data.value = data.balance.mul(data.supply).div(data.share);
    }
    data.apr = data.rate.mul(YEAR).mul(data.utilization).div(parseUnits("1"));
    const priceAdjusted = data.price
      .mul(ONE)
      .div(parseUnits("1", asset.decimals));
    data.tvl = data.supply.mul(priceAdjusted).div(ONE);
    setData(data);
    await fetchHistories();
  }

  async function fetchHistories() {
    if (!pool) return;
    const intervalParams =
      chartInterval == "short"
        ? "interval=day&length=90"
        : "interval=week&length=104";
    const res = await fetch(
      `/api/pools/history?chain=${chainId}&address=${pool.address.toLowerCase()}&${intervalParams}`
    );
    if (!res.ok) return;
    setHistories(await res.json());
  }

  function calcChartData() {
    if (historicTab == "apr") {
      return histories.map((h) => {
        const utilization = parseUnits(h.supply, 0).gt(0)
          ? parseUnits(h.borrow, 0)
              .mul(parseUnits("1"))
              .div(parseUnits(h.supply, 0))
          : 0;
        const apr = parseUnits(h.rate, 0)
          .mul(YEAR)
          .mul(utilization)
          .div(parseUnits("1"));

        return {
          date: new Date(h.t),
          apr: parseFloat(ethers.utils.formatUnits(apr, 16)),
        };
      });
    }

    if (historicTab == "tvl") {
      return histories.map((h) => {
        const priceAdjusted = parseUnits(h.price, 0)
          .mul(ONE)
          .div(parseUnits("1", asset.decimals));
        const tvl = parseUnits(h.supply, 0).mul(priceAdjusted).div(ONE);

        return {
          date: new Date(h.t),
          tvl: parseFloat(ethers.utils.formatUnits(tvl, 18)),
        };
      });
    }
  }

  useEffect(() => {
    fetchData().then(
      () => {},
      (e) => console.error("fetch", e)
    );
  }, [pool, networkName, address]);

  useEffect(() => {
    fetchHistories().then(
      () => {},
      (e) => console.error("fetch", e)
    );
  }, [chartInterval]);

  function onWithdrawMax() {
    setAmount(
      formatUnits(
        bnMin(data.value, data.supply.sub(data.borrow)),
        asset.decimals
      )
    );
  }

  function onDepositMax() {
    setAmount(formatUnits(data.assetBalance, asset.decimals));
  }

  async function onApprove() {
    setError("");
    try {
      await checkWhitelist(provider, address);
      setLoading(true);
      const assetContract = contracts.asset(pool.asset);
      const call = assetContract.approve(
        pool.address,
        ethers.constants.MaxUint256
      );
      await runTransaction(
        call,
        "Transaction is pending approval...",
        "Approval completed.",
        false,
        networkName
      );
      fetchData();
    } catch (e) {
      console.error(e);
      setError(formatError(e.message));
    } finally {
      setLoading(false);
    }
  }

  async function onDeposit() {
    setError("");
    let parsedAmount;
    try {
      parsedAmount = parseUnits(amount, asset.decimals);
    } catch (e) {
      setError("Invalid amount");
      return;
    }
    try {
      // TODO remove after alpha
      await checkWhitelist(provider, address);

      setLoading(true);
      const poolContract = contracts.pool(pool.address);
      const call = poolContract.mint(parsedAmount, address);
      await runTransaction(
        call,
        "Deposit is awaiting confirmation on chain...",
        "Deposit completed.",
        true,
        networkName
      );
      setAmount("");
      fetchData();
    } catch (e) {
      console.error(e);
      setError(formatError(e.message));
    } finally {
      setLoading(false);
    }
  }

  async function onWithdraw() {
    setError("");
    let parsedAmount;
    let withdrawShares;
    try {
      parsedAmount = parseUnits(amount, asset.decimals);
      withdrawShares = parsedAmount.mul(data.share).div(data.supply);
      if (parsedAmount.eq(data.value)) {
        withdrawShares = data.balance;
      }
    } catch (e) {
      console.error(e);
      setError("Invalid amount");
      return;
    }
    try {
      setLoading(true);
      const poolContract = contracts.pool(pool.address);
      const call = poolContract.burn(withdrawShares, address);
      await runTransaction(
        call,
        "Withdraw is awaiting confirmation on chain...",
        "Withdrawal completed.",
        true,
        networkName
      );
      setAmount("");
      fetchData();
    } catch (e) {
      console.error(e);
      setError(formatError(e.message));
    } finally {
      setLoading(false);
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          {historicTab == "apr" ? (
            <p className="label-value">{`${formatNumber(
              parseFloat(payload[0].value)
            )}%`}</p>
          ) : (
            <p className="label-value">{`$${formatNumber(
              parseFloat(payload[0].value)
            )}`}</p>
          )}
          <p className="label-date text-faded">
            {formatChartDate(payload[0].payload.date)}
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <Layout title={`${asset.symbol} Lending`}>
      <div className="mb-8">
        <Link href={"/lend"}>
          <a className="button button-primary button-link mr-4">Back</a>
        </Link>
      </div>
      <div style={{ maxWidth: "400px", margin: "0 auto" }}>
        <div className="card mb-4">
          <div
            style={{
              margin: "32px auto",
              borderRadius: "100%",
              border: "1px solid var(--foreground)",
              padding: "64px 0",
              textAlign: "center",
              width: 202,
            }}
          >
            <div className="label">Utilization</div>
            <div style={{ fontSize: "32px", fontWeight: "bold" }}>
              {formatNumber(data.utilization, 16, 1)}%
            </div>
          </div>
          <div className="flex">
            <div className="flex-1 label">Total lent</div>
            <div>
              {formatNumber(data.supply, asset.decimals)} {asset.symbol}
            </div>
          </div>
          <div className="flex">
            <div className="flex-1 label">Total borrowed</div>
            <div>
              {formatNumber(data.borrow, asset.decimals)} {asset.symbol}
            </div>
          </div>
          <div className="flex">
            <div className="flex-1 label">Current borrow APR</div>
            <div>
              <b>{formatNumber(data.rate.mul(YEAR), 16)}%</b>
            </div>
          </div>
          <div className="flex">
            <div className="flex-1 label">Current lending APR</div>
            <div>
              <b>{formatNumber(data.apr, 16)}%</b>
            </div>
          </div>
        </div>
        <div className="card mb-4">
          <div className="card text-center mb-4">
            <div className="font-lg font-bold">
              {formatNumber(data.value, asset.decimals)} {asset.symbol}
            </div>
            <div className="label">Your {asset.symbol} Lent</div>
          </div>
          <div className="flex">
            <div className="flex-1 label">Your rib{asset.symbol} Balance</div>
            <div>
              {formatNumber(data.balance, asset.decimals)} rib{asset.symbol}
            </div>
          </div>
          <div className="flex mb-4">
            <div className="flex-1 label">Available for withdraw</div>
            <div>
              {formatNumber(
                bnMin(data.value, data.supply.sub(data.borrow)),
                asset.decimals
              )}{" "}
              {asset.symbol}
            </div>
          </div>
          <div className="tabs mb-4">
            <a
              className={`tabs-tab ${tab === "deposit" ? "active" : ""}`}
              onClick={() => setTab("deposit")}
            >
              Deposit
            </a>
            <a
              className={`tabs-tab ${tab === "withdraw" ? "active" : ""}`}
              onClick={() => setTab("withdraw")}
            >
              Withdraw
            </a>
          </div>
          {error ? <div className="error mb-4">{error}</div> : null}
          {tab === "deposit" ? (
            <>
              <h2 className="subtitle">Deposit</h2>
              <label className="label flex">
                <div className="flex-1">Amount</div>
                <div>
                  {formatNumber(data.assetBalance, asset.decimals)}{" "}
                  {asset.symbol} <a onClick={onDepositMax}>Max</a>
                </div>
              </label>
              <input
                className="input mb-4"
                value={amount}
                onInput={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <button
                className="button w-full"
                onClick={!data.assetAllowanceOk ? onApprove : onDeposit}
                disabled={loading}
              >
                {loading
                  ? "Loading..."
                  : !data.assetAllowanceOk
                  ? "Approve " + asset.symbol
                  : "Deposit"}
              </button>
            </>
          ) : null}
          {tab === "withdraw" ? (
            <>
              <h2 className="subtitle">Withdraw</h2>
              <label className="label flex">
                <div className="flex-1">Amount</div>
                <div>
                  {formatNumber(data.value, asset.decimals)} USDC{" "}
                  <a onClick={onWithdrawMax}>Max</a>
                </div>
              </label>
              <input
                className="input mb-2"
                value={amount}
                onInput={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <button
                className="button w-full mb-2"
                onClick={onWithdraw}
                disabled={loading}
              >
                {loading ? "Loading..." : "Withdraw"}
              </button>
            </>
          ) : null}
        </div>

        <div className="card">
          <div className="tabs mb-4">
            <a
              className={`tabs-tab ${historicTab === "apr" ? "active" : ""}`}
              onClick={onHistoricTab.bind(null, "apr")}
            >
              APR
            </a>
            <a
              className={`tabs-tab ${historicTab === "tvl" ? "active" : ""}`}
              onClick={onHistoricTab.bind(null, "tvl")}
            >
              TVL
            </a>
          </div>

          <h2 ref={chartTitleRef} className="subtitle">
            {chartTitle}
          </h2>
          <p ref={chartDateRef}>{chartDate}</p>

          <div className="interval-select mb-4">
            <div className="flex mb-4">
              <button
                className={`button button-gray button-small flex-2 mr-2 ${
                  chartInterval === "short" ? "active" : ""
                }`}
                onClick={() => setChartInterval("short")}
              >
                90 Days
              </button>
              <button
                className={`button button-gray button-small flex-2 mr-2 ${
                  chartInterval === "long" ? "active" : ""
                }`}
                onClick={() => setChartInterval("long")}
              >
                2 Years
              </button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <AreaChart
              data={chartData}
              onMouseMove={cMouseMove}
              onMouseOut={cMouseOut}
            >
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={historicTab}
                stroke="#e89028"
                fill="#e89028"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Layout>
  );
}
