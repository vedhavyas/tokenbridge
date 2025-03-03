require('dotenv').config()
const Web3 = require('web3')
const { toBN } = require('web3').utils
const logger = require('../logger')('eventsUtils')
const {
  BRIDGE_MODES,
  ERC_TYPES,
  getBridgeABIs,
  getBridgeMode,
  HOME_ERC_TO_ERC_ABI,
  ERC20_ABI,
  ERC677_BRIDGE_TOKEN_ABI,
  getTokenType,
  getPastEvents
} = require('../../commons')

const {
  COMMON_HOME_RPC_URL,
  COMMON_FOREIGN_RPC_URL,
  COMMON_HOME_BRIDGE_ADDRESS,
  COMMON_FOREIGN_BRIDGE_ADDRESS
} = process.env
const MONITOR_HOME_START_BLOCK = toBN(Number(process.env.MONITOR_HOME_START_BLOCK) || 0)
const MONITOR_FOREIGN_START_BLOCK = toBN(Number(process.env.MONITOR_FOREIGN_START_BLOCK) || 0)

const homeProvider = new Web3.providers.HttpProvider(COMMON_HOME_RPC_URL)
const web3Home = new Web3(homeProvider)

const foreignProvider = new Web3.providers.HttpProvider(COMMON_FOREIGN_RPC_URL)
const web3Foreign = new Web3(foreignProvider)

const { getBlockNumber } = require('./contract')

async function main(mode) {
  const homeErcBridge = new web3Home.eth.Contract(HOME_ERC_TO_ERC_ABI, COMMON_HOME_BRIDGE_ADDRESS)
  const bridgeMode = mode || (await getBridgeMode(homeErcBridge))
  const { HOME_ABI, FOREIGN_ABI } = getBridgeABIs(bridgeMode)
  const homeBridge = new web3Home.eth.Contract(HOME_ABI, COMMON_HOME_BRIDGE_ADDRESS)
  const foreignBridge = new web3Foreign.eth.Contract(FOREIGN_ABI, COMMON_FOREIGN_BRIDGE_ADDRESS)
  const v1Bridge = bridgeMode === BRIDGE_MODES.NATIVE_TO_ERC_V1
  const erc20MethodName = bridgeMode === BRIDGE_MODES.NATIVE_TO_ERC || v1Bridge ? 'erc677token' : 'erc20token'
  const erc20Address = await foreignBridge.methods[erc20MethodName]().call()
  const tokenType = await getTokenType(
    new web3Foreign.eth.Contract(ERC677_BRIDGE_TOKEN_ABI, erc20Address),
    COMMON_FOREIGN_BRIDGE_ADDRESS
  )
  const isExternalErc20 = tokenType === ERC_TYPES.ERC20
  const erc20Contract = new web3Foreign.eth.Contract(ERC20_ABI, erc20Address)

  logger.debug('getting last block numbers')
  const [homeBlockNumber, foreignBlockNumber] = await getBlockNumber(web3Home, web3Foreign)

  logger.debug("calling homeBridge.getPastEvents('UserRequestForSignature')")
  const homeDeposits = await getPastEvents(homeBridge, {
    event: v1Bridge ? 'Deposit' : 'UserRequestForSignature',
    fromBlock: MONITOR_HOME_START_BLOCK,
    toBlock: homeBlockNumber
  })

  logger.debug("calling foreignBridge.getPastEvents('RelayedMessage')")
  const foreignDeposits = await getPastEvents(foreignBridge, {
    event: v1Bridge ? 'Deposit' : 'RelayedMessage',
    fromBlock: MONITOR_FOREIGN_START_BLOCK,
    toBlock: foreignBlockNumber
  })

  logger.debug("calling homeBridge.getPastEvents('AffirmationCompleted')")
  const homeWithdrawals = await getPastEvents(homeBridge, {
    event: v1Bridge ? 'Withdraw' : 'AffirmationCompleted',
    fromBlock: MONITOR_HOME_START_BLOCK,
    toBlock: homeBlockNumber
  })

  logger.debug("calling foreignBridge.getPastEvents('UserRequestForAffirmation')")
  const foreignWithdrawals = isExternalErc20
    ? await getPastEvents(erc20Contract, {
        event: 'Transfer',
        fromBlock: MONITOR_FOREIGN_START_BLOCK,
        toBlock: foreignBlockNumber,
        options: {
          filter: { to: COMMON_FOREIGN_BRIDGE_ADDRESS }
        }
      })
    : await getPastEvents(foreignBridge, {
        event: v1Bridge ? 'Withdraw' : 'UserRequestForAffirmation',
        fromBlock: MONITOR_FOREIGN_START_BLOCK,
        toBlock: foreignBlockNumber
      })
  logger.debug('Done')
  return {
    homeDeposits,
    foreignDeposits,
    homeWithdrawals,
    foreignWithdrawals,
    isExternalErc20
  }
}

module.exports = main
