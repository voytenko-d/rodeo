// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {Token} from "../RodeoToken.sol";
import {Test} from "./utils/Test.sol";
import {console} from "./utils/console.sol";

contract TokenTest is Test {
    Token token;
    uint256 public constant initialSupply = 100_000;
    event Mint(address indexed dst, uint256 amt);

    function setUp() public override {
        super.setUp();
        token = new Token(100_000);
    }

    function testMint() public {
        token.setEmissionsRecipient(address(this));

        // NOTE: emissionRate 1000, decayRate 5%
        token.setEmissions(1000, 5e16, block.timestamp + 604800*5, 1e16);
        token.activate();
        vm.warp(block.timestamp + 86400);

        uint balanceBefore = token.balanceOf(address(this));
        // decaypercent: 86400 * 5e16 / 604800 = 7.1418571e15
        // lastAmtPerWeek: 1000 * (1e18-decayPercent) / 1e18 = 992
        // amtToMint: 86400 * lastAmtPerWeek / 604800
        vm.expectEmit(true, true, false, false);
        emit Mint(address(this), 141);
        token.emissionMint();
        uint balanceAfter = token.balanceOf(address(this));
        assertEq(balanceAfter - balanceBefore, 141);

        vm.warp(block.timestamp + 86400);
        balanceBefore = token.balanceOf(address(this));
        vm.expectEmit(true, true, true, true);
        emit Mint(address(this), 140);
        token.emissionMint();
        balanceAfter = token.balanceOf(address(this));
        assertEq(balanceAfter - balanceBefore, 140);

        vm.warp(block.timestamp + 604800*7);
        uint tokenToBeMinted = token.totalSupply() / 100;
        balanceBefore = token.balanceOf(address(this));
        vm.expectEmit(true, true, false, false);
        emit Mint(address(this), tokenToBeMinted);
        token.emissionMint();
        balanceAfter = token.balanceOf(address(this));
        assertEq(balanceAfter - balanceBefore, tokenToBeMinted);
    }
}