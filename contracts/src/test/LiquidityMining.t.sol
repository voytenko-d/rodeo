// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {Test} from "./utils/Test.sol";
import {LiquidityMining} from "../LiquidityMining.sol";
import {ERC20} from "../ERC20.sol";

contract LiquidityMiningTest is Test {
    LiquidityMining c;

    function setUp() public override {
        super.setUp();
        c = new LiquidityMining();
        c.file("rewardPerDay", 1000e18);
        c.poolAdd(6000, address(usdcPool));
        c.poolAdd(4000, address(wethPool));
        usdc.approve(address(usdcPool), 100e6);
        usdcPool.mint(100e6, address(this));
        usdcPool.approve(address(c), 60e6);
        vm.warp(block.timestamp+3600);
    }

    function testInfo() public {
        assertEq(c.poolLength(), 2);
        assertEq(c.totalAllocPoint(), 10000);
    }

    function testFile() public {
        c.file("rewardPerDay", 123);
        assertEq(c.rewardPerDay(), 123);
        c.file("rewardToken", vm.addr(1));
        assertEq(address(c.rewardToken()), vm.addr(1));
        c.file("exec", vm.addr(2));
        assertTrue(c.exec(vm.addr(2)));
        c.file("exec", vm.addr(2));
        assertTrue(!c.exec(vm.addr(2)));
    }

    function testConfigure() public {
        c.poolAdd(1000, address(usdc));
        assertEq(c.poolLength(), 3);
        assertEq(c.totalAllocPoint(), 11000);
        assertEq(address(c.token(2)), address(usdc));
        (uint128 accRewardPerShare, uint64 lastRewardTime, uint64 allocPoint) = c.poolInfo(2);
        assertEq(accRewardPerShare, 0);
        assertEq(lastRewardTime, block.timestamp);
        assertEq(allocPoint, 1000);
        c.poolSet(2, 2000);
        (,, allocPoint) = c.poolInfo(2);
        assertEq(allocPoint, 2000);
        assertEq(c.totalAllocPoint(), 12000);
    }

    function testDeposit() public {
        c.deposit(0, 50e6, address(this), 0);
        (uint256 amount, int256 rewardDebt,) = c.userInfo(0, address(this));
        assertEq(amount, 50e6);
        assertEq(rewardDebt, 25e18);
        vm.warp(block.timestamp+3600);
        c.deposit(0, 10e6, address(this), 0);
        (amount, rewardDebt, ) = c.userInfo(0, address(this));
        assertEq(amount, 60e6);
        assertEq(rewardDebt, 34166666666666666666);
    }

    function testWithdraw() public {
        c.deposit(0, 10e6, address(this), 0);
        uint256 before = usdcPool.balanceOf(address(this));
        c.withdraw(0, 4e6, address(this));
        (uint256 amount, int256 rewardDebt,) = c.userInfo(0, address(this));
        assertEq(amount, 6e6);
        assertEq(rewardDebt, 15e18);
        assertEq(usdcPool.balanceOf(address(this))-before, 4e6);
        c.withdraw(0, 1e6, address(this));
        vm.expectRevert();
        c.withdraw(0, 10e6, address(this));
    }

    function testEmergencyWithdraw() public {
        c.deposit(0, 10e6, address(this), 0);
        uint256 before = usdcPool.balanceOf(address(this));
        c.emergencyWithdraw(0, address(this));
        (uint256 amount, int256 rewardDebt,) = c.userInfo(0, address(this));
        assertEq(amount, 0);
        assertEq(rewardDebt, 0);
        assertEq(usdcPool.balanceOf(address(this))-before, 10e6);
    }

    function testHarvest() public {
        c.file("rewardToken", address(weth));
        weth.transfer(address(c), 100e18);
        c.deposit(0, 50e6, address(this), 0);
        vm.warp(block.timestamp+3600);
        uint256 before = weth.balanceOf(address(this));
        c.harvest(0, address(this));
        (uint256 amount, int256 rewardDebt,) = c.userInfo(0, address(this));
        assertEq(amount, 50e6);
        assertEq(rewardDebt, 50e18);
        assertEq(weth.balanceOf(address(this)) - before, 25e18);
    }
}
