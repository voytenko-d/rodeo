// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/*
import {DSTest} from "../test/utils/DSTest.sol";
import {Investor} from "../Investor.sol";
import {InvestorHelper} from "../InvestorHelper.sol";
import {PositionManager} from "../PositionManager.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";
import {MockOracle} from "../test/mocks/MockOracle.sol";
import {IERC20} from "../interfaces/IERC20.sol";
import {PositionManager} from "../PositionManager.sol";
import {StrategySushiswap} from "../StrategySushiswap.sol";
import {LiquidationHelper} from "../LiquidationHelper.sol";
import {UniswapV2Factory} from "../test/vendor/sushiswap/uniswapv2/UniswapV2Factory.sol";
import {UniswapV2Router02} from "../test/vendor/sushiswap/uniswapv2/UniswapV2Router02.sol";
import {UniswapV2Pair} from "../test/vendor/sushiswap/uniswapv2/UniswapV2Pair.sol";
import {MiniChefV2} from "../test/vendor/sushiswap/MiniChefV2.sol";
import {IRewarder} from "../test/vendor/sushiswap/interfaces/IRewarder.sol";
import {IERC20 as ssIERC20} from "../test/vendor/sushiswap/boringcrypto/IERC20.sol";

contract DeployLiqTest is DSTest {
    MockERC20 usdc;
    MockERC20 weth;
    MockERC20 sushi;
    MockOracle oUsdc;
    MockOracle oWeth;
    MockOracle oSushi;
    UniswapV2Factory univ2Factory;
    UniswapV2Router02 univ2Router;
    UniswapV2Pair univ2PairWethUsdc;
    UniswapV2Pair univ2PairWethSushi;
    MiniChefV2 sushiMiniChef;
    Investor i;
    InvestorHelper ih;
    PositionManager pm;
    StrategySushiswap ss;
    LiquidationHelper lh;

    function run() external {
        address a = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        address b = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        address c = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
        vm.startBroadcast();

        usdc = new MockERC20(6);
        weth = new MockERC20(18);
        sushi = new MockERC20(18);

        // Mock chainlink oracles
        oUsdc = new MockOracle(1e8);
        oWeth = new MockOracle(1650e8);
        oSushi = new MockOracle(7e8);

        address o0;
        address o1;
        address[] memory path0;
        address[] memory path1;
        address[] memory rewardPath0;
        address[] memory rewardPath1;
        if (address(weth) < address(usdc)) {
            o0 = address(oWeth);
            o1 = address(oUsdc);
            path0 = new address[](2);
            path0[0] = address(usdc);
            path0[1] = address(weth);
            rewardPath0 = new address[](2);
            rewardPath0[0] = address(sushi);
            rewardPath0[1] = address(weth);
            rewardPath1 = new address[](3);
            rewardPath1[0] = address(sushi);
            rewardPath1[1] = address(weth);
            rewardPath1[2] = address(usdc);
        } else {
            o0 = address(oUsdc);
            o1 = address(oWeth);
            path1 = new address[](2);
            path1[0] = address(usdc);
            path1[1] = address(weth);
            rewardPath0 = new address[](3);
            rewardPath0[0] = address(sushi);
            rewardPath0[1] = address(weth);
            rewardPath0[2] = address(usdc);
            rewardPath1 = new address[](2);
            rewardPath1[0] = address(sushi);
            rewardPath1[1] = address(weth);
        }

        // deploy uniswapv2
        univ2Factory = new UniswapV2Factory(a);
        univ2Router = new UniswapV2Router02(address(univ2Factory), address(weth));
        univ2PairWethUsdc = UniswapV2Pair(univ2Factory.createPair(address(weth), address(usdc)));
        univ2PairWethSushi = UniswapV2Pair(univ2Factory.createPair(address(weth), address(sushi)));

        // add liquidity to weth/usdc
        weth.mint(a, 1000e18);
        usdc.mint(a, 1650000e6);
        weth.transfer(address(univ2PairWethUsdc), 1000e18);
        usdc.transfer(address(univ2PairWethUsdc), 1650000e6);
        univ2PairWethUsdc.mint(a);

        // add liquidity to weth/sushi
        weth.mint(a, 1000e18);
        sushi.mint(a, 7000e18);
        weth.transfer(address(univ2PairWethSushi), 1000e18);
        sushi.transfer(address(univ2PairWethSushi), 7000e18);
        univ2PairWethSushi.mint(a);

        // deploy sushiswap
        sushiMiniChef = new MiniChefV2(ssIERC20(address(sushi)));
        sushiMiniChef.add(100, ssIERC20(address(univ2PairWethUsdc)), IRewarder(address(0)));

        // deploy rodeo
        i = new Rodeo();
        ih = new InvestorHelper(address(i));
        pm = new PositionManager(address(i));
        ss =
        new StrategySushiswap(address(usdc), address(i), "SS WETH/USDC", address(sushiMiniChef), address(univ2Router), 0, path0, path1, rewardPath0, rewardPath1);
        ss.file2("oracleToken0", address(o0));
        ss.file2("oracleToken1", address(o1));
        ss.file2("oracleReward", address(oSushi));
        i.file("strategies", address(ss));

        ih = new InvestorHelper(address(i));

        // begin lend and borrow
        usdc.mint(a, 800e6);
        usdc.approve(address(i), 750e6);
        usdc.approve(address(pm), 150e6);

        // lend
        i.mint(a, 500e6);

        // borrow
        pm.mint(a, address(ss), 50e6, 150e6);
        pm.mint(b, address(ss), 60e6, 180e6);
        pm.mint(c, address(ss), 40e6, 0);

        vm.stopBroadcast();

        // emit log_named_address("Token", address(t));
        emit log_named_address("Rodeo", address(r));
        emit log_named_address("InvestorPeek", address(ip));
        emit log_named_address("PositionManager", address(pm));
        emit log_named_address("StrategySushiswap", address(ss));
        emit log_named_address("LiqHelper", address(lh));
        emit log_named_address("EthOracle", address(oWeth));
        emit log_named_address("Asset", address(usdc));
    }
}*/
