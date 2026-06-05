let ZKLib

try {
  ZKLib = require('zklib-js')
} catch (_error) {
  ZKLib = null
}

let activeDevice = null
let activeConfig = null
let usingMock = true

function normalizeConfig(config = {}) {
  return {
    deviceName: config.deviceName || 'Main Device',
    ipAddress: config.ipAddress || '192.168.0.120',
    port: Number(config.port || 4370),
    password: Number(config.password || 0),
    useTcp: Boolean(config.useTcp),
  }
}

function mockUsers(config = activeConfig) {
  const deviceIp = config?.ipAddress || '192.168.0.120'
  const deviceName = config?.deviceName || 'Main Device'

  return [
    { userId: '1001', name: 'Abdul Karim', cardNumber: '8801001', deviceName, deviceIp },
    { userId: '1002', name: 'Nusrat Jahan', cardNumber: '8801002', deviceName, deviceIp },
    { userId: '1003', name: 'Mahmud Hasan', cardNumber: '8801003', deviceName, deviceIp },
  ]
}

function mockAttendances(config = activeConfig) {
  const deviceIp = config?.ipAddress || '192.168.0.120'
  const deviceName = config?.deviceName || 'Main Device'
  const today = new Date()

  return mockUsers(config).map((user, index) => ({
    userId: user.userId,
    timestamp: new Date(today.getTime() - index * 45 * 60 * 1000).toISOString(),
    verifyType: 'fingerprint',
    deviceName,
    deviceIp,
  }))
}

function mapUser(rawUser, config) {
  return {
    userId: String(
      rawUser.userId ||
        rawUser.userid ||
        rawUser.userID ||
        rawUser.deviceUserId ||
        rawUser.userSn ||
        rawUser.uid ||
        rawUser.user_id ||
        rawUser.id ||
        '',
    ),
    name: rawUser.name || rawUser.username || rawUser.userName || 'Unknown User',
    cardNumber: String(rawUser.cardNumber || rawUser.cardno || rawUser.cardNo || rawUser.card || rawUser.cardNo || ''),
    deviceName: config.deviceName,
    deviceIp: config.ipAddress,
  }
}

function mapAttendance(rawLog, config) {
  const rawTimestamp =
    rawLog.timestamp ||
    rawLog.recordTime ||
    rawLog.attTime ||
    rawLog.punchTime ||
    rawLog.checkTime ||
    rawLog.time ||
    rawLog.dateTime ||
    rawLog.date
  const parsedTimestamp = rawTimestamp ? new Date(rawTimestamp) : new Date()
  const timestamp =
    Number.isNaN(parsedTimestamp.getTime()) || parsedTimestamp.getFullYear() <= 2000
      ? null
      : parsedTimestamp

  if (!timestamp) {
    return null
  }

  return {
    userId: String(
      rawLog.userId ||
        rawLog.userid ||
        rawLog.userID ||
        rawLog.deviceUserId ||
        rawLog.userSn ||
        rawLog.uid ||
        rawLog.user_id ||
        rawLog.id ||
        rawLog.pin ||
        '',
    ),
    timestamp: timestamp.toISOString(),
    verifyType: String(rawLog.verifyType || rawLog.verify || rawLog.type || rawLog.state || rawLog.status || 'unknown'),
    deviceName: config.deviceName,
    deviceIp: config.ipAddress,
  }
}

async function connectDevice(config) {
  activeConfig = normalizeConfig(config)
  usingMock = true

  if (!ZKLib) {
    return {
      connected: true,
      mock: true,
      message: 'node-zklib is unavailable. Mock device data is active.',
      config: activeConfig,
    }
  }

  try {
    activeDevice = new ZKLib(
      activeConfig.ipAddress,
      activeConfig.port,
      10000,
      4000,
      activeConfig.password,
    )
    await activeDevice.createSocket()
    usingMock = false

    return {
      connected: true,
      mock: false,
      message: `Connected to ${activeConfig.deviceName} at ${activeConfig.ipAddress}:${activeConfig.port}.`,
      config: activeConfig,
    }
  } catch (error) {
    activeDevice = null
    usingMock = true

    return {
      connected: true,
      mock: true,
      message: `Device connection failed, using mock data. ${error.message}`,
      config: activeConfig,
    }
  }
}

async function getUsers() {
  if (usingMock || !activeDevice) {
    return mockUsers()
  }

  const response = await activeDevice.getUsers()
  const users = Array.isArray(response?.data) ? response.data : response
  return users.map((user) => mapUser(user, activeConfig))
}

async function getAttendances() {
  if (usingMock || !activeDevice) {
    return mockAttendances()
  }

  const response = await activeDevice.getAttendances()
  const logs = Array.isArray(response?.data) ? response.data : response
  return logs.map((log) => mapAttendance(log, activeConfig)).filter(Boolean)
}

async function disconnectDevice() {
  if (activeDevice && typeof activeDevice.disconnect === 'function') {
    await activeDevice.disconnect()
  }

  activeDevice = null
}

module.exports = {
  connectDevice,
  getUsers,
  getAttendances,
  disconnectDevice,
}
