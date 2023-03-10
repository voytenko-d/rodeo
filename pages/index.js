import { useState, useEffect } from "react";
import Link from "next/link";
import Icon from "../components/icon";
import Layout from "../components/layoutWebsite";
import { Farm } from "./farm/index";
import { usePools, topApy, strategies } from "../utils";

export default function Home() {
  const { data: pools } = usePools();
  const [tvl, setTvl] = useState();
  const [highestApy, setHighestApy] = useState();

  useEffect(() => {
    (async () => {
      setTvl(parseFloat(await (await fetch("/api/tvl")).json()));
    })();
    const handle = setInterval(() => {
      const t = topApy();
      if (t.apy != highestApy?.apy) setHighestApy(t);
    }, 1000);
    return () => clearInterval(handle);
  }, []);

  return (
    <Layout>
      <div className="splash flex">
        <div className="flex-1 mb-4">
          <h1>Leveraged Yield Farming</h1>
          <p className="text-faded">
            Farms with easy, automated and secure leverage on all the top farms
            Arbitrum has to offer. Earn yield on majors in our lending pools
            with better APY that most other lending markets.
          </p>
          <Link href="/farm">
            <a className="button">Launch App</a>
          </Link>
        </div>
        <div className="splash-right">
          <div className="card flex mb-4">
            <div className="flex-1">
              ${tvl ? (tvl / 1000).toFixed(1) : "42.3"}K
            </div>
            <div className="text-faded">TVL</div>
          </div>
          <div className="card">
            <div className="flex">
              <div className="flex-1">
                {highestApy ? (highestApy.apy * 5).toFixed(0) : "126"}%
              </div>
              <div className="text-faded">APY</div>
            </div>
            <div
              className="flex items-center border-t"
              style={{ padding: "16px 16px 0", margin: "16px -16px 0" }}
            >
              <div className="flex-1">
                {highestApy?.strategy?.name || "ETH/USDT"}
                <div className="text-faded">
                  {highestApy?.strategy?.protocol || "SushiSwap"}
                </div>
              </div>
              <Link
                href={`/farm/${
                  highestApy?.strategy?.slug || "sushiswap-eth-usdt"
                }`}
              >
                <a>
                  <Icon name="go-button" />
                </a>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="overview" id="overview">
        <h2>Farms</h2>
        <div className="farms">
          {(strategies["arbitrum"] || [])
            .filter((s) => !s.hidden)
            .map((s, i) => (
              <Farm
                homepage
                key={s.name}
                index={i}
                pools={pools}
                positions={[]}
                strategy={s}
              />
            ))}
        </div>
      </div>

      <div className="content-why" id="why">
        <h2>Why Rodeo?</h2>

        <div className="cards">
          <div className="card content-card">
            <h4>
              Leverage
              <span>Undercolateralized loans</span>
            </h4>
            <img src="/website/why-leverage.png" />
            <div>
              Rodeo is one of the very few places in DeFi where you can borrow
              more capital than your collateral enabling high yield from
              leverage as high as 10x.
            </div>
          </div>
          <div className="card content-card">
            <h4>
              Lend
              <span>High interest on stables</span>
            </h4>
            <img src="/website/why-lend.png" />
            <div>
              Rodeo lends stables to farmers getting high yield, enabling
              stables holders to safely collect higher yields than offered by
              competing money markets.
            </div>
          </div>
          <div className="card content-card">
            <h4>
              Decentralized
              <span>Hyperstructure protocol</span>
            </h4>
            <img src="/website/why-decentralized.png" />
            <div>
              Contracts can be used by anybody / any protocols. Liquidations are
              decentralized and open for any keeper to execute. Eventually,
              parameters will be controlled by token holders.
            </div>
          </div>
        </div>
      </div>

      <div className="home-icons" id="integrations">
        <h2>Integrations</h2>
        <div className="home-icons-row">
          <div className="home-icon">
            <img src="/protocols/gmx.png" />
          </div>
          <div className="home-icon">
            <img src="/protocols/uniswap.svg" />
          </div>
          <div className="home-icon">
            <img src="/protocols/sushiswap.png" />
          </div>
          <div className="home-icon">
            <img src="/protocols/traderjoe.png" />
          </div>
          <div className="home-icon">
            <img src="/protocols/kyberswap.png" />
          </div>
          <div className="home-icon">
            <img src="/protocols/curve.svg" />
          </div>
          <div className="home-icon">
            <img src="/protocols/balancer.svg" />
          </div>
          <div className="home-icon">
            <img src="/protocols/plutusdao.png" />
          </div>
          <div className="home-icon">
            <img src="/protocols/jonesdao.png" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
