const { expectRevert, expectEvent, time } = require("@openzeppelin/test-helpers");

const TokenLocker = artifacts.require("TokenLocker");
const Coinmeca = artifacts.require("CoinmecaToken");

const { 
  toBN, 
  toWei,
  bigWei, 
  fromWei, 
  ZERO_ADDRESS, 
  strToBytes32, 
  timeUnit 
} = require("../scripts/helpers.js");

const TOTAL_SUPPLY = toWei(String(10**7));

describe("deploy", () => {

  let Token;
  let token;
  let proxy;
  let accounts;
  let locker;

  before(async () => {
    accounts = await web3.eth.getAccounts();
  });

  beforeEach(async () => {    
    locker = await TokenLocker.new();

    Token = await ethers.getContractFactory("CoinmecaToken");
    proxy = await upgrades.deployProxy(Token, [locker.address], { initializer: "initialize" });
    await proxy.deployed();
    await upgrades.admin.transferProxyAdminOwnership(accounts[0]);

    // Hardhat deployment to truffle instance
    // Proxy address is imported to token contract instance
    token = await Coinmeca.at(proxy.address);
  });
  
  it("should deploy", async () => {
    const owner = await token.owner();
    const owner_locker = await locker.owner();
    const lockerSet = await token.getContractAddress(strToBytes32("TokenLocker"));
    const balance_deployer = await token.balanceOf(accounts[0]);

    assert.equal(owner, accounts[0]);
    assert.equal(owner_locker, accounts[0]);
    assert.equal(lockerSet, locker.address);
    assert(balance_deployer.eq(toBN(TOTAL_SUPPLY)));
  });

  describe("Token Ownable", () => {
    
    it("should change owner", async () => {
      const receipt = await token.transferOwnership(accounts[1], { from: accounts[0] });

      const owner_after = await token.owner();

      expectEvent(receipt, "OwnershipTransferred", { previousOwner: accounts[0], newOwner: accounts[1] });
      assert.equal(owner_after, accounts[1]);
    });

    it("should NOT change owner", async () => {
      // address is empty
      await expectRevert(
        token.transferOwnership(ZERO_ADDRESS),
        "Ownable: new owner is the zero address"
      );

      // not owner
      await expectRevert(
        token.transferOwnership(accounts[1], { from: accounts[1] }),
        "Ownable: caller is not the owner"
      );
    });
    
  });

  describe("ERC20", async () => {

    beforeEach(async () => {
      await token.transfer(accounts[1], TOTAL_SUPPLY, { from: accounts[0] });
    });

    it("should transfer", async () => {
      const receipt = await token.transfer(accounts[0], 100, { from: accounts[1] });
      const balance0 = await token.balanceOf(accounts[0]);
      const balance1 = await token.balanceOf(accounts[1]);
      
      expectEvent(receipt, "Transfer", { from: accounts[1], to: accounts[0], value: "100" });
      assert.equal(Number(balance0), 100);
      assert(toBN(TOTAL_SUPPLY).sub(toBN("100")).eq(balance1));
    });
  
    it("should NOT transfer", async () => {
      // invalid address
      await expectRevert(
        token.transfer(ZERO_ADDRESS, 100, { from: accounts[1] }),
        "ERC20: transfer to the zero address"
      );
  
      // not enough balance
      await expectRevert(
        token.transfer(accounts[0], toBN(TOTAL_SUPPLY).add(toBN("1")), { from: accounts[1] }),
        "ERC20: transfer amount exceeds balance"
      );
      await expectRevert(
        token.transfer(accounts[1], 100, { from: accounts[0] }),
        "ERC20: transfer amount exceeds balance"      
      );
    });
  
    it("should transferFrom", async () => {
      const receipt_approval = await token.approve(accounts[2], 1000, { from: accounts[1] });
      const allowance_before = await token.allowance(accounts[1], accounts[2]);
  
      const receipt_transfer = await token.transferFrom(
        accounts[1], 
        accounts[0], 
        1000, 
        { from: accounts[2] }
      );
      const balance0 = await token.balanceOf(accounts[0]);
      const balance1 = await token.balanceOf(accounts[1]);
      const balance2 = await token.balanceOf(accounts[2]);
      const allowance_after = await token.allowance(accounts[1], accounts[2]);
  
      expectEvent(receipt_approval, "Approval", {owner: accounts[1], spender: accounts[2], value: "1000"});
      expectEvent(receipt_transfer, "Transfer", {from: accounts[1], to: accounts[0], value: "1000"});
      assert.equal(Number(balance0), 1000);
      assert(toBN(TOTAL_SUPPLY).sub(toBN("1000")).eq(balance1));
      assert.equal(balance2, 0);
      assert.equal(Number(allowance_before), 1000);
      assert.equal(Number(allowance_after), 0);
    });
  
    it("should NOT transferFrom", async () => {
      // not allowed
      await expectRevert(
        token.transferFrom(
          accounts[1], 
          accounts[0], 
          1000, 
          { from: accounts[2] }
        ),
        "ERC20: transfer amount exceeds allowance"
      );
  
      await token.approve(accounts[2], 1000, { from: accounts[1] });
  
      // exceeds allowed
      await expectRevert(
        token.transferFrom(
          accounts[1], 
          accounts[0], 
          1001, 
          { from: accounts[2] }
        ),
        "ERC20: transfer amount exceeds allowance"
      );
  
      await token.transferFrom(
        accounts[1], 
        accounts[0], 
        1000, 
        { from: accounts[2] }
      );
  
      // allowance depleted
      await expectRevert(
        token.transferFrom(
          accounts[1], 
          accounts[0], 
          1000, 
          { from: accounts[2] }
        ),
        "ERC20: transfer amount exceeds allowance"
      );
  
      await token.approve(accounts[2], toBN(TOTAL_SUPPLY).add(toBN(TOTAL_SUPPLY)), { from: accounts[1] });
  
      // exceeds balance
      await expectRevert(
        token.transferFrom(
          accounts[1], 
          accounts[0], 
          toBN(TOTAL_SUPPLY).add(toBN("1")), 
          { from: accounts[2] }
        ),
        "ERC20: transfer amount exceeds balance"
      );
    }); 

  });

  describe("Locker", () => {

    let lockedAccount,
        delay,
        iterations,
        totalLockAmount,
        eachLockPeriod,
        setLockBlockTimeStamp;
    
    beforeEach(async () => {
      // User will be locked about 10 weeks 100 token amounts,
      // Every week, token will be unlocked 10 token amounts.
      // First unlock will be performed after a day.
      lockedAccount = accounts[1];
      delay = timeUnit.day;
      iterations = 10;
      totalLockAmount = bigWei("100");
      eachLockPeriod = timeUnit.week;

      const receipt = await locker.setLock(
        lockedAccount,
        delay,
        iterations,
        totalLockAmount,
        eachLockPeriod,
        { from: accounts[0] }
      );

      const _setLockBlockTimeStamp = await web3.eth.getBlock(receipt.receipt.blockNumber);
      setLockBlockTimeStamp = _setLockBlockTimeStamp.timestamp;

      await token.transfer(lockedAccount, totalLockAmount, { from: accounts[0] });
    });

    it("is before unlock start", async () => {
      // balance should be 0
      const balance_beforeStart = await token.balanceOf(lockedAccount);
      
      assert.equal(balance_beforeStart.toString(), "0");
      
      // Should not be able to transfer any token
      await expectRevert(
        token.transfer(accounts[9], 1, { from: lockedAccount }),
        "balance is locked"
      );

      const details = await locker.getLockDetails(lockedAccount);

      assert.equal(details[0].toString(), "10");
      assert(details[1].eq(totalLockAmount));      
    });
    
    it("should unlock as time flows", async () => {
      const eachLockAmount = bigWei("10");
      const eachLockAmountOver = bigWei("10").add(toBN("1"));

      let balance_before, balance_after;
      
      // First unlock after 1 day
      await time.increase(timeUnit.day + 1);

      let lockDetails = await locker.getLockDetails(lockedAccount);

      await expectRevert(
        token.transfer(accounts[9], eachLockAmountOver, { from: lockedAccount }),
        "balance is locked"
      );

      balance_before = await token.balanceOf(lockedAccount);
      await token.transfer(accounts[9], eachLockAmount, { from: lockedAccount });
      balance_after = await token.balanceOf(lockedAccount);

      assert(lockDetails[0].eq(toBN("9")));
      assert(lockDetails[1].eq(totalLockAmount.sub(eachLockAmount)));
      assert(balance_before.eq(eachLockAmount));
      assert(balance_after.eq(toBN("0")));

      // flow remained 9 periods
      for(let i = 1; i < 10; i++) {
        await time.increase(timeUnit.week + 1);

        lockDetails = await locker.getLockDetails(lockedAccount);
        
        if(i < 9) {
          await expectRevert(
            token.transfer(accounts[9], eachLockAmountOver, { from: lockedAccount }),
            "balance is locked"
          );
        }

        await token.transfer(accounts[9], eachLockAmount, { from: lockedAccount });

        balance_after = await token.balanceOf(lockedAccount);

        assert(lockDetails[0].eq(toBN(String(iterations - (i + 1)))));
        assert(lockDetails[1].eq(totalLockAmount.sub(eachLockAmount.mul(toBN(String(i + 1))))));
        assert(balance_before.eq(eachLockAmount));
        assert(balance_after.eq(toBN("0")));
      }

      const balance_receiver = await token.balanceOf(accounts[9]);

      assert(balance_receiver.eq(totalLockAmount));
    });

    it("should remove lock", async () => {
      await expectRevert(
        token.transfer(accounts[9], 1, { from: lockedAccount }),
        "balance is locked"
      );

      await locker.removeLock(lockedAccount, { from: accounts[0] });
      
      const balance_lockRemoved = await token.balanceOf(lockedAccount);

      await token.transfer(accounts[9], totalLockAmount, { from: lockedAccount });

      const balance_lockRemoved_after = await token.balanceOf(lockedAccount);
      
      assert(balance_lockRemoved.eq(totalLockAmount));
      assert(balance_lockRemoved_after.eq(toBN("0")));
    });
    
  });

  describe("Pause", () => {
    
    beforeEach(async () => {
      const transferAmount = bigWei("10");
      
      await token.transfer(accounts[1], transferAmount, { from: accounts[0] });
      await token.transfer(accounts[2], transferAmount, { from: accounts[0] });
      await token.transfer(accounts[3], transferAmount, { from: accounts[0] });
    });

    it("should pause and unpause", async () => {
      const receipt = await token.pause({ from: accounts[0] });

      expectEvent(receipt, "Paused", { account: accounts[0] });
      await expectRevert(
        token.transfer(accounts[9], 1, { from: accounts[1] }),
        "ERC20Pausable: token transfer while paused"
      );
      await expectRevert(
        token.transfer(accounts[9], 1, { from: accounts[2] }),
        "ERC20Pausable: token transfer while paused"
      );
      await expectRevert(
        token.transfer(accounts[9], 1, { from: accounts[3] }),
        "ERC20Pausable: token transfer while paused"
      );

      const receipt_unpause = await token.unpause({ from: accounts[0] });

      expectEvent(receipt_unpause, "Unpaused", { account: accounts[0] });

      await token.transfer(accounts[9], 1, { from: accounts[1] });
      await token.transfer(accounts[9], 1, { from: accounts[2] });
      await token.transfer(accounts[9], 1, { from: accounts[3] });
    });

    it("should not pause and unpause", async () => {
      // currently unpaused
      await expectRevert(
        token.unpause({ from: accounts[0] }),
        "Pausable: not paused"
      );

      // not owner
      await expectRevert(
        token.pause({ from: accounts[1] }),
        "Ownable: caller is not the owner"
      );
      
      await token.pause({ from: accounts[0] });
      
      // currently paused
      await expectRevert(
        token.pause({ from: accounts[0] }),
        "Pausable: paused"
      );

      // not owner
      await expectRevert(
        token.unpause({ from: accounts[1] }),
        "Ownable: caller is not the owner"
      );

    });
    
  });
  
});