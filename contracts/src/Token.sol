// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20Permit} from "./ERC20.sol";
import {Util} from "./Util.sol";

contract Token is ERC20Permit, Util {
    error NoMintAddress();
    error NoEmissionSent();
    error DeadlineExpired();

    uint256 public emissionRate; // percentage value, 1e18 = 100%
    uint256 public decayPerWeek;
    uint256 public deadline;
    uint256 public weeklyPercent;
    address public emissionsRecipient;

    uint256 public lastMintTime;
    uint256 public lastAmtPerWeek;

    event Mint(address indexed dst, uint256 amt);
    event Configuration(address indexed owr, uint256 rat, uint256 dec, uint256 due);
    event SetWeeklyPercent(uint256 wpc);
    event SetEmissionRecipient(address indexed owr, address emi);

    constructor(uint256 spl) ERC20Permit("Rodeo", "RODEO", 18) {
        exec[msg.sender] = true;
        _mint(msg.sender, spl);
        lastMintTime = block.timestamp;
    }

    function mintEmission() external {
        if (emissionsRecipient == address(0)) {
            revert NoMintAddress();
        }
        if (block.timestamp <= deadline) {
            uint256 timeElapsed = block.timestamp - lastMintTime;
            uint256 decayPercent = timeElapsed * decayPerWeek / 1 weeks;
            lastAmtPerWeek = lastAmtPerWeek * (1e18 - decayPercent) / 1e18;
            uint amtToMint = timeElapsed * lastAmtPerWeek / 1 weeks;
            _mint(emissionsRecipient, amtToMint);
            lastMintTime = block.timestamp;
            emit Mint(emissionsRecipient, amtToMint);
        } else {
            uint256 amt = totalSupply * weeklyPercent * (block.timestamp - lastMintTime) / 1e18 / 1 weeks;
            lastMintTime = block.timestamp;
            _mint(emissionsRecipient, amt);
            emit Mint(emissionsRecipient, amt);
        }
    }

    function configure(uint256 _emissionRate, uint256 _decayPerWeek, uint256 _deadline) external auth {
        lastAmtPerWeek = _emissionRate;
        decayPerWeek = _decayPerWeek;
        deadline = _deadline;
        emit Configuration(msg.sender, _emissionRate, _decayPerWeek, _deadline);
    }

    function setWeeklyPercent(uint256 _weeklyPercent) external auth {
        if (deadline < block.timestamp) {
            revert DeadlineExpired();
        }
        weeklyPercent = _weeklyPercent;
        emit SetWeeklyPercent(_weeklyPercent);
    }

    function setEmissionsRecipient(address emi) external auth {
        emissionsRecipient = emi;
        emit SetEmissionRecipient(msg.sender, emi);
    }
}
