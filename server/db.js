const { MongoClient, ServerApiVersion } = require('mongodb')

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g9xsrko.mongodb.net/?appName=Cluster0`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

let db
let connected = false

async function connectDB() {
  if (connected && db) {
    return db
  }

  if (!process.env.DB_USER || !process.env.DB_PASS) {
    throw new Error('DB_USER and DB_PASS are required to connect to MongoDB.')
  }

  await client.connect()
  db = client.db(process.env.DB_NAME || 'attendance_system')

  await Promise.all([
    db.collection('users').createIndex({ userId: 1, deviceIp: 1 }, { unique: true }),
    db
      .collection('attendanceLogs')
      .createIndex({ userId: 1, timestamp: 1, deviceIp: 1 }, { unique: true }),
    db.collection('deletedUsers').createIndex({ userId: 1, deviceIp: 1 }, { unique: true }),
    db
      .collection('deletedAttendanceLogs')
      .createIndex({ userId: 1, timestamp: 1, deviceIp: 1 }, { unique: true }),
    db.collection('deviceConfigs').createIndex({ deviceIp: 1, deviceName: 1 }),
  ])

  connected = true
  return db
}

function getDB() {
  if (!db) {
    throw new Error('Database is not connected. Call connectDB() before getDB().')
  }

  return db
}

function getCollections() {
  const database = getDB()

  return {
    users: database.collection('users'),
    attendanceLogs: database.collection('attendanceLogs'),
    deletedUsers: database.collection('deletedUsers'),
    deletedAttendanceLogs: database.collection('deletedAttendanceLogs'),
    deviceConfigs: database.collection('deviceConfigs'),
  }
}

async function getMongoStatus() {
  if (!connected || !db) {
    return 'disconnected'
  }

  await db.command({ ping: 1 })
  return 'connected'
}

module.exports = {
  connectDB,
  getDB,
  getCollections,
  getMongoStatus,
}
