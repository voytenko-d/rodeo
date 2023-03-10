import Image from "next/image";
import { useRouter } from "next/router";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  bnMin,
  bnMax,
  ONE,
  YEAR,
  strategies,
  formatError,
  formatNumber,
  parseUnits,
  formatUnits,
  useWeb3,
  usePools,
  usePositions,
  useApy,
  maybeApy,
} from "../../utils";
import Layout from "../../components/layout";
import Tooltip from "../../components/tooltip";

export default function Farms() {
  const [tvl, setTvl] = useState();
  const { networkName } = useWeb3();
  const { data: pools } = usePools();
  const { data: positions } = usePositions();
  const activePositions = positions.filter((p) => p.shares.gt(0));
  const shares = activePositions.reduce(
    (t, p) => t.add(p.sharesUsd),
    parseUnits("0")
  );
  const borrow = activePositions.reduce(
    (t, p) => t.add(p.borrowUsd),
    parseUnits("0")
  );
  const profit = activePositions.reduce(
    (t, p) => t.add(p.profitUsd),
    parseUnits("0")
  );
  const averageApys = activePositions
    .map((p) => {
      const s = strategies[networkName].find((s) => s.index === p.strategy);
      if (!s) return null;
      return maybeApy(s.apy);
    })
    .filter((a) => a);
  const averageApy =
    averageApys.reduce((t, a) => t + a, 0) / averageApys.length;
  const monthlyYield = (shares.div(ONE).toNumber() * averageApy) / 100 / 12;
  console.log(shares, borrow, averageApys, averageApy, monthlyYield, tvl);

  useEffect(() => {
    (async () => {
      setTvl(parseFloat(await (await fetch("/api/tvl")).json()));
    })();
  }, []);

  return (
    <Layout title="Farms">
      <div className="grid-2 mb-6" style={{ gridTemplateColumns: "3fr 1fr" }}>
        <div>
          <div className="title">Portfolio</div>
          <div
            className="card grid-5 mb-4"
            style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}
          >
            <div>
              <div className="label">Value</div>
              <div className="font-lg">$ {formatNumber(shares)}</div>
            </div>
            <div>
              <div className="label">Borrow</div>
              <div className="font-lg">$ {formatNumber(borrow)}</div>
            </div>
            <div>
              <div className="label">Profit</div>
              <div className="font-lg">$ {formatNumber(profit)}</div>
            </div>
            <div>
              <div className="label">Monthly Yield</div>
              <div className="font-lg">$ {formatNumber(monthlyYield || 0)}</div>
            </div>
            <div>
              <div className="label">Avg. APY</div>
              <div className="font-lg">
                {formatNumber(averageApy || 0, 0, 1)}%
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="title">Protocol</div>
          <div className="card mb-4">
            <div>
              <div className="label">TVL</div>
              <div className="font-lg">$ {formatNumber(tvl || 0, 0, 0)}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="pl-4 pr-4 mb-4">
        <div className="grid-6 label hide-phone">
          <div>Name</div>
          <div>Position Value</div>
          <div>
            Leverage
            <Tooltip tip="Assumed leverage for the APY number displayed. You can use from 1x leverage up to 10x leverage." />
          </div>
          <div>
            APY
            <Tooltip tip="APY for this farm when using leverage in previous column, after subtracting borrowing fees" />
          </div>
          <div>
            TVL
            <Tooltip tip="Total TVL of this farm's target farm/vault/pool. A higher TVL usually means less risky" />
          </div>
          <div></div>
        </div>
      </div>
      <div className="farms">
        {(strategies[networkName] || [])
          .filter((s) => !s.hidden)
          .map((s, i) => (
            <Farm
              key={s.name}
              index={i}
              pools={pools}
              positions={positions}
              strategy={s}
            />
          ))}
      </div>
    </Layout>
  );
}

export function Farm({ index, pools, positions, strategy, homepage }) {
  const router = useRouter();
  const { walletStatus } = useWeb3();
  const { openConnectModal } = useConnectModal();
  const llamaPool = useApy(strategy.apy);
  const position = positions.find(
    (p) => p.strategy === strategy.index && p.sharesUsd.gt("0")
  );

  let defaultLeverage = "5";
  let leveragedApy = parseUnits("0");
  try {
    const pool = pools[0]; // TODO allow user to select borrow asset
    const leverage = position
      ? position.leverage
      : parseUnits(defaultLeverage, 18);
    leveragedApy = parseUnits((llamaPool.apy / 100).toFixed(6), 18);
    leveragedApy = leveragedApy
      .mul(leverage)
      .div(ONE)
      .sub(pool.data.rate.mul(YEAR).mul(leverage.sub(ONE)).div(ONE));
    if (leveragedApy.lt(0) && !position) {
      defaultLeverage = "1";
      leveragedApy = parseUnits((llamaPool.apy / 100).toFixed(6), 18);
    }
  } catch (e) {
    console.log("leveragedApy", e);
  }

  function onOpen() {
    if (walletStatus === "disconnected") {
      openConnectModal();
      return;
    }
    router.push(`/farm/${strategy.slug}`);
  }

  return (
    <div className="farm" onClick={onOpen}>
      <div className={`${homepage ? "grid-5" : "grid-6"} items-center`}>
        <div>
          <div className="label hide show-phone">Name</div>
          <div className="flex items-center">
            <div className="strategy-icon hide-phone">
              <Image
                src={strategy.icon}
                width={24}
                height={24}
                alt={strategy.protocol}
              />
            </div>
            <div>
              <b className="font-xl" style={{ lineHeight: 1 }}>
                {strategy.name}
                {strategy.isNew ? (
                  <span className="strategy-new tooltip">
                    Wild West
                    <span className="tooltip-box">
                      Danger! New and un-audited farm
                    </span>
                  </span>
                ) : null}
              </b>
              <div className="hide-phone" style={{ opacity: "0.5" }}>
                {strategy.protocol}
              </div>
            </div>
          </div>
        </div>
        {!homepage ? (
          <div>
            <div className="label hide show-phone">Position Value</div>
            <div>$ {formatNumber(position ? position.sharesUsd : 0)}</div>
          </div>
        ) : null}
        <div>
          <div className="label hide show-phone">Leverage</div>
          {position ? formatNumber(position.leverage, 18, 1) : defaultLeverage}x
          {homepage ? (
            <div className="text-faded hide-phone">Leverage</div>
          ) : null}
        </div>
        <div>
          <div className="label hide show-phone">APY</div>
          <div style={{ color: "var(--primary)" }}>
            {llamaPool ? formatNumber(leveragedApy, 16, 2) + "%" : "..."}
          </div>
          <div style={{ textDecoration: "line-through" }}>
            {llamaPool ? formatNumber(llamaPool.apy) + "%" : "..."}
          </div>
        </div>
        <div>
          <div className="label hide show-phone">TVL</div>
          <div>
            {llamaPool ? formatNumber(llamaPool.tvl / 1e6, 0, 1) + "M" : "..."}
          </div>
          {homepage ? <div className="text-faded hide-phone">TVL</div> : null}
        </div>
        <div>
          <div className="label hide show-phone">&nbsp;</div>
          <div>
            <a className="button w-full" onClick={onOpen}>
              Farm
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
