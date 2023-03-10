// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {DSTest} from "./utils/DSTest.sol";
import {OracleUniswapV2} from "../OracleUniswapV2.sol";

contract OracleUniswapV2Test is DSTest {
    OracleUniswapV2 o;

    address public token0;
    address public token1;
    uint256 reserve0 = 10; // weth
    uint256 reserve1 = 500; // token

    function setUp() public {
        token0 = vm.addr(1);
        token1 = vm.addr(2);
        vm.warp(2 hours);
        o = new OracleUniswapV2(address(this), token0, address(this));
    }

    function testLatestAnswer() public {
        assertEq(o.latestAnswer() / 1e16, 2400);
        reserve1 = 600;
        assertEq(o.latestAnswer() / 1e16, 2400);
        vm.warp(block.timestamp + o.updateInterval() + 1);
        o.update();
        assertEq(o.latestAnswer() / 1e16, 2299);
        vm.warp(block.timestamp + o.updateInterval() + 1);
        o.update();
        vm.warp(block.timestamp + o.updateInterval() + 1);
        o.update();
        assertEq(o.latestAnswer() / 1e16, 2099);
        assertEq(o.prices(0), 20000000000000000);
        assertEq(o.prices(1), 16666666666666666);
        assertEq(o.prices(2), 16666666666666666);
        assertEq(o.prices(3), 16666666666666666);
        vm.warp(block.timestamp + (3 * o.updateInterval()));
        vm.expectRevert("stale price");
        o.latestAnswer();
    }

    function testLatestAnswerInverted() public {
        o = new OracleUniswapV2(address(this), token1, address(this));
        assertEq(o.latestAnswer() / 1e16, 6000000);
    }

    function getReserves() public view returns (uint256, uint256, uint32) {
        return (reserve0, reserve1, 0);
    }

    function latestAnswer() public pure returns (int256) {
        return 1200e8;
    }

    function decimals() public pure returns (uint8) {
        return 8;
    }
}
