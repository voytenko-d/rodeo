import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import Layout from "../components/layout";
import {
  YEAR,
  assets,
  formatNumber,
  getContracts,
  parseUnits,
  pools,
  runTransaction,
  strategies,
  usePositions,
  useWeb3,
} from "../utils";

export default function Positions() {
  const { contracts, networkName, address } = useWeb3();
  const [tab, setTab] = useState("active");
  const [lending, setLending] = useState();
  let { data: positions, refetch } = usePositions();
  positions.sort((a, b) => {
    const aActive = a.shares.gt(0);
    const bActive = b.shares.gt(0);
    if (aActive && !bActive) return -1;
    if (bActive && !aActive) return 1;
    return b.id - a.id;
  });
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
  positions = positions.filter((p) =>
    tab === "active" ? p.shares.gt(0) : p.shares.eq(0)
  );

  useEffect(() => {
    (async () => {
      const pool = pools[networkName][0];
      const asset = assets[networkName][pool.asset];
      const poolContract = contracts.asset(pool.address);
      const values = await contracts.investorHelper.peekPools([pool.address]);
      const data = {
        share: values[1][0],
        supply: values[2][0],
        borrow: values[3][0],
        rate: values[4][0],
        price: values[5][0],
        balance: await poolContract.balanceOf(address),
      };
      if (data.supply.gt(0)) {
        data.utilization = data.borrow.mul(parseUnits("1")).div(data.supply);
      }
      if (data.share.gt(0)) {
        data.value = data.balance.mul(data.supply).div(data.share);
      }
      data.valueUsd = data.value
        .mul(data.price)
        .div(parseUnits("1", asset.decimals));
      data.apr = data.rate.mul(YEAR).mul(data.utilization).div(parseUnits("1"));
      setLending(data);
    })();
  }, [networkName, address]);

  return (
    <Layout title="Positions">
      <div className="grid-2 mb-6" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div>
          <div className="title">Overview</div>
          <div className="card grid-4 mb-4">
            <div>
              <div className="label">Your Value</div>
              <div className="font-lg">$ {formatNumber(shares)}</div>
            </div>
            <div>
              <div className="label">Your Borrow</div>
              <div className="font-lg">$ {formatNumber(borrow)}</div>
            </div>
            <div>
              <div className="label">Your Net</div>
              <div className="font-lg">
                $ {formatNumber(shares.sub(borrow))}
              </div>
            </div>
            <div>
              <div className="label">Your ROI</div>
              <div className="font-lg">$ {formatNumber(profit)}</div>
            </div>
          </div>
        </div>
        <div>
          <div className="title">Lending</div>
          <div className="card grid-2 mb-4">
            <div>
              <div className="label">Value</div>
              <div className="font-lg">
                $ {lending ? formatNumber(lending.valueUsd) : "..."}
              </div>
            </div>
            <div>
              <div className="label">APR</div>
              <div className="font-lg">
                {lending ? formatNumber(lending.apr, 16, 1) : "..."}%
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="title">Your Positions</div>
      <div className="tabs mb-4" style={{ maxWidth: 210 }}>
        <a
          className={`tabs-tab ${tab === "active" ? " active" : ""}`}
          onClick={() => setTab("active")}
        >
          Active
        </a>
        <a
          className={`tabs-tab ${tab === "closed" ? " active" : ""}`}
          onClick={() => setTab("closed")}
        >
          Closed
        </a>
      </div>
      <div className="pl-4 pr-4 mb-4">
        <div className="grid-6 label hide-phone">
          <div>Strategy</div>
          <div>Value</div>
          <div>Borrow</div>
          <div>ROI</div>
          <div>Health</div>
          <div></div>
        </div>
      </div>
      <div className="farms">
        {positions.map((p, i) => (
          <Position key={i} position={p} refetch={refetch} />
        ))}
        {positions.length === 0 ? (
          <div
            className="farm text-center font-lg"
            style={{ padding: "60px 0" }}
          >
            No position yet
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

function Position({ position, refetch }) {
  const { networkName, signer } = useWeb3();
  const pool = pools[networkName].find((p) => p.address === position.pool);
  const asset = assets[networkName][pool?.asset];
  const strategyIndex = strategies[networkName].findIndex(
    (s) => s.index === position.strategy
  );
  const strategy = strategies[networkName][strategyIndex];
  const [loading, setLoading] = useState(false);

  async function onRemove(id) {
    try {
      setLoading(true);
      const contracts = getContracts(signer, networkName);
      const call = contracts.positionManager.burn(id);
      await runTransaction(
        call,
        "Burning your closed position NFT...",
        "Position NFT burned",
        false,
        networkName
      );
      refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }
  if (!strategy) return;

  return (
    <div className="farm">
      <div className="grid-6 items-center">
        <div>
          <div className="label hide show-phone">Strategy</div>
          <div className="flex items-center">
            <div className="strategy-icon">
              <Image
                src={strategy.icon}
                width={24}
                height={24}
                alt={strategy.protocol}
              />
            </div>
            <div>
              <b className="font-xl" style={{ lineHeight: 1 }}>
                {strategy.name} #{position.id}
              </b>
              <div style={{ opacity: "0.5" }}>{strategy.protocol}</div>
            </div>
          </div>
        </div>
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
          <div className="label hide show-phone">Health</div>
          <div>{formatNumber(position.health)}</div>
        </div>
        <div>
          <div className="label hide show-phone">&nbsp;</div>
          <div>
            {position.shares.gt(0) ? (
              <Link href={`/farm/${strategy?.slug}/${position?.id}`}>
                <a className="button w-full">Details</a>
              </Link>
            ) : (
              <button
                className="button button-gray w-full mb-2"
                onClick={() => onRemove(position?.id)}
                disabled={loading}
              >
                {loading ? "Loading..." : "Remove"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
