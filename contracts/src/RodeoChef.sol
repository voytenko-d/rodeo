// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {IERC20} from "./interfaces/IERC20.sol";
import {IPool} from "./interfaces/IPool.sol";
import {SafeERC20} from "./lib/SafeERC20.sol";
import {Multicall} from "./utils/Multicall.sol";
import {Util} from "./Util.sol";

contract RodeoChef is Util, Multicall {
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 amount;
        int256 rewardDebt;
        uint256 lockTimestamp;
    }

    struct PoolInfo {
        uint128 accRewardPerShare;
        uint64 lastRewardTime;
        uint64 allocPoint;
    }

    address public owner;
    IERC20 public rewardToken;

    PoolInfo[] public poolInfo;
    IERC20[] public token;

    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    uint256 public totalAllocPoint;

    uint256 public rewardPerDay;
    uint256 private constant ACC_PRECISION = 1e12;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount, address indexed to, uint256 lockTimestamp);
    event DepositAndWrap(address indexed user, uint256 indexed pid, uint256 amount, address indexed to, uint256 lockTimestamp);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
    event WithdrawAndUnwrap(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
    event Harvest(address indexed user, uint256 indexed pid, uint256 amount);
    event LogPoolAddition(uint256 indexed pid, uint256 allocPoint, IERC20 indexed token);
    event LogSetPool(uint256 indexed pid, uint256 allocPoint);
    event LogUpdatePool(uint256 indexed pid, uint64 lastRewardBlock, uint256 lpSupply, uint256 accRewardPerShare);

    constructor(IERC20 _rewardToken, uint256 _rewardPerDay) {
        rewardToken = _rewardToken;
        rewardPerDay = _rewardPerDay;
        owner = msg.sender;
    }

    function setOwner(address _owner) external onlyOwner {
        owner = _owner;
    }

    function setRewardToken(IERC20 _rewardToken) public onlyOwner {
        rewardToken = _rewardToken;
    }

    function setRewardsPerDay(uint256 _rewardPerDay) public onlyOwner {
        rewardPerDay = _rewardPerDay;
    }

    function poolLength() public view returns (uint256 pools) {
        pools = poolInfo.length;
    }

    function add(uint256 allocPoint, IERC20 _token) public onlyOwner {
        totalAllocPoint = totalAllocPoint + allocPoint;
        token.push(_token);

        poolInfo.push(PoolInfo({
            allocPoint: uint64(allocPoint),
            lastRewardTime: uint64(block.timestamp),
            accRewardPerShare: 0
        }));
        emit LogPoolAddition(token.length - 1, allocPoint, _token);
    }

    function set(uint256 _pid, uint256 _allocPoint) public onlyOwner {
        totalAllocPoint = (totalAllocPoint - poolInfo[_pid].allocPoint) + _allocPoint;
        poolInfo[_pid].allocPoint = uint64(_allocPoint);
        emit LogSetPool(_pid, _allocPoint);
    }

    function pendingRewards(uint256 _pid, address _user) external view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRewardPerShare = pool.accRewardPerShare;
        uint256 tokenSupply = token[_pid].balanceOf(address(this));
        if (block.timestamp > pool.lastRewardTime && tokenSupply != 0) {
            uint256 timeSinceLastReward = block.timestamp - pool.lastRewardTime;
            uint256 reward = timeSinceLastReward * rewardPerDay * pool.allocPoint / totalAllocPoint / 86400;

            accRewardPerShare = accRewardPerShare + ((reward * ACC_PRECISION) / tokenSupply);
        }
        pending = uint256(int256((user.amount * accRewardPerShare) / ACC_PRECISION) - user.rewardDebt);
    }

    function massUpdatePools(uint256[] calldata pids) external {
        uint256 len = pids.length;
        for (uint256 i = 0; i < len; ++i) {
            updatePool(pids[i]);
        }
    }

    function updatePool(uint256 pid) public returns (PoolInfo memory pool) {
        pool = poolInfo[pid];
        if (block.timestamp > pool.lastRewardTime) {
            uint256 lpSupply = token[pid].balanceOf(address(this));
            if (lpSupply > 0) {
                uint256 timeSinceLastReward = block.timestamp - pool.lastRewardTime;
                uint256 reward = timeSinceLastReward * rewardPerDay * pool.allocPoint / totalAllocPoint / 86400;
                pool.accRewardPerShare = pool.accRewardPerShare + uint128((reward * ACC_PRECISION) / lpSupply);
            }
            pool.lastRewardTime = uint64(block.timestamp);
            poolInfo[pid] = pool;
            emit LogUpdatePool(pid, pool.lastRewardTime, lpSupply, pool.accRewardPerShare);
        }
    }

    function deposit(uint256 pid, uint256 amount, address to, uint256 lockTimestamp) public live {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][to];

        token[pid].safeTransferFrom(msg.sender, address(this), amount);
        user.amount = user.amount + amount;
        user.rewardDebt = user.rewardDebt + int256((amount * pool.accRewardPerShare) / ACC_PRECISION);
        user.lockTimestamp = lockTimestamp;

        emit Deposit(msg.sender, pid, amount, to, lockTimestamp);
    }

    function depositAndWrap(uint256 pid, uint256 amount, address to, uint256 lockTimestamp) public live {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][to];

        uint256 ribAmount = wrapInternal(pid, amount, msg.sender);
        user.amount = user.amount + ribAmount;
        user.rewardDebt = user.rewardDebt + int256((amount * pool.accRewardPerShare) / ACC_PRECISION);
        user.lockTimestamp = lockTimestamp;
        emit DepositAndWrap(msg.sender, pid, amount, to, lockTimestamp);
    }

    function withdraw(uint256 pid, uint256 amount, address to) public live {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];
        require(block.timestamp > user.lockTimestamp, "!locked");

        user.rewardDebt = user.rewardDebt - int256((amount * pool.accRewardPerShare) / ACC_PRECISION);
        user.amount = user.amount - amount;

        token[pid].safeTransfer(to, amount);

        emit Withdraw(msg.sender, pid, amount, to);
    }

    function withdrawAndUnwrap(uint256 pid, uint256 amount, address to) public live {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];

        require(block.timestamp > user.lockTimestamp, "!locked");

        user.rewardDebt = user.rewardDebt - int256((amount * pool.accRewardPerShare) / ACC_PRECISION);
        user.amount = user.amount - amount;
        unwrapInternal(pid, amount, to);

        emit WithdrawAndUnwrap(msg.sender, pid, amount, to);
    } 

    function harvest(uint256 pid, address to) public {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];
        int256 accumulatedReward = int256((user.amount * pool.accRewardPerShare) / ACC_PRECISION);
        uint256 _pendingReward = uint256(accumulatedReward - user.rewardDebt);

        user.rewardDebt = accumulatedReward;

        if (_pendingReward != 0) {
            require(rewardToken.balanceOf(address(this)) >= _pendingReward, "!not enough reward");
            rewardToken.safeTransferFrom(address(this), to, _pendingReward);
        }
        
        emit Harvest(msg.sender, pid, _pendingReward);
    }

    function updateUserPosition(uint256 pid, uint256 amount, address userAddress) external onlyOwner {
        UserInfo storage user = userInfo[pid][userAddress];
        user.amount = amount;
        user.rewardDebt = 0;
    }
    
    // function withdrawAndHarvest(uint256 pid, uint256 amount, address to, bool isUnstake) public {
    //     PoolInfo memory pool = updatePool(pid);
    //     UserInfo storage user = userInfo[pid][msg.sender];
    //     int256 accumulatedReward = int256((user.amount * pool.accRewardPerShare) / ACC_PRECISION);
    //     uint256 _pendingReward = uint256(accumulatedReward - user.rewardDebt);

    //     user.rewardDebt = accumulatedReward - int256((amount * pool.accRewardPerShare) / ACC_PRECISION);
    //     user.amount = user.amount - amount;
        
    //     if (isUnstake) {
    //         IPool liquidityPool = IPool(address(token[pid]));
    //         liquidityPool.burn(amount, to);
    //     } else {
    //         token[pid].safeTransfer(to, amount);
    //     }
    //     rewardToken.safeTransferFrom(address(this), to, _pendingReward);
        
    //     emit Withdraw(msg.sender, pid, amount, to, isUnstake);
    //     emit Harvest(msg.sender, pid, _pendingReward);
    // }

    function emergencyWithdraw(uint256 pid, address to) public {
        UserInfo storage user = userInfo[pid][msg.sender];
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;

        token[pid].safeTransfer(to, amount);
        emit EmergencyWithdraw(msg.sender, pid, amount, to);
    }

    function wrapInternal(uint256 pid, uint256 amount, address wrapper) internal returns (uint256 wrappedAmount) {
        IPool liquidityPool = IPool(address(token[pid]));
        uint256 tokenBalanceBefore = liquidityPool.balanceOf(address(this));
        address underlyingToken = liquidityPool.asset();
        IERC20(underlyingToken).safeTransferFrom(wrapper, address(this), amount);
        liquidityPool.mint(amount, address(this));
        uint256 tokenBalanceAfter = liquidityPool.balanceOf(address(this));
        wrappedAmount = tokenBalanceAfter - tokenBalanceBefore;
    }

    function unwrapInternal(uint256 pid, uint256 amount, address to) internal {
        IPool liquidityPool = IPool(address(token[pid]));
        liquidityPool.burn(amount, to);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "!owner");
        _;
    }
}