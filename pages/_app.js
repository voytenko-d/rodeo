import { useEffect, Component } from "react";
import { formatError } from "../utils";
import "@rainbow-me/rainbowkit/styles.css";
import { WagmiConfig } from "wagmi";
import {
  RainbowKitProvider,
  lightTheme,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { wagmiClient, chains } from "../utils";

import "react-toastify/dist/ReactToastify.css";
import "../styles.scss";
import "../stylesWebsite.scss";

export default function App({ Component, pageProps }) {
  const themeOverrides = (theme) => {
    return Object.assign(theme, {
      colors: Object.assign(theme.colors, {
        accentColor: "var(--primary)",
      }),
      radii: Object.assign(theme.radii, {
        actionButton: "12px",
        connectButton: "12px",
        menuButton: "12px",
        modal: "12px",
        modalMobile: "12px",
      }),
    });
  };
  const theme = {
    lightMode: themeOverrides(lightTheme()),
    darkMode: themeOverrides(darkTheme()),
  };

  useEffect(() => {
    if (window.location.hostname === "alpha.rodeofinance.xyz") {
      window.location.href = "https://www.rodeofinance.xyz/farm";
    }
  }, []);

  return (
    <ErrorBoundary>
      <WagmiConfig client={wagmiClient}>
        <RainbowKitProvider chains={chains} theme={theme}>
          <Component {...pageProps} />
        </RainbowKitProvider>
      </WagmiConfig>
    </ErrorBoundary>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{ margin: "15vh auto", maxWidth: "400px", color: "#eb8427" }}
        >
          <h1>Error!</h1>
          <div>{formatError(this.state.error)}</div>
        </div>
      );
    }

    return this.props.children;
  }
}
