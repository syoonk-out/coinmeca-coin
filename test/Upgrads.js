const { expect } = require("chai");

describe("deploy", () => {

  let Token;
  let token;
  let signers;

  beforeEach(async () => {
    signers = await ethers.getSigner();
    
    const TokenLocker = await ethers.getContractFactory("TokenLocker");
    const tokenLocker = await TokenLocker.deploy();  

    Token = await ethers.getContractFactory("CoinmecaToken");
    token = await upgrades.deployProxy(Token, [tokenLocker.address], { initializer: "initialize" });
    await token.deployed();
  });

  it("should deploy", async () => {
    const owner = await token.owner();

    expect(owner).to.equal(signers.address);
  });

  it("should NOT invoke", async () => {
    try {
      await token.setSetter(signers.address, 123);
    } catch(e) {
      console.log("Successful error", e);
    }
  });
  
  describe("deploy", () => {

    let TokenUpgrades;
    let tokenUpgrades;

    beforeEach(async () => {
      TokenUpgrades = await ethers.getContractFactory("CoinmecaTokenUpgrades");
      tokenUpgrades = await upgrades.upgradeProxy(token.address, TokenUpgrades);

      console.log(token.address, tokenUpgrades.address);
    });

    it("should address is same", async () => {
      expect(tokenUpgrades.address).to.equal(token.address);
    });

    it("should invoke", async () => {
      await tokenUpgrades.setSetter(signers.address, 123);

      const data = await tokenUpgrades.getSetter(signers.address);

      expect(data.toString()).to.equal("123");
    });
    
  });
  
});