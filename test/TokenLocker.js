const { expectRevert, expectEvent, time } = require("@openzeppelin/test-helpers");

const TokenLocker = artifacts.require("TokenLocker");

const { 
  ZERO_ADDRESS, 
  timeUnit,
  toBN,
  bigWei,
} = require("../scripts/helpers.js");

contract("TokenLocker", accounts => {
  
  let locker;

  before(async () => {
  });

  beforeEach(async () => {
    locker = await TokenLocker.new();
  });
  
  describe("Deployment", () => {
    
    it("should deploy properly", async () => {
      const owner = await locker.owner();

      assert.equal(owner, accounts[0]);
    });
    
  });

  describe("Ownable", () => {
    
    it("should change owner", async () => {
      const receipt = await locker.transferOwnership(accounts[1], { from: accounts[0] });

      const owner_after = await locker.owner();

      expectEvent(receipt, "OwnershipTransferred", { previousOwner: accounts[0], newOwner: accounts[1] });
      assert.equal(owner_after, accounts[1]);
    });

    it("should NOT change owner", async () => {
      // address is empty
      await expectRevert(
        locker.transferOwnership(ZERO_ADDRESS),
        "Ownable: new owner is the zero address"
      );

      // not owner
      await expectRevert(
        locker.transferOwnership(accounts[1], { from: accounts[1] }),
        "Ownable: caller is not the owner"
      );
    });
    
  });

  describe("Token Locker", () => {

    // User will be locked about 10 weeks 100 token amounts,
    // Every week, token will be unlocked 10 token amounts.
    // First unlock will be performed after a day.
    const lockedAccount = accounts[1];
    const delay = timeUnit.day;
    const iterations = 10;
    const totalLockAmount = bigWei("100");
    const eachLockPeriod = timeUnit.week;
    
    describe("Set Lock", () => {

      it("should set lock", async () => {
        const receipt = await locker.setLock(
          lockedAccount,
          delay,
          iterations,
          totalLockAmount,
          eachLockPeriod,
          { from: accounts[0] }
        );
  
        // const blockTime = await time.latest();
        const _blockTime = await web3.eth.getBlock(receipt.receipt.blockNumber);
        const blockTime = _blockTime.timestamp;
  
        const lockData = await locker.getLock(lockedAccount);
        const lockDetails = await locker.getLockDetails(lockedAccount);
        
        expectEvent(receipt, "LockChanged", {
          account: lockedAccount,
          start: String(Number(blockTime) + delay),
          iterations: String(iterations),
          totalLockAmount: String(totalLockAmount),
          eachLockPeriod: String(eachLockPeriod),
          end: String(Number(blockTime) + delay + (iterations * eachLockPeriod))
        });
        assert.equal(lockData[0].toNumber(), Number(blockTime) + delay);
        assert.equal(lockData[1].toNumber(), iterations);
        assert(lockData[2].eq(totalLockAmount));
        assert.equal(lockData[3].toNumber(), eachLockPeriod);
        assert.equal(lockData[4].toNumber(), Number(blockTime) + delay + (iterations * eachLockPeriod));
        assert.equal(lockDetails[0].toNumber(), 10);
        assert(lockDetails[1].eq(totalLockAmount));
      });
      
      it("should NOT set lock", async () => {
        // not owner
        await expectRevert(
          locker.setLock(
            lockedAccount,
            delay,
            iterations,
            totalLockAmount,
            eachLockPeriod,
            { from: lockedAccount }
          ),
          "Ownable: caller is not the owner"
        );
      });
      
    });

    describe("remove lock", () => {

      beforeEach(async () => {
        await locker.setLock(
          lockedAccount,
          delay,
          iterations,
          totalLockAmount,
          eachLockPeriod,
          { from: accounts[0] }
        );  
      });

      it("should remove lock", async () => {
        // checking account has lock
        const val = await locker.getLock(lockedAccount);
        
        assert(val[1].toNumber() > 0);

        const receipt = await locker.removeLock(lockedAccount);

        const removed = await locker.getLock(lockedAccount);

        expectEvent(receipt, "LockChanged", {
          account: lockedAccount,
          start: "0",
          iterations: "0",
          totalLockAmount: "0",
          eachLockPeriod: "0",
          end: "0"
        });
        for(let i = 0; i < removed.length; i++) {
          assert.equal(removed[i].toString(), "0");
        }
      });
      
      if("should NOT remove lock", async () => {
        // not owner
        await expectRevert(
          locker.removeLock(lockedAccount),
          "Ownable: caller is not the owner"
        )
      });
      
    });

    describe("time flows", () => {

      beforeEach(async () => {
        await locker.setLock(
          lockedAccount,
          delay,
          iterations,
          totalLockAmount,
          eachLockPeriod,
          { from: accounts[0] }
        );  
      });

      it("should unlock", async () => {
        const lockDetails = [];
        
        // Time goes to start time
        await time.increase(timeUnit.day + 1);
        
        let _lockDetails = await locker.getLockDetails(lockedAccount);
        lockDetails.push(_lockDetails);
        
        for(let i = 1; i < iterations + 1; i++) {
          await time.increase(timeUnit.week + 1);

          _lockDetails = await locker.getLockDetails(lockedAccount);
          lockDetails.push(_lockDetails);
        }

        const eachLockAmount = totalLockAmount.div(toBN(String(iterations)));

        for(let i = 0; i < iterations + 1; i++) {
          const iterRemains = iterations - ( i + 1 ) > 0 ? iterations - ( i + 1 ) : 0;
          
          assert.equal(lockDetails[i][0].toString(), String(iterRemains));
          if(i < iterations) {
            assert.equal(lockDetails[i][1].toString(), totalLockAmount.sub((eachLockAmount.mul(toBN(String(i + 1))))).toString());
          } else if(i >= iterations) {
            assert.equal(lockDetails[i][1].toString(), "0");
          }
        }

        // Time goes too far (1 year)
        await time.increase(timeUnit.week * 52);

        const shouldNoLock = await locker.getLockDetails(lockedAccount);

        assert.equal(shouldNoLock[0].toString(), "0");
        assert.equal(shouldNoLock[1].toString(), "0");
      });

    });

  });

});