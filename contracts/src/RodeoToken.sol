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
    event SetEmissionAddr(address indexed owner, address newEmissionAddr);

    error NoMintAddress();

    constructor(uint256 _initialSupply) ERC20("Token", "TOKEN", 18) ERC20Permit("Token") {
        exec[msg.sender] = true;
        _mint(msg.sender, _initialSupply);
    }

    function emissionMint() external {
        if (emissionsRecipient == address(0)) {
            revert NoMintAddress();
        }
        uint256 timeElapsed = block.timestamp - uint256(lastMintTime);
        uint256 decayPercent = timeElapsed / 604800 * decayPerWeek;
        uint256 weeklyAmt = totalSupply * uint256(emissionRate) / MAX_BPS;
        uint256 currentWeekAmt = weeklyAmt * (MAX_BPS - decayPercent) / MAX_BPS;
        uint256 amtToMint = timeElapsed * currentWeekAmt / 604800;

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

    function setEmissiontAddr(address _emissionAddr) external auth {
        emissionsRecipient = _emissionAddr;
        emit SetEmissionAddr(msg.sender, _emissionAddr);
    }
}
