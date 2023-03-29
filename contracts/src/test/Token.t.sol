// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {Token} from "../RodeoToken.sol";
import {Test} from "./utils/Test.sol";
import {console} from "./utils/console.sol";

contract TokenTest is Test {
    Token token;
    uint256 public constant initialSupply = 10_000_000_000;
    event Mint(address indexed dst, uint256 amt);

    function setUp() public override {
        super.setUp();
        token = new Token(10_000_000_000);
    }

    function testMint() public {
        vm.expectRevert(Token.NoMintAddress.selector);
        token.emissionMint();

        token.setEmissiontAddr(address(this));
        vm.expectEmit(true, true, false, false);
        emit Mint(address(this), 0);
        token.emissionMint();        

        // NOTE: emissionRate 1%, decayRate 5%
        token.setWeeklySupply(100, 500);
        vm.warp(block.timestamp + 10000);

        vm.expectEmit(true, true, false, false);
        // 10_000_000_000 / 100 / 604800 * 10000
        emit Mint(address(this), 1653439);
        token.emissionMint();

        vm.warp(block.timestamp + 604800);
        vm.expectEmit(true, true, false, false);
        // weeklyEmissionRate: (10_000_000_000 + 1653439) / 100
        // currentWeekEmissionRate: weeklyEmissionRate * (100-5) / 100
        // amtToMint: currentWeekEmissionRate * 604800 / 604800
        emit Mint(address(this), 95015707);
        token.emissionMint();
    }
}