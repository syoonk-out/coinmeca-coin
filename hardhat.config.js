require('dotenv').config();
require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-web3");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const prv = process.env.KOVAN_PRIVATE;
const url = process.env.KOVAN_PROVIDER;

const mainPrv = process.env.MAIN_PRIVATE;
const mainUrl = process.env.MAIN_PROVIDER;

module.exports = {
  solidity: "0.8.3",

  networks: {
    kovan: {
      url,
      accounts: [prv],
      loggingEnabled: true
    },

    development: {
      url: "http://127.0.0.1:8545",
      accounts: [prv]
    }
  }
};
