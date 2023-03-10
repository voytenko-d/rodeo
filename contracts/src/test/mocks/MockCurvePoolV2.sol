// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {IERC20} from "../../interfaces/IERC20.sol";
import {Util} from "../../Util.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockCurvePoolV2 is MockERC20, Util {
    uint256 public constant rate = 1.205e27;
    address[3] public tokens;

    constructor(address wbtc, address weth, address usdc) MockERC20(18) {
        tokens = [wbtc, weth, usdc];
    }

    function token() external view returns (address) {
        return address(this);
    }

    function coins(uint256 i) external view returns (address) {
        return tokens[i];
    }

    function virtual_price() external view returns (uint256) {
        return 1030646228580708495;
    }

    function price_oracle(uint256 i) external view returns (uint256) {
        if (i == 0) return 16000e18;
        if (i == 1) return 1200e18;
        if (i == 2) return 1e18;
        return 0;
    }

    function add_liquidity(uint256[3] calldata amounts, uint256) external {
        pull(IERC20(tokens[2]), msg.sender, amounts[2]);
        mint(msg.sender, amounts[2] * rate / 1e18);
    }

    function remove_liquidity_one_coin(uint256 amount, uint256, uint256) external {
        burn(msg.sender, amount);
        push(IERC20(tokens[2]), msg.sender, amount * 1e18 / rate);
    }
}
