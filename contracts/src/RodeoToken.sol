// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20Permit} from "./ERC20.sol";
import {Util} from "./Util.sol";

contract Token is ERC20Permit, Util {
    error NoMintAddress();
    error NoEmissionSent();
    error NotPaused();
    error NotTimeYet(uint256 waitToMint);

    uint256 public emissionRate; // percentage value, 1e18 = 100%

    uint256 public lastMintTime;
    uint256 public decayPerWeek;
    uint256 public lastAmtPerWeek;
    uint256 public deadline;
    uint256 public weeklyPercent;
    address public emissionsRecipient;

    event Mint(address indexed dst, uint256 amt);
    event SetEmissions(address indexed owr, uint256 amt, uint256 dec);
    event SetEmissionRecipient(address indexed owr, address emi);

    constructor(uint256 spl) ERC20Permit("Rodeo", "RODEO", 18) {
        exec[msg.sender] = true;
        _mint(msg.sender, spl);
        paused = true;
    }

    function emissionMint() external live {
        if (emissionsRecipient == address(0)) {
            revert NoMintAddress();
        }
        if (block.timestamp <= deadline) {
            uint256 timeElapsed = block.timestamp - lastMintTime;
            uint256 decayPercent = timeElapsed * decayPerWeek / 604800;
            lastAmtPerWeek = lastAmtPerWeek * (1e18 - decayPercent) / 1e18;
            uint amtToMint = timeElapsed * lastAmtPerWeek / 604800;
            _mint(emissionsRecipient, amtToMint);
            lastMintTime = block.timestamp;
            emit Mint(emissionsRecipient, amtToMint);
        } else {
            if (lastMintTime + 1 weeks > block.timestamp) {
                revert NotTimeYet(lastMintTime + 1 weeks - block.timestamp);
            }
            uint256 amtToMint = totalSupply * weeklyPercent / 1e18;
            _mint(emissionsRecipient, amtToMint);
            lastMintTime = block.timestamp;
            emit Mint(emissionsRecipient, amtToMint);
        }
    }

    function setEmissions(uint256 _emissionRate, uint256 _decayPerWeek, uint256 _deadline, uint256 _weeklyPercent) external auth {
        if (!paused) {
            revert NotPaused();
        }
        lastAmtPerWeek = _emissionRate;
        decayPerWeek = _decayPerWeek;
        deadline = _deadline;
        weeklyPercent = _weeklyPercent;
        emit SetEmissions(msg.sender, _emissionRate, _decayPerWeek);
    }

    function setEmissionsRecipient(address emi) external auth {
        emissionsRecipient = emi;
        emit SetEmissionRecipient(msg.sender, emi);
    }

    function activate() external auth {
        lastMintTime = block.timestamp;
        paused = false;
    }
}
