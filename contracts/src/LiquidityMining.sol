// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {Util} from "./Util.sol";
import {IPool} from "./interfaces/IPool.sol";
import {IERC20} from "./interfaces/IERC20.sol";

// Incentivize liquidity with token rewards, based on SushiSwap's MiniChef
contract LiquidityMining is Util {
    struct UserInfo {
        uint256 amount;
        int256 rewardDebt;
        uint256 lock;
    }

    struct PoolInfo {
        uint128 accRewardPerShare;
        uint64 lastRewardTime;
        uint64 allocPoint;
    }

    IERC20 public rewardToken;
    uint256 public rewardPerDay;
    uint256 public totalAllocPoint;
    IERC20[] public token;
    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount, address indexed to, uint256 lock);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
    event Harvest(address indexed user, uint256 indexed pid, uint256 amount);
    event FileInt(bytes32 what, uint256 data);
    event FileAddress(bytes32 what, address data);
    event PoolAdd(uint256 indexed pid, uint256 allocPoint, address indexed token);
    event PoolSet(uint256 indexed pid, uint256 allocPoint);
    event PoolUpdate(uint256 indexed pid, uint64 lastRewardBlock, uint256 lpSupply, uint256 accRewardPerShare);

    constructor() {
        exec[msg.sender] = true;
    }

    function file(bytes32 what, uint256 data) external auth {
        if (what == "paused") paused = data == 1;
        if (what == "rewardPerDay") rewardPerDay = data;
        emit FileInt(what, data);
    }

    function file(bytes32 what, address data) external auth {
        if (what == "exec") exec[data] = !exec[data];
        if (what == "rewardToken") rewardToken = IERC20(data);
        emit FileAddress(what, data);
    }

    function poolAdd(uint256 allocPoint, address _token) public auth {
        totalAllocPoint = totalAllocPoint + allocPoint;
        token.push(IERC20(_token));

        poolInfo.push(PoolInfo({
            allocPoint: uint64(allocPoint),
            lastRewardTime: uint64(block.timestamp),
            accRewardPerShare: 0
        }));
        emit PoolAdd(token.length - 1, allocPoint, _token);
    }

    function poolSet(uint256 _pid, uint256 _allocPoint) public auth {
        totalAllocPoint = (totalAllocPoint - poolInfo[_pid].allocPoint) + _allocPoint;
        poolInfo[_pid].allocPoint = uint64(_allocPoint);
        emit PoolSet(_pid, _allocPoint);
    }

    function removeUser(uint256 pid, address usr, address to) public auth {
        UserInfo storage info = userInfo[pid][usr];
        _harvest(usr, pid, to);
        uint256 amt = info.amount;
        token[pid].transfer(to, amt);
        info.amount = 0;
        info.rewardDebt = 0;
        info.lock = 0;
        emit Withdraw(usr, pid, amt, to);
    }

    function poolLength() public view returns (uint256 pools) {
        pools = poolInfo.length;
    }

    function pendingRewards(uint256 _pid, address _user) external view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRewardPerShare = pool.accRewardPerShare;
        uint256 tokenSupply = token[_pid].balanceOf(address(this));
        if (block.timestamp > pool.lastRewardTime && tokenSupply != 0) {
            uint256 timeSinceLastReward = block.timestamp - pool.lastRewardTime;
            uint256 reward = timeSinceLastReward * rewardPerDay * pool.allocPoint / totalAllocPoint / 86400;

            accRewardPerShare = accRewardPerShare + ((reward * 1e12) / tokenSupply);
        }
        pending = uint256(int256((user.amount * accRewardPerShare) / 1e12) - user.rewardDebt);
    }

    function poolUpdateMulti(uint256[] calldata pids) external {
        uint256 len = pids.length;
        for (uint256 i = 0; i < len; ++i) {
            poolUpdate(pids[i]);
        }
    }

    function poolUpdate(uint256 pid) public returns (PoolInfo memory pool) {
        pool = poolInfo[pid];
        if (block.timestamp > pool.lastRewardTime) {
            uint256 lpSupply = token[pid].balanceOf(address(this));
            if (lpSupply > 0) {
                uint256 timeSinceLastReward = block.timestamp - pool.lastRewardTime;
                uint256 reward = timeSinceLastReward * rewardPerDay * pool.allocPoint / totalAllocPoint / 86400;
                pool.accRewardPerShare = pool.accRewardPerShare + uint128((reward * 1e12) / lpSupply);
            }
            pool.lastRewardTime = uint64(block.timestamp);
            poolInfo[pid] = pool;
            emit PoolUpdate(pid, pool.lastRewardTime, lpSupply, pool.accRewardPerShare);
        }
    }

    function deposit(uint256 pid, uint256 amount, address to, uint256 lock) public live {
        token[pid].transferFrom(msg.sender, address(this), amount);
        _deposit(msg.sender, pid, amount, to, lock);
    }

    function depositAndWrap(uint256 pid, uint256 amount, address to, uint256 lock) public live {
        IPool pool = IPool(address(token[pid]));
        uint256 bef = IERC20(address(pool)).balanceOf(address(this));
        IERC20 tok = IERC20(pool.asset());
        tok.transferFrom(msg.sender, address(this), amount);
        tok.approve(address(pool), amount);
        pool.mint(amount, address(this));
        uint256 aft = IERC20(address(pool)).balanceOf(address(this));
        _deposit(msg.sender, pid, aft - bef, to, lock);
    }

    function _deposit(address usr, uint256 pid, uint256 amount, address to, uint256 lock) internal {
        PoolInfo memory pool = poolUpdate(pid);
        UserInfo storage user = userInfo[pid][to];
        user.amount = user.amount + amount;
        user.rewardDebt = user.rewardDebt + int256((amount * pool.accRewardPerShare) / 1e12);
        if (lock > 0) user.lock = block.timestamp + lock;
        emit Deposit(usr, pid, amount, to, lock);
    }

    function withdraw(uint256 pid, uint256 amount, address to) public live {
        _withdraw(msg.sender, pid, amount, to);
        token[pid].transfer(to, amount);
    }

    function withdrawAndUnwrap(uint256 pid, uint256 amount, address to) public live {
        _withdraw(msg.sender, pid, amount, to);
        IPool(address(token[pid])).burn(amount, to);
    }

    function _withdraw(address usr, uint256 pid, uint256 amount, address to) internal {
        PoolInfo memory pool = poolUpdate(pid);
        UserInfo storage info = userInfo[pid][usr];
        require(block.timestamp >= info.lock, "locked");
        info.rewardDebt = info.rewardDebt - int256((amount * pool.accRewardPerShare) / 1e12);
        info.amount = info.amount - amount;
        emit Withdraw(msg.sender, pid, amount, to);
    }

    function harvest(uint256 pid, address to) public {
        _harvest(msg.sender, pid, to);
    }

    function _harvest(address usr, uint256 pid, address to) internal {
        PoolInfo memory pool = poolUpdate(pid);
        UserInfo storage info = userInfo[pid][usr];
        int256 accumulatedReward = int256((info.amount * pool.accRewardPerShare) / 1e12);
        uint256 _pendingReward = uint256(accumulatedReward - info.rewardDebt);
        info.rewardDebt = accumulatedReward;
        if (_pendingReward != 0) {
            rewardToken.transfer(to, _pendingReward);
        }
        emit Harvest(usr, pid, _pendingReward);
    }
    
    function emergencyWithdraw(uint256 pid, address to) public {
        UserInfo storage user = userInfo[pid][msg.sender];
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        token[pid].transfer(to, amount);
        emit Withdraw(msg.sender, pid, amount, to);
    }
}
