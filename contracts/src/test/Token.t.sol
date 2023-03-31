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
        vm.expectRevert(Token.NoMintAddress.selector);
        token.emissionMint();

        token.setEmissionsRecipient(address(this));
        vm.expectEmit(true, true, false, false);
        emit Mint(address(this), 0);
        token.emissionMint();        

        // NOTE: emissionRate 1%, decayRate 5%
        token.setEmissions(1e16, 5e16);
        vm.warp(block.timestamp + 86400);

        // decaypercent: 86400 * 5e16 / 604800 = 7.1418571e15
        // lastAmtPerWeek: 1000 * (1e18-decayPercent) / 1e18 = 992
        // amtToMint: 86400 * lastAmtPerWeek / 604800
        vm.expectEmit(true, true, false, false);
        emit Mint(address(this), 141);
        token.emissionMint();

        vm.warp(block.timestamp + 86400);
        vm.expectEmit(true, true, true, true);
        emit Mint(address(this), 140);
        token.emissionMint();
    }
}