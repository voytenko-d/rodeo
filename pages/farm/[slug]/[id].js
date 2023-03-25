import Icon from "../../../components/icon";
import { useRouter } from "next/router";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import {
  assets,
  bnMax,
  bnMin,
  checkWhitelist,
  formatChartDate,
  formatError,
  formatNumber,
  formatUnits,
  ONE,
  parseUnits,
  runTransaction,
  strategies,
  tokensOfOwner,
  useApy,
  usePools,
  usePositions,
  useWeb3,
  YEAR,
} from "../../../utils";
import Layout from "../../../components/layout";
import Link from "next/link";
import DiscreteSliders from "../../../components/discreteSliders";
import PositionTrack from "../../../components/positionTrack";
import Input from "../../../components/input";

export default function FarmPosition() {
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const { signer, address, walletStatus, networkName, contracts, chainId } =
    useWeb3();
  const { data: pools } = usePools();
  const { data: positions, refetch: positionsRefetch } = usePositions();
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState();
  const [amount, setAmount] = useState("");
  const [amountBorrow, setAmountBorrow] = useState("");
  const strategy = (strategies[networkName] || []).find(
    (s) => s.slug == router.query.slug
  );
  const strategySlippage = ((strategy?.slippage || 50) / 100).toFixed(1);
  const [slippage, setSlippage] = useState(strategySlippage);
  const [slipModal, setSlipModal] = useState(false);
  const [leverage, setLeverage] = useState(1);
  let [selectedPool, setSelectedPool] = useState(0);
  const chartPosRef = useRef();
  const chartBorRef = useRef();
  const chartDateRef = useRef();
  let chartPos = "";
  let chartBor = "";
  const [chartData, setChartData] = useState([]);
  const [posEvents, setPosEvents] = useState([]);
  const hasChartData = chartData.find((d) => d.pos != 0);

  const llamaPool = useApy(strategy?.apy);
  const latestPosId = positions.length > 0 ? positions[0].id : null;
  const position = positions.find(
    (p) =>
      p.strategy === strategy?.index &&
      p.id == router.query.id &&
      p.sharesUsd.gt("0")
  );
  if (position) {
    selectedPool = pools.findIndex((p) => p.info.address === position.pool);
    chartPos = `$${formatNumber(position.sharesUsd)}`;
    chartBor = `$${formatNumber(position.borrowUsd)}`;
  }
  const pool = pools[selectedPool];
  const asset = (assets[networkName] || {})[pool?.info.asset];
  const chartDate =
    chartData.length > 0
      ? formatChartDate(chartData[chartData.length - 1].date)
      : null;

  let title = "Adjust position";
  if (!position) title = "New Position";
  if (action === "borrow") title = "Borrow more";
  if (action === "repay") title = "Decrease debt";
  if (action === "deposit") title = "Add collateral";
  if (action === "withdraw") title = "Close position";

  const ASTONE = parseUnits("1", asset?.decimals || 18);
  let parsedAmount = parseUnits("0");
  let positionChanged = false;
  let updatedLeverage = 1;
  let leverageOrCurrent = leverage;
  let editShares = parseUnits("0");
  let editBorrow = parseUnits("0");

  let newSharesUsd = parseUnits("0");
  let newBorrowUsd = parseUnits("0");
  let newHealth = ONE;
  let newLiquidationUsd = parseUnits("0");
  let newLiquidationPercent = parseUnits("0");
  let newLeverage = parseUnits("1");
  let newApy = parseUnits("0");
  let borrowApr = parseUnits("0");

  try {
    if (!pool || !asset) throw new Error("Missing pool or asset");
    parsedAmount = parseUnits(amount || "0", asset.decimals);
    const adjustedPrice = pool.data.price
      .mul(ONE)
      .div(parseUnits("1", asset.decimals));
    const parsedAmountUsd = parsedAmount.mul(adjustedPrice).div(ONE);
    if (parsedAmount.gt("0")) {
      positionChanged = true;
    }

    // Calculate the values to pass to `edit()`
    if (position) {
      if (action === "borrow") {
        editBorrow = parsedAmount;
      }
      if (action === "repay") {
        editBorrow = parsedAmount.mul(ONE).div(pool.data.index).mul(-1);
        if (parsedAmount.eq(position.borrowAst)) {
          editBorrow = position.borrow.mul(-1);
        }
        editShares = position.shares
          .mul(editBorrow.mul(pool.data.index).div(ONE))
          .div(position.sharesAst)
          .mul(101)
          .div(100);
      }
      if (action === "deposit") {
        editShares = parsedAmount;
      }
      if (action === "withdraw") {
        editShares = position.shares
          .mul(parsedAmount)
          .div(position.sharesAst)
          .mul(-1);
        const max = position.sharesAst.sub(position.borrowAst);
        if (parsedAmount.eq(max)) {
          editShares = position.shares.mul(-1);
          editBorrow = position.borrow.mul(-1);
        }
      }

      let newBorrowAst = position.borrowAst;
      let newSharesAst = position.sharesAst;
      if (editShares.gt(0)) {
        newSharesAst = newSharesAst.add(editShares);
      }
      if (editShares.lt(0)) {
        newSharesAst = position.shares
          .add(editShares)
          .mul(position.sharesAst)
          .div(position.shares);
      }
      if (editBorrow.gt(0)) {
        newSharesAst = newSharesAst.add(editBorrow);
        newBorrowAst = newBorrowAst.add(editBorrow);
      }
      if (editBorrow.lt(0)) {
        newBorrowAst = newBorrowAst.add(
          editBorrow.mul(pool.data.index).div(ONE)
        );
      }
      if (editShares.eq(position.shares.mul(-1))) {
        newSharesAst = parseUnits("0");
      }
      newSharesUsd = newSharesAst.mul(pool.data.price).div(ASTONE);
      newBorrowUsd = newBorrowAst.mul(pool.data.price).div(ASTONE);

      if (newBorrowUsd.gt(0) && newSharesUsd.sub(newBorrowUsd).gt(0)) {
        updatedLeverage =
          newBorrowUsd
            .mul(1000)
            .div(newSharesUsd.sub(newBorrowUsd))
            .toNumber() /
            1000 +
          1;
        if (updatedLeverage < 1) updatedLeverage = 1;
        if (leverage === 1) leverageOrCurrent = updatedLeverage;
      }
    } else {
      // Calculate the values to pass to `earn()` for a new "deposit"
      editShares = parsedAmount;
      editBorrow = parseUnits(amountBorrow || "0", asset.decimals);
      newSharesUsd = parsedAmount.add(editBorrow).mul(adjustedPrice).div(ONE);
      newBorrowUsd = editBorrow.mul(adjustedPrice).div(ONE);
    }

    if (newBorrowUsd.eq("0") || newSharesUsd.eq("0")) {
      newHealth = ONE;
    } else {
      newHealth = newSharesUsd.mul(95).div(100).mul(ONE).div(newBorrowUsd);
      newLiquidationUsd = newBorrowUsd.mul(100).div(95);
      newLiquidationPercent = ONE.sub(
        newLiquidationUsd.mul(ONE).div(newSharesUsd)
      );
      newLeverage = newBorrowUsd
        .mul(ONE)
        .div(newSharesUsd.sub(newBorrowUsd))
        .add(ONE);
      borrowApr = pool.data.rate.mul(YEAR).mul(newLeverage.sub(ONE)).div(ONE);
    }

    if (llamaPool) {
      newApy = parseUnits((llamaPool.apy / 100).toFixed(6), 18);
      newApy = newApy.mul(newLeverage).div(ONE).sub(borrowApr);
    }
  } catch (e) {
    console.error("calc", e);
  }
  const leverageCap = updatedLeverage;
  const leverageMin = position && action == "deposit" ? leverageCap : "1";
  const leverageMax = position && action == "withdraw" ? leverageCap : "10";
  const assetAllowanceOk = !data
    ? false
    : parsedAmount.gt(0)
    ? data.assetAllowance.gte(parsedAmount)
    : data.assetAllowance.gt(0);

  function cMouseMove(data) {
    if (!data || !data.activePayload) return;
    chartPosRef.current.innerText = `$${formatNumber(
      parseFloat(data.activePayload[0].payload.pos) +
        parseFloat(data.activePayload[0].payload.bor)
    )}`;
    chartBorRef.current.innerText = `$${formatNumber(
      parseFloat(data.activePayload[0].payload.bor)
    )}`;
    chartDateRef.current.innerText = formatChartDate(
      data.activePayload[0].payload.date
    );
  }

  function cMouseOut() {
    chartDateRef.current.innerText = chartDate;
    chartPosRef.current.innerText = chartPos;
    chartBorRef.current.innerText = chartBor;
  }

  async function fetchData() {
    if (!contracts || !address || !pool) return;
    const poolContract = contracts.pool(pool.info.address);
    const assetContract = contracts.asset(pool.info.asset);
    const data = {
      borrowRate: pool.data.rate,
      borrowMin: await poolContract.borrowMin(),
      borrowAvailable: pool.data.supply.sub(pool.data.borrow),
      assetBalance: await assetContract.balanceOf(address),
      assetAllowance: await assetContract.allowance(
        address,
        contracts.positionManager.address
      ),
    };
    setData(data);
  }

  async function fetchChartData() {
    if (!position) return;

    const histories = await (
      await fetch(
        `/api/positions/history?chain=${chainId}&index=${position.id}&interval=hour&length=168`
      )
    ).json();

    setChartData(
      histories.map((h, index) => {
        const pos = parseFloat(formatUnits(h.shares_value, 18));
        const priceAdjusted = parseUnits(h.price, 0)
          .mul(ONE)
          .div(parseUnits("1", asset.decimals));
        const bor = parseFloat(
          formatUnits(parseUnits(h.borrow_value, 0).mul(priceAdjusted).div(ONE))
        );

        return {
          date: new Date(h.t),
          pos: pos - bor,
          bor: bor,
        };
      })
    );
  }

  async function fetchEvents() {
    if (!position) {
      return;
    }

    setPosEvents(
      (
        await (
          await fetch(
            `/api/positions/events?chain=${chainId}&index=${position.id}`
          )
        ).json()
      ).slice(0, 50)
    );
  }

  async function updatePosUrl() {
    if (!position) {
      const ids = await tokensOfOwner(
        signer,
        contracts.positionManager.address,
        address
      );
      ids.sort((a, b) => parseInt(b) - parseInt(a));

      if (ids.length > 0 && parseInt(ids[0]) !== latestPosId) {
        router.push(`/farm/${strategy?.slug}/${ids[0]}`, undefined, {
          shallow: true,
        });
      }
    }
  }

  useEffect(() => {
    fetchData().then(
      () => {},
      (e) => console.error("fetch", e)
    );
  }, [networkName, address, pool]);

  useEffect(() => {
    fetchChartData().then(
      () => {},
      (e) => console.error("fetch chart data", e)
    );
    fetchEvents().then(
      () => {},
      (e) => console.error("fetch events", e)
    );
  }, [positions]);

  const useOutsideClick = (callback) => {
    const ref = useRef();

    useEffect(() => {
      const handleClick = (event) => {
        if (ref.current && !ref.current.contains(event.target)) {
          callback();
        }
      };

      document.addEventListener("click", handleClick);

      return () => {
        document.removeEventListener("click", handleClick);
      };
    }, [ref, slipModal]);

    return ref;
  };

  const slipRef = useOutsideClick(() => {
    if (slipModal) {
      setSlipModal(false);
    }
  });

  function adjustLeverage(value) {
    value = parseFloat(value);
    if (Number.isNaN(value)) return;
    value = Math.min(Math.max(value, leverageMin), leverageMax);
    setLeverage(value);
  }

  async function onApprove() {
    if (walletStatus === "disconnected") {
      openConnectModal();
      return;
    }
    setError("");
    try {
      await checkWhitelist(signer, address);
      setLoading(true);
      const assetContract = contracts.asset(pool.info.asset);

      const call = await assetContract.approve(
        contracts.positionManager.address,
        ethers.constants.MaxUint256
      );
      await runTransaction(
        call,
        "Transaction is pending approval...",
        "Approval completed.",
        false,
        networkName
      );
      setTimeout(fetchData, 1000);
    } catch (e) {
      console.error(e);
      setError(formatError(e.message));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit() {
    if (walletStatus === "disconnected") {
      openConnectModal();
      return;
    }
    setError("");
    try {
      // TODO remove after alpha
      await checkWhitelist(signer, address);
      if (
        !position &&
        (parsedAmount.lt(parseUnits("10", asset.decimals)) ||
          parsedAmount.gt(parseUnits("10000", asset.decimals)))
      ) {
        throw new Error(
          "During BETA, amount needs to be between $10 and $10000"
        );
      }

      setLoading(true);
      if (!position && !editBorrow.eq("0") && editBorrow.lt(data.borrowMin)) {
        throw new Error(
          `Borrow below minimum (${formatNumber(
            data.borrowMin,
            asset.decimals
          )})`
        );
      }
      if (!position && editBorrow.gt(data.borrowAvailable)) {
        throw new Error("Borrow larger than available for lending");
      }
      if (newLeverage.gt(5)) {
        throw new Error("Maximum leverage is 5x, reduce borrowed amount");
      }
      if (newHealth.lt(ONE)) {
        throw new Error("Health needs to stay above 1");
      }
      if (
        (!action || action === "deposit") &&
        parsedAmount.gt(data.assetBalance)
      ) {
        throw new Error("Error not enough funds in wallet");
      }

      const actualSlippage = parseInt(parseFloat(slippage) * 100);
      if (actualSlippage < 0) {
        throw new Error("Slippage must be greater than 0");
      }
      if (actualSlippage > 500) {
        throw new Error("Slippage must be less than or equal to 5");
      }

      if (editBorrow.gt(0) && editShares.eq(0)) {
        editShares = parseUnits("1", 0);
      }
      const callData = actualSlippage
        ? ethers.utils.defaultAbiCoder.encode(["uint256"], [actualSlippage])
        : "0x";
      let call;
      if (!position) {
        call = contracts.positionManager.mint(
          address,
          pool.info.address,
          strategy.index,
          parsedAmount,
          editBorrow,
          callData
        );
        await runTransaction(
          call,
          "New position deposit is awaiting confirmation on chain...",
          "Deposit completed.",
          true,
          networkName
        );
        const index = (await contracts.investor.nextPosition()).toNumber() - 1;
        router.push(`/farm/${strategy.slug}/${index}`);
      } else {
        call = contracts.positionManager.edit(
          position.id,
          editShares,
          editBorrow,
          callData
        );
        await runTransaction(
          call,
          "Position update is awaiting confirmation on chain...",
          "Position update completed.",
          true,
          networkName
        );
        if (editShares.eq(position.shares.mul(-1))) {
          router.push(`/farm/${strategy.slug}`);
        }
      }
      setAction("");
      setAmount("");
      setTimeout(async () => {
        //updatePosUrl();
        fetchData();
        positionsRefetch();
      }, 2000);
      setTimeout(() => {
        //updatePosUrl();
        fetchData();
        positionsRefetch();
      }, 10000);
    } catch (e) {
      console.error(e);
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip wide">
          <p className="label-value">
            <span>Position </span>{" "}
            {`$${formatNumber(
              parseFloat(payload[1].value) + parseFloat(payload[0].value)
            )}`}
          </p>
          <p className="label-value">
            <span>Borrowed </span>{" "}
            {`$${formatNumber(parseFloat(payload[0].value))}`}
          </p>
          <p className="label-date text-faded">
            {formatChartDate(payload[0].payload.date)}
          </p>
        </div>
      );
    }

    return null;
  };

  function renderActions() {
    const actions = [
      {
        id: "borrow",
        icon: "dollars-in",
        name: "Borrow more",
        description:
          "Take out more leverage against your collateral if your health factor is good",
      },
      {
        id: "repay",
        icon: "dollars-out",
        name: "Decrease debt",
        description:
          "Pay back a portion of borrowed funds to improve your position health",
      },
      {
        id: "deposit",
        icon: "dollars-bills",
        name: "Add collateral",
        description: "Deposit more collateral to improve your position health",
      },
      {
        id: "withdraw",
        icon: "dollars-wallet",
        name: "Close position",
        description:
          "Withdraw collateral and yield, and pay back borrowed funds and fees",
      },
    ];
    return (
      <>
        {actions.map((a) => (
          <a
            key={a.id}
            className="position-action"
            onClick={() => setAction(a.id)}
          >
            <span className="position-action-icon">
              <Icon name={a.icon} />
            </span>
            <span className="position-action-info">
              <span className="position-action-title">{a.name}</span>
              <span className="position-action-desc">{a.description}</span>
            </span>
            <span className="position-action-arrow">
              <Icon name="chevron-right" />
            </span>
          </a>
        ))}
      </>
    );
  }

  function renderForm() {
    switch (action) {
      case "borrow":
        return renderFormBorrow();
      case "repay":
        return renderFormRepay();
      case "deposit":
        return renderFormDeposit();
      case "withdraw":
        return renderFormWithdraw();
      default:
        return renderFormNew();
    }
  }

  function renderFormNew() {
    function setLeverage(value) {
      setAmountBorrow(
        formatNumber(
          parsedAmount.mul(parseUnits(value, 18).sub(ONE)).div(ONE),
          asset.decimals
        ).replaceAll(",", "")
      );
    }
    return (
      <>
        <div className="subtitle">Amount to deposit</div>
        <InputAmount
          amount={amount}
          setAmount={setAmount}
          max={data.assetBalance}
          asset={asset}
          buy
        />
        <div className="subtitle mt-6">Amount to borrow</div>
        <InputAmount
          amount={amountBorrow}
          setAmount={setAmountBorrow}
          max={data.borrowAvailable}
          asset={asset}
        />
        <div className="subtitle mt-6">Leverage</div>
        <InputLeverage
          value={formatNumber(newLeverage)}
          setValue={setLeverage}
        />
      </>
    );
  }

  function renderFormBorrow() {
    function setLeverage(value) {
      let amount = position.sharesAst
        .sub(position.borrowAst)
        .mul(parseUnits(value, 18).sub(ONE))
        .div(ONE)
        .sub(position.borrowAst);
      amount = bnMax(parseUnits("0"), amount);
      console.log(
        formatNumber(amount, 6),
        formatNumber(position.sharesAst, 6),
        formatNumber(position.borrowAst, 6)
      );
      setAmount(formatNumber(amount, asset.decimals).replaceAll(",", ""));
    }
    return (
      <>
        <div className="subtitle">Amount to borrow</div>
        <InputAmount
          amount={amount}
          setAmount={setAmount}
          max={data.borrowAvailable}
          asset={asset}
        />
        <div className="subtitle mt-6">Leverage</div>
        <InputLeverage
          value={formatNumber(newLeverage)}
          setValue={setLeverage}
        />
      </>
    );
  }

  function renderFormRepay() {
    function setLeverage(value) {
      let amount = position.borrowAst.sub(
        position.sharesAst
          .sub(position.borrowAst)
          .mul(parseUnits(value, 18).sub(ONE))
          .div(ONE)
      );
      amount = bnMax(parseUnits("0"), amount);
      setAmount(formatNumber(amount, asset.decimals).replaceAll(",", ""));
    }
    return (
      <>
        <div className="subtitle">Amount to repay</div>
        <InputAmount
          amount={amount}
          setAmount={setAmount}
          max={position.borrowAst}
          asset={asset}
        />
        <div className="subtitle mt-6">Leverage</div>
        <InputLeverage
          value={formatNumber(newLeverage)}
          setValue={setLeverage}
        />
      </>
    );
  }

  function renderFormDeposit() {
    return (
      <>
        <div className="subtitle">Amount to deposit</div>
        <InputAmount
          amount={amount}
          setAmount={setAmount}
          max={data.assetBalance}
          asset={asset}
          buy
        />
      </>
    );
  }

  function renderFormWithdraw() {
    return (
      <>
        <div className="subtitle">Amount to withdraw</div>
        <InputAmount
          amount={amount}
          setAmount={setAmount}
          max={position.sharesAst.sub(position.borrowAst)}
          asset={asset}
        />
      </>
    );
  }

  if (!data || !strategy || !pool || !asset) {
    return (
      <Layout title="Position">
        <div>Loading...</div>
      </Layout>
    );
  }
  return (
    <Layout
      title={strategy.name + (position ? ` #${position.id}` : " New Position")}
    >
      <div className="mb-8">
        <Link href={"/farm"}>
          <a className="button button-primary button-link mr-4">
            Back to farms
          </a>
        </Link>
        <Link href={`/farm/${strategy?.slug}`}>
          <a className="button button-primary button-link mr-4">
            Back to farm information
          </a>
        </Link>
      </div>
      <div className="warning" style={{ fontSize: 14 }}>
        <div className="mb-2">
          <b>Warning:</b> Farm performances depend on several factors. The
          fees/yield it collects will increase it&apos;s value. The underlying
          asset it uses (e.g. ETH, DPX, GMX) can go up or down in value. The
          borrowing interest rate can also fluctuate.
        </div>
        <div>
          Please read our{" "}
          <a
            href="https://docs.rodeofinance.xyz/"
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>{" "}
          and{" "}
          <a
            href="https://docs.rodeofinance.xyz/other/faq"
            target="_blank"
            rel="noreferrer"
          >
            FAQ
          </a>{" "}
          to understand how the farms work before using them.
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div>
          <div>
            <div className="title">Position Information</div>
            <div className="card mb-8">
              <div className="">
                <div className="position-row">
                  <div className="label-position">Position value:</div>${" "}
                  {position ? formatNumber(position.sharesUsd) : "0.00"}
                  {positionChanged
                    ? " → $ " + formatNumber(newSharesUsd)
                    : null}
                </div>
                <div className="position-row">
                  <div className="label-position">Debt value:</div>${" "}
                  {position ? formatNumber(position.borrowUsd) : "0.00"}
                  {positionChanged
                    ? " → $ " + formatNumber(newBorrowUsd)
                    : null}
                </div>
                <div className="position-row">
                  <div className="label-position">Health:</div>
                  {position
                    ? position.health.eq(ONE)
                      ? "∞"
                      : formatNumber(position.health)
                    : "0.00"}
                  {positionChanged ? (
                    <>
                      {" → "}
                      {newHealth.eq(ONE) ? "∞" : formatNumber(newHealth)}
                    </>
                  ) : null}
                </div>
                <div className="position-row">
                  <div className="label-position">Liquidation:</div>${" "}
                  {formatNumber(position?.liquidationUsd || 0, 18, 1)} (
                  {formatNumber(position?.liquidationPercent || 0, 16, 0)}%)
                  {positionChanged ? (
                    <>
                      {" "}
                      → {formatNumber(newLiquidationUsd, 18, 1)} (
                      {formatNumber(newLiquidationPercent, 16, 0)}%)
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="title">{title}</div>
            {position && !action ? (
              renderActions()
            ) : (
              <div>
                <div className="card mb-4">
                  {error ? (
                    <div className="error mb-2">
                      {error}{" "}
                      {error.includes("Green Horn NFT") ? (
                        <a
                          style={{ color: "white", opacity: "0.8" }}
                          href="https://medium.com/@Rodeo_Finance/introducing-the-rodeo-bull-club-unlock-exclusive-access-to-rodeo-farms-perks-nfts-wl-and-more-5c4905ad3daa"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Link to guide
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  {renderForm()}
                </div>
                <div className="flex">
                  <button
                    className="button button-link button-primary"
                    onClick={() => setAction("")}
                  >
                    Back
                  </button>
                  <div className="flex-1"></div>
                  <button
                    className="button"
                    onClick={!assetAllowanceOk ? onApprove : onSubmit}
                    disabled={loading}
                  >
                    {loading
                      ? "Loading..."
                      : !assetAllowanceOk
                      ? "Approve " + asset.symbol
                      : position
                      ? "Adjust position"
                      : "Open position"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="title">Farm Information</div>
          <div className="card mb-4">
            <div className="farm-row mb-6">
              <div className="label-position">Protocol</div>
              {strategy.protocol}
            </div>
            <div className="farm-row mb-6">
              <div className="label-position">TVL</div>
              {formatNumber(llamaPool ? llamaPool.tvl / 1e6 : 0, 0, 1)} M
            </div>
            <div className="farm-row mb-6">
              <div className="label-position">Position Health</div>
              <div className="w-full">
                <PositionTrack
                  value={formatNumber(newHealth)}
                  className="mb-2"
                />
                <div className="position-health flex">
                  <div>
                    <span className="position-health__text">
                      Current value:{" "}
                    </span>
                    <span className="position-health__current">
                      ${" "}
                      {positionChanged
                        ? formatNumber(newSharesUsd)
                        : position
                        ? formatNumber(position.sharesUsd)
                        : "0.00"}
                    </span>
                  </div>
                  <div>
                    <span className="position-health__text">Liquidation: </span>
                    <span className="position-health__liquidation">
                      ${" "}
                      {positionChanged
                        ? formatNumber(newLiquidationUsd, 18, 1)
                        : formatNumber(position?.liquidationUsd || 0, 18, 1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="farm-row mb-6">
              <div className="label-position">Farm APR</div>
              {formatNumber(newApy.add(borrowApr), 16)}%
            </div>
            <div className="farm-row mb-6">
              <div className="label-position">Borrow APR</div>
              {formatNumber(borrowApr.mul(-1), 16, 1)}%
            </div>
            <div className="farm-row mb-6">
              <div className="label-position">Net APR</div>
              {formatNumber(newApy, 16)}%
            </div>
            <div className="farm-row mb-6">
              <div className="label-position">Daily</div>
              {formatNumber(newApy.div(365), 16, 4)}%
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function InputAmount({ amount, setAmount, max, asset, decimals, buy }) {
  decimals = decimals || asset.decimals;
  function onSet(percent) {
    setAmount(formatUnits(max.mul(percent).div(100), decimals));
  }
  return (
    <div>
      <div className="flex">
        <div className="flex-1 mb-2">
          Available: {formatNumber(max, decimals)} {asset.symbol}
        </div>
        {buy ? (
          <a
            href={`https://app.1inch.io/#/42161/simple/swap/eth/${asset.symbol.toLowerCase()}`}
            target="_blank"
            rel="noreferrer"
          >
            Purchase {asset.symbol} <Icon name="external-link" small />
          </a>
        ) : null}
      </div>
      <div className="mb-2">
        <Input
          value={amount}
          onInput={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          icon={asset.icon}
          onMax={onSet.bind(null, 100)}
        />
      </div>
      <div className="flex">
        <button
          className="button button-primary button-link flex-1 mr-2"
          onClick={onSet.bind(null, 25)}
        >
          25%
        </button>
        <button
          className="button button-primary button-link flex-1 mr-2"
          onClick={onSet.bind(null, 50)}
        >
          50%
        </button>
        <button
          className="button button-primary button-link flex-1 mr-2"
          onClick={onSet.bind(null, 75)}
        >
          75%
        </button>
        <button
          className="button button-primary button-link flex-1"
          onClick={onSet.bind(null, 100)}
        >
          100%
        </button>
      </div>
    </div>
  );
}

function InputLeverage({ value, setValue }) {
  return (
    <div>
      <div className="grid-2" style={{ gridTemplateColumns: "1fr 90px" }}>
        <div className="flex mb-4">
          <DiscreteSliders
            className="w-full"
            min={1}
            max={5}
            value={value}
            range={5}
            onInput={setValue}
          />
        </div>
        <input
          className="input mb-2"
          type="number"
          style={{ width: 90, textAlign: "right" }}
          value={value}
          onInput={(e) => setValue(e.target.value)}
          placeholder="0.00"
          align="right"
        />
      </div>
    </div>
  );
}
