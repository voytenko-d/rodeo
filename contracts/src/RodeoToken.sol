// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "./ERC20.sol";

contract RodeoToken is ERC20 {
    struct WhiteList {
        address usr;
        uint256 amt;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        WhiteList[] memory _whitelist,
        address _owner,
        uint256 _initialSupply
    ) ERC20(_name, _symbol, _decimals) {
        uint256 whiteListTotalAmt;
        for (uint256 i = 0; i < _whitelist.length; i++) {
            whiteListTotalAmt += _whitelist[i].amt;
            _mint(_whitelist[i].usr, _whitelist[i].amt);
        }
        _mint(_owner, _initialSupply - whiteListTotalAmt);
    }

    function mint() public onlyOwner {
        require(block.timestamp >= lastMintTime + 1 weeks, "Can only mint once per week");
        
        uint256 amount = WEEKLY_SUPPLY;
        if (totalSupply() + amount > MAX_SUPPLY) {
            amount = MAX_SUPPLY - totalSupply();
        }

        _mint(owner(), amount);
        lastMintTime = block.timestamp;
    }
}
