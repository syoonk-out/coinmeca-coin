const Web3 = require("web3");
const ethers = require("ethers");

const toBN = (_amount) => {
  return Web3.utils.toBN(String(_amount));
}

const toWei = (_amount) => {
  return Web3.utils.toWei(String(_amount));
}

const bigWei = (_amount) => {
  return toBN(toWei(_amount));
}

const fromWei = (_amount) => {
  return Web3.utils.fromWei(String(_amount));
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const strToBytes32 = (_str) => {
  return ethers.utils.formatBytes32String(String(_str));
}

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;

const timeUnit = {
  minute: MINUTE,
  hour: HOUR,
  day: DAY,
  week: WEEK
}

module.exports = { 
  toBN, 
  toWei,
  bigWei, 
  fromWei, 
  ZERO_ADDRESS, 
  strToBytes32, 
  timeUnit 
}