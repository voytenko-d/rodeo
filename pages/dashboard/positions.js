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

const chainIdToNetworkName = { 1337: "localhost", 42161: "arbitrum" };

export default function DashboardPositions() {
  const { contracts } = useWeb3();
  const [data, setData] = useState([]);

  useEffect(() => {
    (async () => {
      const positions = await (await fetch("/api/positions/all")).json();
      setData(positions);
      for (let p of positions) {
        try {
          const networkName = chainIdToNetworkName[p.chain];
          const provider = new ethers.providers.JsonRpcProvider(
            rpcUrls[p.chain].http
          );
          const contract = new ethers.Contract(
            ADDRESSES[networkName].positionManager,
            ["function ownerOf(uint) view returns (address)"],
            provider
          );
          p.owner = await contract.ownerOf(p.index);
        } catch (e) {
          console.error("ownerOf", e);
        }
      }
      setData(positions.slice(0));
    })();
  }, []);

  return (
    <div className="container">
      <div className="card mt-4 mb-4">
        <h2 className="title">Positions</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Index</th>
              <th>Owner</th>
              <th>Strategy</th>
              <th>Pool</th>
              <th>Value</th>
              <th>Borrow</th>
              <th>Leverage</th>
              <th>Health</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => {
              const networkName = chainIdToNetworkName[p.chain];
              const strategy = strategies[networkName].find(
                (s) => s.index.toString() === p.strategy
              );
              const pool = pools[networkName].find(
                (po) => po.address === p.pool
              );
              const asset = assets[networkName][pool.asset];
              const price = parseUnits(p.price, 0)
                .mul(ONE)
                .div(parseUnits("1", asset.decimals));
              const sharesUsd = parseUnits(p.shares_value, 0);
              const borrowUsd = parseUnits(p.borrow_value, 0)
                .mul(price)
                .div(ONE);
              let leverage = ONE;
              if (sharesUsd.gt(0) && borrowUsd.gt(0)) {
                leverage = borrowUsd
                  .mul(ONE)
                  .div(sharesUsd.sub(borrowUsd))
                  .add(ONE);
              }
              return (
                <tr key={p.id}>
                  <td>
                    <a
                      href={`/dashboard/positions/${p.chain}-${p.index}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p.index}
                    </a>
                  </td>
                  <td>
                    <a
                      href={`https://arbiscan.io/address/${p.owner}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p.owner ? formatAddress(p.owner) : "?"}
                    </a>
                  </td>
                  <td>{strategy?.name || "?"}</td>
                  <td>{asset.symbol}</td>
                  <td>${formatNumber(sharesUsd)}</td>
                  <td>${formatNumber(borrowUsd)}</td>
                  <td>{formatNumber(leverage, 18, 1)}x</td>
                  <td>{formatNumber(parseUnits(p.life, 0))}</td>
                  <td>{formatDate(p.created)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
