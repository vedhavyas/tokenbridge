require('../../env')
const fetch = require('node-fetch')
const { web3Home, web3Foreign } = require('../services/web3')
const { bridgeConfig } = require('../../config/base.config')
const logger = require('../services/logger').child({
  module: 'gasPrice'
})
const { setIntervalAndRun } = require('../utils/utils')
const { DEFAULT_UPDATE_INTERVAL, GAS_PRICE_BOUNDARIES, DEFAULT_GAS_PRICE_FACTOR } = require('../utils/constants')
const { gasPriceFromOracle, gasPriceFromContract } = require('../../../commons')

const HomeABI = bridgeConfig.homeBridgeAbi
const ForeignABI = bridgeConfig.foreignBridgeAbi

const {
  COMMON_FOREIGN_BRIDGE_ADDRESS,
  COMMON_FOREIGN_GAS_PRICE_FALLBACK,
  COMMON_FOREIGN_GAS_PRICE_SUPPLIER_URL,
  COMMON_FOREIGN_GAS_PRICE_SPEED_TYPE,
  ORACLE_FOREIGN_GAS_PRICE_UPDATE_INTERVAL,
  COMMON_FOREIGN_GAS_PRICE_FACTOR,
  COMMON_HOME_BRIDGE_ADDRESS,
  COMMON_HOME_GAS_PRICE_FALLBACK,
  COMMON_HOME_GAS_PRICE_SUPPLIER_URL,
  COMMON_HOME_GAS_PRICE_SPEED_TYPE,
  ORACLE_HOME_GAS_PRICE_UPDATE_INTERVAL,
  COMMON_HOME_GAS_PRICE_FACTOR
} = process.env

const homeBridge = new web3Home.eth.Contract(HomeABI, COMMON_HOME_BRIDGE_ADDRESS)

const foreignBridge = new web3Foreign.eth.Contract(ForeignABI, COMMON_FOREIGN_BRIDGE_ADDRESS)

let cachedGasPrice = null

let fetchGasPriceInterval = null

const fetchGasPrice = async (speedType, factor, bridgeContract, oracleFetchFn) => {
  const contractOptions = { logger }
  const oracleOptions = { speedType, factor, limits: GAS_PRICE_BOUNDARIES, logger }
  cachedGasPrice =
    (await gasPriceFromOracle(oracleFetchFn, oracleOptions)) ||
    (await gasPriceFromContract(bridgeContract, contractOptions)) ||
    cachedGasPrice
  return cachedGasPrice
}

async function start(chainId) {
  clearInterval(fetchGasPriceInterval)

  let bridgeContract = null
  let oracleUrl = null
  let speedType = null
  let updateInterval = null
  let factor = null
  if (chainId === 'home') {
    bridgeContract = homeBridge
    oracleUrl = COMMON_HOME_GAS_PRICE_SUPPLIER_URL
    speedType = COMMON_HOME_GAS_PRICE_SPEED_TYPE
    updateInterval = ORACLE_HOME_GAS_PRICE_UPDATE_INTERVAL || DEFAULT_UPDATE_INTERVAL
    factor = Number(COMMON_HOME_GAS_PRICE_FACTOR) || DEFAULT_GAS_PRICE_FACTOR

    cachedGasPrice = COMMON_HOME_GAS_PRICE_FALLBACK
  } else if (chainId === 'foreign') {
    bridgeContract = foreignBridge
    oracleUrl = COMMON_FOREIGN_GAS_PRICE_SUPPLIER_URL
    speedType = COMMON_FOREIGN_GAS_PRICE_SPEED_TYPE
    updateInterval = ORACLE_FOREIGN_GAS_PRICE_UPDATE_INTERVAL || DEFAULT_UPDATE_INTERVAL
    factor = Number(COMMON_FOREIGN_GAS_PRICE_FACTOR) || DEFAULT_GAS_PRICE_FACTOR

    cachedGasPrice = COMMON_FOREIGN_GAS_PRICE_FALLBACK
  } else {
    throw new Error(`Unrecognized chainId '${chainId}'`)
  }

  fetchGasPriceInterval = setIntervalAndRun(
    () => fetchGasPrice(speedType, factor, bridgeContract, () => fetch(oracleUrl)),
    updateInterval
  )
}

function getPrice() {
  return cachedGasPrice
}

module.exports = {
  start,
  getPrice,
  fetchGasPrice
}
