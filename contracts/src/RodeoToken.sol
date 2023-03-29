// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20Permit} from "./ERC20Permit.sol";
import {ERC20} from "./ERC20.sol";
import {Util} from "./Util.sol";

contract Token is ERC20, ERC20Permit, Util {
    struct WhiteList {
        address usr;
        uint256 amt;
    }

    uint64 public emissionRate; // percentage value
    uint64 public MAX_BPS = 10_000;

    uint64 public lastMintTime;
    uint64 public decayPerWeek;
    address public emissionsRecipient;

    event Mint(address indexed dst, uint256 amt);
    event SetWeeklySupply(address indexed owner, uint64 amt, uint64 decay);
    event SetMintAddr(address indexed owner, address newMintAddr);

    error NoMintAddress();

    constructor(uint256 _initialSupply) ERC20("Token", "TOKEN", 18) ERC20Permit("Token") {
        exec[msg.sender] = true;
        _mint(msg.sender, _initialSupply);
    }

    function mint() external {
        if (emissionsRecipient == address(0)) {
            revert NoMintAddress();
        }

        uint256 decayPercent = (block.timestamp - lastMintTime) * decayPerWeek / 604800;
        uint256 weeklyAmt = totalSupply * uint256(emissionRate) / MAX_BPS;
        uint256 currentWeekAmt = weeklyAmt * (MAX_BPS - decayPercent) / MAX_BPS;
        uint256 amtToMint = (block.timestamp - lastMintTime) * currentWeekAmt / 604800;

        _mint(emissionsRecipient, amtToMint);
        lastMintTime = uint64(block.timestamp);
        emit Mint(emissionsRecipient, amtToMint);
    }

    function setWeeklySupply(uint64 _emissionRate, uint64 _decayPerWeek) external auth {
        emissionRate = _emissionRate;
        decayPerWeek = _decayPerWeek;
        lastMintTime = uint64(block.timestamp);
        emit SetWeeklySupply(msg.sender, _emissionRate, _decayPerWeek);
    }

    function setMintAddr(address _mintAddr) external auth {
        emissionsRecipient = _mintAddr;
        emit SetMintAddr(msg.sender, _mintAddr);
    }
}
