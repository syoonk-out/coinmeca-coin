// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

interface ITokenLocker {
  function getLock(address _account)
  external view 
  returns (
    uint, 
    uint, 
    uint, 
    uint, 
    uint
  );

  function getLockDetails(address _account)
  external view
  returns(uint, uint);
}

contract CoinmecaTokenUpgrades is Initializable, OwnableUpgradeable, ERC20PausableUpgradeable {
  
  using SafeMathUpgradeable for uint256;

  bytes32 constant public TOKEN_LOCKER = "TokenLocker";

  mapping(bytes32 => address) private _contractAddresses;

  mapping(address => uint) private _setter;

  function initialize(address _locker)
  external 
  initializer {
    __Ownable_init();
    __ERC20_init("Coinmeca", "MECA");
    __ERC20Pausable_init();
    _contractAddresses[TOKEN_LOCKER] = _locker;
    _mint(_msgSender(), 10000000 ether);
  }

  function setSetter(address _account, uint _data)
  external {
    _setter[_account] = _data;
  }

  function getSetter(address _account)
  external view
  returns(uint) {
    return _setter[_account];
  }

  function tokenLocker()
  internal view
  returns(ITokenLocker) {
    return ITokenLocker(_contractAddresses[TOKEN_LOCKER]);
  }

  function setContractAddress(bytes32 _key, address _address)
  external 
  onlyOwner {
    _contractAddresses[_key] = _address;
  }

  function pause()
  external 
  onlyOwner {
    _pause();
  }

  function unpause()
  external
  onlyOwner{
    _unpause();
  }

  function balanceOf(address account)
  public view override
  returns(uint256) {
    require(_contractAddresses[TOKEN_LOCKER] != address(0),
      "Locker address is not set");
    
    ( , uint lockedAmount) = tokenLocker().getLockDetails(account);

    return super.balanceOf(account).sub(lockedAmount);
  }

  function getLock(address _account)
  external view
  returns(
    uint,
    uint,
    uint,
    uint,
    uint
  ) {
    return tokenLocker().getLock(_account);
  }

  function getContractAddress(bytes32 _key)
  external view
  returns(address) {
    return _contractAddresses[_key];
  }

  function getIsLocked(address _account, uint _amount)
  external view
  returns(bool) {
    return _isLocked(_account, _amount);
  }

  function _isLocked(address _account, uint _amount)
  internal view
  returns(bool) {
      require(_contractAddresses[TOKEN_LOCKER] != address(0),
        "Locker is not set");
    
      ( uint startTime, , , , uint endTime ) = tokenLocker().getLock(_account);

      // user is not locked
      if(startTime == 0 || endTime < block.timestamp) {
        return false;
      } 

      // releasing is not started yet
      if(startTime > block.timestamp) {
        return true;
      }

      (, uint lockAmount) = tokenLocker().getLockDetails(_account);
      uint userBalance = super.balanceOf(_account);

      // user's remained balance may less than lock amount
      if(userBalance.sub(_amount) < lockAmount) {
        return true;
      }
  }

  function _beforeTokenTransfer(address from, address to, uint256 amount) 
  internal override {
    super._beforeTokenTransfer(from, to, amount);
    
    require(
      !_isLocked(from, amount),
      "balance is locked"
    );
  }

}