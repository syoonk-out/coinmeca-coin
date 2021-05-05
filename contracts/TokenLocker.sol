pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenLocker is Ownable {

  using SafeMath for uint;

  struct LockState {
    address account;
    uint startTime;
    uint iterations;
    uint totalAmount;
    uint eachLockPeriod;
    uint endTime;
  }

  mapping(address => LockState) public lockStates;

  event LockChanged(
    address indexed account,
    uint start,
    uint iterations,
    uint totalLockAmount,
    uint eachLockPeriod,
    uint end
  );

  constructor()
  Ownable() {

  }

  function setLock(
    address _account,
    uint _delay,
    uint _iterations,
    uint _totalLockAmount,
    uint _eachLockPeriod
  ) external
  onlyOwner() {
    lockStates[_account] = LockState(
      _account,
      _delay + block.timestamp,
      _iterations,
      _totalLockAmount,
      _eachLockPeriod,
      _delay + block.timestamp + (_iterations * _eachLockPeriod)
    );

    emit LockChanged(
      _account,
      _delay + block.timestamp,
      _iterations,
      _totalLockAmount,
      _eachLockPeriod,
      _delay + block.timestamp + (_iterations * _eachLockPeriod)
    );
  }

  function getLock(address _account) 
  public view 
  returns (
    uint startTime, 
    uint iterations, 
    uint totalAmount, 
    uint eachLockPeriod, 
    uint endTime
  ) {
    return (
      lockStates[_account].startTime,
      lockStates[_account].iterations,
      lockStates[_account].totalAmount,
      lockStates[_account].eachLockPeriod,
      lockStates[_account].endTime
    );
  }

  function getLockDetails(address _account)
  public view
  returns(uint, uint) {
    LockState memory userLockInfo = lockStates[_account];

    // releasing is not started yet
    if(userLockInfo.startTime > block.timestamp || userLockInfo.startTime == 0) {
        return (userLockInfo.iterations, userLockInfo.totalAmount);
    }

    if(userLockInfo.endTime <= block.timestamp) {
      return (0, 0);
    }

    uint iterRemains = (userLockInfo.endTime.sub(block.timestamp)).div(userLockInfo.eachLockPeriod);
    uint lockAmount = userLockInfo.totalAmount.mul(iterRemains).div(userLockInfo.iterations);

    return (iterRemains, lockAmount);
  }

  function removeLock(address _account)
  external
  onlyOwner() {
    delete lockStates[_account];

    emit LockChanged(
      _account,
      0,
      0,
      0,
      0,
      0
    );
  }

}