import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useState, useEffect } from "react";
import {
  YEAR,
  pools,
  assets,
  usePools,
  useWeb3,
  formatNumber,
  parseUnits,
  formatUnits,
} from "../../utils";
import Layout from "../../components/layout";
import Tooltip from "../../components/tooltip";

export default function Lend() {
  const { data: poolData, refetch } = usePools();

  if (poolData.length === 0) {
    return (
      <Layout title="Lending">
        <h1 className="title">Lending</h1>
        <div>Loading...</div>
      </Layout>
    );
  }
  return (
    <Layout title="Lending">
      <div className="pl-4 pr-4 mb-4">
        <div className="grid-7 label hide-phone">
          <div>Asset</div>
          <div>
            Price
            <Tooltip tip="Current asset price as obtained from on-chain oracles." />
          </div>
          <div>
            APR
            <Tooltip tip="Annual rate of return when lending funds. Rate is variable depending on pool utilization." />
          </div>
          <div>Total Borrow</div>
          <div>Total Supply</div>
          <div>Available</div>
          <div></div>
        </div>
      </div>
      <div className="farms">
        {poolData.map((p, i) => (
          <div key={p.info.address}>
            <Pool index={i} pool={p} />
          </div>
        ))}
      </div>
    </Layout>
  );
}

function Pool({ index, pool }) {
  const router = useRouter();
  const { address, walletStatus, networkName, contracts } = useWeb3();
  const { openConnectModal } = useConnectModal();
  const asset = assets[networkName][pool.info.asset];
  const utilization = pool.data.supply.gt(0)
    ? pool.data.borrow.mul(parseUnits("1")).div(pool.data.supply)
    : 0;
  const apr = pool.data.rate.mul(YEAR).mul(utilization).div(parseUnits("1"));

  return (
    <div
      className="farm"
      onClick={() => router.push(`/lend/${pool.info.slug}`)}
    >
      <div className="grid-7 items-center">
        <div>
          <div className="label hide show-phone">Asset</div>
          <div className="flex items-center">
            <div className="strategy-icon hide-phone">
              <Image
                src={asset.icon}
                width={24}
                height={24}
                alt={asset.symbol}
              />
            </div>
            <div>
              <b className="font-xl" style={{ lineHeight: 1 }}>
                {asset.symbol}
              </b>
              <div className="hide-phone" style={{ opacity: "0.5" }}>
                {asset.name}
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="label hide show-phone">Price</div>${" "}
          {formatNumber(pool.data.price)}
        </div>
        <div>
          <div className="label hide show-phone">APR</div>
          {formatNumber(apr, 16, 2)}%
        </div>
        <div>
          <div className="label hide show-phone">Total Borrow</div>
          <div>$ {formatNumber(pool.data.borrow, asset.decimals)}</div>
        </div>
        <div>
          <div className="label hide show-phone">Total Supply</div>
          <div>$ {formatNumber(pool.data.supply, asset.decimals)}</div>
        </div>
        <div>
          <div className="label hide show-phone">Available</div>
          <div>
            ${" "}
            {formatNumber(
              pool.data.supply.sub(pool.data.borrow),
              asset.decimals
            )}
          </div>
        </div>
        <div>
          <div className="label hide show-phone">&nbsp;</div>
          <div>
            <Link href={`/lend/${pool.info.slug}`}>
              <a className="button w-full">Lend</a>
            </Link>
          </div>
        </div>
      </div>
      {apr.gt(parseUnits("0.1")) ? (
        <div className="pool-highapy">
          This pool has a high APY because of high utilisation! It could use
          more lenders ;)
        </div>
      ) : null}
    </div>
  );
}
