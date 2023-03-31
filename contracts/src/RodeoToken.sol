// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20Permit} from "./ERC20.sol";
import {Util} from "./Util.sol";

contract Token is ERC20Permit, Util {
    error NoMintAddress();
    error NoEmissionSent();

    uint256 public emissionRate; // percentage value
    uint256 public MAX_BPS = 1e18;

    uint256 public lastMintTime;
    uint256 public decayPerWeek;
    uint256 public lastAmtPerWeek;
    address public emissionsRecipient;

    event Mint(address indexed dst, uint256 amt);
    event SetEmissions(address indexed owr, uint256 amt, uint256 dec);
    event SetEmissionRecipient(address indexed owr, address emi);

    constructor(uint256 _initialSupply) ERC20Permit("Rodeo", "RODEO", 18) {
        exec[msg.sender] = true;
        _mint(msg.sender, _initialSupply);
    }

    function emissionMint() external {
        if (emissionsRecipient == address(0)) {
            revert NoMintAddress();
        }
        uint256 timeElapsed = block.timestamp - lastMintTime;
        uint256 decayPercent = timeElapsed * decayPerWeek / 604800;
        lastAmtPerWeek = lastAmtPerWeek * (MAX_BPS - decayPercent) / MAX_BPS;
        uint amtToMint = timeElapsed * lastAmtPerWeek / 604800;

        uint receivedAmt = balanceOf[emissionsRecipient];
        _mint(emissionsRecipient, amtToMint);
        receivedAmt = balanceOf[emissionsRecipient] - receivedAmt;
        if (receivedAmt != amtToMint) revert NoEmissionSent();
        lastMintTime = block.timestamp;
        emit Mint(emissionsRecipient, amtToMint);
    }

    function setEmissions(uint256 _emissionRate, uint256 _decayPerWeek) external auth {
        emissionRate = _emissionRate;
        decayPerWeek = _decayPerWeek;
        lastAmtPerWeek = totalSupply * emissionRate / MAX_BPS;
        lastMintTime = block.timestamp;
        emit SetEmissions(msg.sender, _emissionRate, _decayPerWeek);
    }

    function setEmissionsRecipient(address emi) external auth {
        emissionsRecipient = emi;
        emit SetEmissionRecipient(msg.sender, emi);
    }
}
