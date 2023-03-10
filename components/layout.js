import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ethers } from "ethers";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import Head from "next/head";
import Link from "next/link";
import Logo from "./_logo";
import Icon from "./icon";
import Footer from "./footer";
import { useWeb3 } from "../utils";
import { ToastContainer } from "react-toastify";

export default function Layout({ title, children, navigation }) {
  const router = useRouter();
  const { signer, address, networkName } = useWeb3();
  const dynamicTitle = `${title ? title + " | " : ""}Rodeo`;
  const [mode, setMode] = useState("light");

  async function onMint() {
    const contract = new ethers.Contract(
      "0xd05c162c7a9c58844db3232d57d522616d81e1b4",
      ["function mint(address, uint)"],
      signer
    );
    await (await contract.mint(address, "1000000000")).wait();
  }

  function onToggleMode() {
    const newMode = mode === "light" ? "dark" : "light";
    setMode(newMode);
    localStorage.setItem("mode", newMode);
    document.body.classList.toggle("dark");
  }

  useEffect(() => {
    if (global.window?.localStorage.getItem("mode") === "dark") {
      setMode("dark");
      document.body.classList.add("dark");
    }
  }, []);

  const links = (
    <>
      <Link href="/farm">
        <a className={router.pathname.includes("/farm") ? "active" : ""}>
          <Icon name="farm" />
          Farms
        </a>
      </Link>
      <Link href="/lend">
        <a className={router.pathname.includes("/lend") ? "active" : ""}>
          <Icon name="refresh" />
          Lending
        </a>
      </Link>
      <Link href="/positions">
        <a className={router.pathname == "/positions" ? "active" : ""}>
          <Icon name="briefcase" />
          Positions
        </a>
      </Link>
    </>
  );

  return (
    <>
      <Head>
        <title>{dynamicTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <ToastContainer />

      <div className="app">
        <div className="hide container flex-phone items-center mt-4">
          <details className="mobile-nav">
            <summary>
              <Icon name="menu" />
            </summary>
            <nav>{links}</nav>
          </details>
          <div className="flex-1"></div>
          <div>
            <ConnectButton showBalance={false} />
          </div>
        </div>

        <div className="sidebar">
          <div className="sidebar-logo">
            <Logo wide height={38} />
          </div>
          <div className="sidebar-links">{links}</div>
        </div>
        <div className="container">
          <div
            style={{
              borderRadius: "0 0 var(--border-radius) var(--border-radius)",
              padding: "16px",
              background: "rgb(225, 87, 43)",
              textAlign: "center",
              color: "white",
              boxShadow: "var(--box-shadow)",
              opacity: "90%",
            }}
          >
            <b>Rodeo Finance is a BETA product.</b>
            <br />
            Make sure you understand what you are getting into. Only deposit
            what you can lose.
          </div>
          <div className="header">
            <div className="header-row">
              <div className="flex items-center">
                <h1>{title}</h1>
              </div>
              <div className="flex items-center hide-phone">
                <a className="header-theme flex" onClick={onToggleMode}>
                  <Icon name="moon" />
                </a>
                <ConnectButton showBalance={false} />
              </div>
            </div>
          </div>

          {networkName != "arbitrum" &&
          networkName != "arbitrum-rinkeby" &&
          networkName != "localhost" ? (
            <div
              style={{
                fontSize: 18,
                fontWeight: "bold",
                textAlign: "center",
                padding: "10vh 0",
              }}
            >
              Wrong network connected. Switch to Arbitrum.
            </div>
          ) : (
            children
          )}
        </div>
        <Footer />
      </div>
    </>
  );
}
