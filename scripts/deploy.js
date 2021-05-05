const main = async () => {
  const signer = await ethers.getSigner();
  
  console.log("The signer is... ", signer.address);
  
  const TokenLocker = await ethers.getContractFactory("TokenLocker");
  const tokenLocker = await TokenLocker.deploy();
  console.log("TokenLocker deployed: ", tokenLocker.address);
  
  const Token = await ethers.getContractFactory("CoinmecaToken");
  const token = await upgrades.deployProxy(Token, [tokenLocker.address], { initializer: 'initialize' });
  await token.deployed();
  console.log("Token deployed to:", token.address);

  const lockerAddress = await token.getContractAddress(ethers.utils.formatBytes32String("TokenLocker"));
  console.log("Locker is set as: ", lockerAddress);
  
  console.log("Setting admin...");
  await upgrades.admin.transferProxyAdminOwnership(signer.address);
  console.log("Admin is set as: ", signer.address);
}

main();