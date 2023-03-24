// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IERC677Receiver {
  function onTokenTransfer(
    address sender,
    uint value,
    bytes memory data
  )
    external;
}