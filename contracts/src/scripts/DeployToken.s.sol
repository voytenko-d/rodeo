// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {DSTest} from "../test/utils/DSTest.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

contract DeployToken is DSTest {
    function run() external {
        vm.startBroadcast();
        new MockERC20(6);
        vm.stopBroadcast();
    }
}
