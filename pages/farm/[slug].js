import Link from "next/link";
import Image from "next/image";
import Icon from "../../components/icon";
import { useRouter } from "next/router";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useState } from "react";
import {
  assets,
  capitalize,
  DONUT_COLORS,
  formatChartDate,
  formatHealthClassName,
  formatNumber,
  pools,
  strategies,
  tokens,
  useApy,
  usePositions,
  useWeb3,
} from "../../utils";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import Layout from "../../components/layout";

export default function Farm() {
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const { signer, address, networkName, chainId } = useWeb3();
  const { data: positions, refetch: positionsRefetch } = usePositions();
  const strategy = (strategies[networkName] || []).find(
    (s) => s.slug == router.query.slug
  );
  const positionsFiltered = positions.filter(
    (p) => p.strategy === strategy?.index && p.sharesUsd.gt("0")
  );
  const llamaPool = useApy(strategy?.apy);
  const expChartData = strategy?.assets.map((a) => ({
    name: tokens[a.address].name,
    value: a.ratio,
  }));

  const [chartInterval, setChartInterval] = useState(7);
  const [historicType, setHistoricType] = useState("tvl");
  const [histories, setHistories] = useState([]);
  const histChartData = useMemo(
    () => calcChartData(),
    [historicType, histories]
  );

  function onHistoricType(newTab) {
    setHistoricType(newTab);
    setChartInterval(7);
  }

  async function fetchHistories() {
    if (!strategy) return;
    const histories = await (
      await fetch(
        `/api/apys/history?chain=${chainId}&address=${strategy.address.toLowerCase()}&interval=day&length=${chartInterval}`
      )
    ).json();
    if (histories[histories.length - 1].apy === "0E-16") {
      histories[histories.length - 1].apy = histories[histories.length - 2].apy;
    }
    if (histories[histories.length - 1].tvl === "0E-16") {
      histories[histories.length - 1].tvl = histories[histories.length - 2].tvl;
    }
    setHistories(histories);
  }

  function calcChartData() {
    if (!histories) return [];

    if (historicType == "apy") {
      return histories.map((h) => {
        return {
          date: new Date(h.t),
          apy: formatNumber(parseFloat(h.apy)),
        };
      });
    }

    if (historicType == "tvl") {
      return histories.map((h) => {
        return {
          date: new Date(h.t),
          tvl: formatNumber(parseFloat(h.tvl) / 1e6, 0, 1),
        };
      });
    }
  }

  useEffect(() => {
    positionsRefetch().then(
      () => {},
      (e) => console.error("fetch", e)
    );
  }, [networkName, address]);

  useEffect(() => {
    fetchHistories().then(
      () => {},
      (e) => console.error("fetch", e)
    );
  }, [chartInterval]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          {historicType == "apy" ? (
            <p className="label-value">
              APY - {`${formatNumber(parseFloat(payload[0].value))}%`}
            </p>
          ) : (
            <p className="label-value">TVL - {`$${payload[0].value + "M"}`}</p>
          )}
          <p className="label-date text-faded">
            {formatChartDate(payload[0].payload.date)}
          </p>
        </div>
      );
    }

    return null;
  };

  if (!strategy) {
    return (
      <Layout title="Farm: ...">
        <div>Loading...</div>
      </Layout>
    );
  }
  return (
    <Layout title={strategy.name + " Farm"}>
      <Link href={"/farm"}>
        <a className="button button-primary button-link mr-4">Back</a>
      </Link>
      <h2 className="title">Farm Information</h2>
      <div className="mb-4">
        <div className="grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="card grid-2">
            <div>
              <div className="label">APY</div>
              <span>
                {llamaPool ? formatNumber(llamaPool.apy) + "%" : "..."}
              </span>
            </div>
            <div>
              <div className="label">TVL</div>
              <span>
                {llamaPool
                  ? "$" + formatNumber(llamaPool.tvl / 1e6) + " M"
                  : "..."}
              </span>
            </div>
          </div>
          <div className="card grid-2">
            <div>
              <div className="label">Chain</div>
              <span>{capitalize(networkName)}</span>
            </div>
            <div>
              <div className="label">Protocol</div>
              <span>{strategy.protocol}</span>
            </div>
          </div>
        </div>
      </div>

      <h2 className="title flex items-center">
        <div className="flex-1">Your Positions</div>
        <Link href={`/farm/${strategy?.slug}/new`}>
          <a className="button">New Position</a>
        </Link>
      </h2>

      <div className="pl-4 pr-4 mb-4">
        <div
          className="grid-7 label hide-phone"
          style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr 1fr" }}
        >
          <div>#</div>
          <div>Value</div>
          <div>Borrow</div>
          <div>ROI</div>
          <div>Leverage</div>
          <div>Health</div>
          <div></div>
        </div>
      </div>
      <div className="mb-6">
        <div className="farms">
          {positionsFiltered.map((p, i) => (
            <Position key={i} position={p} />
          ))}
          {positionsFiltered.length === 0 ? (
            <div
              className="farm text-center font-lg"
              style={{ padding: "60px 0" }}
            >
              No position yet
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-6 grid-2 gap-4">
        <div className="">
          <div className="flex items-center">
            <h3 className="title flex-1">Historical Rate</h3>
            <div className="tabs">
              <a
                className={`tabs-tab ${historicType === "tvl" ? "active" : ""}`}
                onClick={onHistoricType.bind(null, "tvl")}
              >
                TVL
              </a>
              <a
                className={`tabs-tab ${historicType === "apy" ? "active" : ""}`}
                onClick={onHistoricType.bind(null, "apy")}
              >
                APY
              </a>
            </div>
          </div>
          <div className="card farm-info-card">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={histChartData}>
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey={historicType}
                  stroke="#e89028"
                  fill="#e89028"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>

            <div className="hist-toggle">
              <a
                className={`mr-4 ${chartInterval === 7 ? "active" : ""}`}
                onClick={() => setChartInterval(7)}
              >
                1W
              </a>
              <a
                className={`mr-4 ${chartInterval === 30 ? "active" : ""}`}
                onClick={() => setChartInterval(30)}
              >
                1M
              </a>
              <a
                className={`mr-4 ${chartInterval === 365 ? "active" : ""}`}
                onClick={() => setChartInterval(365)}
              >
                1Y
              </a>
            </div>
          </div>
        </div>

        <div className="flex flex-column">
          <h3 className="title">Exposure</h3>
          <div className="card flex-1">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart width={400} height={400}>
                <Pie
                  data={expChartData}
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={1}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                >
                  {expChartData.map((entry, index) => (
                    <Cell key={index} fill={DONUT_COLORS[index]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div>
              {strategy.assets.map((a, index) => (
                <span key={index} className="mr-2">
                  <b>{tokens[a.address].name}</b> {a.ratio}%
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 gap-4">
        <div className="flex flex-column">
          <h3 className="title flex items-center">
            <div className="flex-1">Strategy</div>
            <a
              className="button button-primary button-link"
              href={`https://arbiscan.io/address/${strategy.address}`}
              target="_blank"
              rel="noreferrer"
            >
              Strategy Contract <Icon name="external-link" small />
            </a>
          </h3>

          <div className="card p-6">
            <div>{strategy.description}</div>
          </div>
        </div>

        <div className="flex-1">
          <h3 className="title">Assets</h3>
          <div className="card p-6 farm-info-card">
            {strategy.assets.map((a, i) => (
              <>
                <div
                  className={`flex items-center mb-2${i > 0 ? " mt-6" : ""}`}
                >
                  {assets[networkName][a.address] ? (
                    <div className="mr-2">
                      <Image
                        src={assets[networkName][a.address].icon}
                        width={24}
                        height={24}
                      />
                    </div>
                  ) : null}
                  <div className="font-lg mb-2 flex-1">
                    <b>{tokens[a.address].name}</b>
                  </div>
                  <a
                    className="button button-primary button-link button-small"
                    href={`https://arbiscan.io/address/${a.address}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Contract <Icon name="external-link" small />
                  </a>
                </div>
                <div>{tokens[a.address].description}</div>
              </>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Position({ position }) {
  const { networkName } = useWeb3();
  const pool = pools[networkName].find((p) => p.address === position.pool);
  const asset = assets[networkName][pool?.asset];
  const strategyIndex = strategies[networkName].findIndex(
    (s) => s.index === position.strategy
  );
  const strategy = strategies[networkName][strategyIndex];
  if (!strategy) return;

  return (
    <div className="farm">
      <div
        className="grid-7 items-center"
        style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr 1fr" }}
      >
        <div>#{position.id}</div>
        <div>
          <div className="label hide show-phone">Value</div>${" "}
          {formatNumber(position.sharesUsd)}
          <div style={{ opacity: "0.5" }}>
            {formatNumber(position.sharesAst, asset.decimals)} {asset.symbol}
          </div>
        </div>
        <div>
          <div className="label hide show-phone">Borrow</div>${" "}
          {formatNumber(position.borrowUsd)}
          <div style={{ opacity: "0.5" }}>
            {formatNumber(position.borrowAst, asset.decimals)} {asset.symbol}
          </div>
        </div>
        <div>
          <div className="label hide show-phone">ROI</div>
          <div>
            $ {formatNumber(position.profitUsd)}
            <div style={{ opacity: "0.5" }}>
              {formatNumber(position.profitPercent, 16)}%
            </div>
          </div>
        </div>
        <div>
          <div className="label hide show-phone">Leverage</div>
          {formatNumber(position?.leverage || 1, 18, 1)}x
        </div>
        <div>
          <div className="label hide show-phone">Health</div>
          <div className={formatHealthClassName(position.health)}>
            {formatNumber(position.health)}
          </div>
        </div>
        <div>
          <div className="label hide show-phone">&nbsp;</div>
          <div>
            <Link href={`/farm/${strategy?.slug}/${position.id}`}>
              <a className="button w-full">Adjust</a>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
