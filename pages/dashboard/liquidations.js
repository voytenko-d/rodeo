import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  ONE,
  rpcUrls,
  ADDRESSES,
  strategies,
  pools,
  assets,
  parseUnits,
  formatDate,
  formatNumber,
  formatAddress,
  useWeb3,
} from "../../utils";

export default function DashboardLiquidations() {
  const [data, setData] = useState([]);

  useEffect(() => {
    (async () => {
      setData(await (await fetch("/api/liquidations")).json());
    })();
  }, []);

  return (
    <div className="container">
      <div className="card mt-4 mb-4">
        <h2 className="title">Liquidations</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Index</th>
              <th>Strategy</th>
              <th>Pool</th>
              <th>Value</th>
              <th>Borrow</th>
              <th>Fee</th>
              <th>Created</th>
              <th>Liquidated</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => {
              const networkName = "arbitrum";
              const strategy = strategies[networkName].find(
                (s) => s.index.toString() === p.strategy
              );
              const pool = pools[networkName].find(
                (po) => po.address === p.pool
              );
              const asset = assets[networkName][pool.asset];
              return (
                <tr key={p.id}>
                  <td>{p.index}</td>
                  <td>{strategy?.name || "?"}</td>
                  <td>{asset.symbol}</td>
                  <td>{p.data.amount}</td>
                  <td>
                    {formatNumber(parseUnits(p.data.borrow, 0), asset.decimals)}
                  </td>
                  <td>
                    {formatNumber(parseUnits(p.data.fee, 0), asset.decimals)}
                  </td>
                  <td>{formatDate(p.created)}</td>
                  <td>{formatDate(p.time)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
