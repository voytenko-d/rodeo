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

    uint256 public emissionRate; // percentage value
    uint256 public emissionStartDate;
    uint256 public MAX_BPS = 10_000;

    uint256 public lastMintTime;
    address public emissionsRecipient;

    event Mint(address indexed dst, uint256 amt);
    event SetWeeklySupply(address indexed owner, uint256 amt);
    event SetMintAddr(address indexed owner, address newMintAddr);

    error NoMintAddress();

    constructor(
        uint256 _initialSupply
    ) ERC20("Token", "TOKEN", 18) ERC20Permit("Token") {
        exec[msg.sender] = true;
        _mint(msg.sender, _initialSupply);
    }

    function mint() external {
        if (emissionsRecipient == address(0)) {
            revert NoMintAddress();
        }
        require(block.timestamp >= lastMintTime + 1 weeks, "Can only mint once per week");
        
        uint256 amount = totalSupply * emissionRate / MAX_BPS;

        _mint(emissionsRecipient, amount);
        lastMintTime = block.timestamp;
        emit Mint(emissionsRecipient, amount);
    }

    function setWeeklySupply(uint256 _emissionRate) external auth {
        emissionRate = _emissionRate;
        emissionStartDate = block.timestamp;
        emit SetWeeklySupply(msg.sender, _emissionRate);
    }

    function setMintAddr(address _mintAddr) external auth {
        emissionsRecipient = _mintAddr;
        emit SetMintAddr(msg.sender, _mintAddr);
    }
}
