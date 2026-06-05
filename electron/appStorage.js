const fs = require('fs')
const path = require('path')

const DEFAULT_DATA = {
  settings: {
    baseUrl: 'http://127.0.0.1:5000',
    deviceConfig: {
      deviceName: '',
      ipAddress: '192.168.0.5',
      port: '4370',
      password: '0',
      useTcp: true,
    },
  },
  cache: {
    users: [],
    attendance: [],
  },
  queues: {
    users: [],
    attendance: [],
  },
}

let dataFile

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function initStorage(userDataPath) {
  dataFile = path.join(userDataPath, 'app-storage.json')
  fs.mkdirSync(userDataPath, { recursive: true })

  if (!fs.existsSync(dataFile)) {
    writeData(DEFAULT_DATA)
  }
}

function readData() {
  if (!dataFile) {
    throw new Error('Storage has not been initialized.')
  }

  try {
    return {
      ...clone(DEFAULT_DATA),
      ...JSON.parse(fs.readFileSync(dataFile, 'utf8')),
    }
  } catch (_error) {
    return clone(DEFAULT_DATA)
  }
}

function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2))
}

function getSettings() {
  return readData().settings
}

function saveSettings(settings) {
  const data = readData()
  data.settings = {
    baseUrl: settings.baseUrl || data.settings.baseUrl,
    deviceConfig: {
      ...data.settings.deviceConfig,
      ...(settings.deviceConfig || {}),
    },
  }
  writeData(data)
  return data.settings
}

function getCache() {
  return readData().cache
}

function saveCache({ users, attendance }) {
  const data = readData()
  if (Array.isArray(users)) data.cache.users = users
  if (Array.isArray(attendance)) data.cache.attendance = attendance
  writeData(data)
  return data.cache
}

function enqueueUsers(users) {
  const data = readData()
  data.queues.users.push(...users)
  writeData(data)
  return data.queues.users.length
}

function enqueueAttendance(logs) {
  const data = readData()
  const existing = new Set(
    data.queues.attendance.map((log) => `${log.userId}-${log.timestamp}-${log.deviceIp}`),
  )

  logs.forEach((log) => {
    const key = `${log.userId}-${log.timestamp}-${log.deviceIp}`
    if (!existing.has(key)) {
      existing.add(key)
      data.queues.attendance.push(log)
    }
  })

  writeData(data)
  return data.queues.attendance.length
}

function getQueues() {
  return readData().queues
}

function clearQueue(queueName) {
  const data = readData()
  data.queues[queueName] = []
  writeData(data)
}

function deleteCachedUser({ userId, deviceIp }) {
  const data = readData()
  data.cache.users = data.cache.users.filter(
    (user) => !(String(user.userId) === String(userId) && String(user.deviceIp || '') === String(deviceIp || '')),
  )
  data.queues.users = data.queues.users.filter(
    (user) => !(String(user.userId) === String(userId) && String(user.deviceIp || '') === String(deviceIp || '')),
  )
  writeData(data)
  return data.cache.users
}

function deleteCachedAttendance({ userId, timestamp, deviceIp }) {
  const data = readData()
  const matches = (log) =>
    String(log.userId) === String(userId) &&
    String(log.timestamp) === String(timestamp) &&
    String(log.deviceIp || '') === String(deviceIp || '')

  data.cache.attendance = data.cache.attendance.filter((log) => !matches(log))
  data.queues.attendance = data.queues.attendance.filter((log) => !matches(log))
  writeData(data)
  return data.cache.attendance
}

module.exports = {
  initStorage,
  getSettings,
  saveSettings,
  getCache,
  saveCache,
  enqueueUsers,
  enqueueAttendance,
  getQueues,
  clearQueue,
  deleteCachedUser,
  deleteCachedAttendance,
}
