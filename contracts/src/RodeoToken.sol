// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "./ERC20.sol";

contract RodeoToken is ERC20 {
    struct WhiteList {
        address usr;
        uint256 amt;
    }

    uint256 public weeklySupply; // percentage value
    uint256 public lastMintTime;
    address public mintAddr;
    address public owner;

    event Mint(address indexed dst, uint256 amt);
    event SetWeeklySupply(address indexed owner, uint256 amt);
    event SetMintAddr(address indexed owner, address newMintAddr);

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        WhiteList[] memory _whitelist,
        address _owner,
        uint256 _initialSupply
    ) ERC20(_name, _symbol, _decimals) {
        uint256 whiteListTotalAmt;
        owner = msg.sender;

        for (uint256 i = 0; i < _whitelist.length; i++) {
            whiteListTotalAmt += _whitelist[i].amt;
            _mint(_whitelist[i].usr, _whitelist[i].amt);
        }
        _mint(_owner, _initialSupply - whiteListTotalAmt);
    }

    function mint() external {
        require(mintAddr != address(0), "!undefined");
        require(block.timestamp >= lastMintTime + 1 weeks, "Can only mint once per week");
        
        uint256 amount = totalSupply * weeklySupply / 100;

        _mint(mintAddr, amount);
        lastMintTime = block.timestamp;
        emit Mint(mintAddr, amount);
    }

    function setWeeklySupply(uint256 _weeklySupply) external onlyOwner {
        weeklySupply = _weeklySupply;
        emit SetWeeklySupply(owner, _weeklySupply);
    }

    function setMintAddr(address _mintAddr) external onlyOwner {
        mintAddr = _mintAddr;
        emit SetMintAddr(owner, _mintAddr);
    }

    modifier onlyOwner {
        require(msg.sender == owner, "!unauthorized");
        _;
    }
}
