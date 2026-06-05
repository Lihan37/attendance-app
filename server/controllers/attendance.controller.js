const { getCollections } = require('../db')

const localAttendanceLogs = new Map()

function normalizeTimestamp(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function getAttendanceKey({ userId, timestamp, deviceIp }) {
  return `${String(userId)}-${timestamp}-${deviceIp || ''}`
}

async function syncAttendance(req, res, next) {
  try {
    const logs = Array.isArray(req.body) ? req.body : req.body.logs

    if (!Array.isArray(logs)) {
      return res.status(400).json({ message: 'logs must be an array.' })
    }

    const syncedAt = new Date()

    let attendanceLogs

    if (logs.length === 0) {
      return res.json({ synced: 0, syncedAt })
    }

    try {
      ;({ attendanceLogs } = getCollections())
    } catch (_error) {
      logs.forEach((log) => {
        const timestamp = normalizeTimestamp(log.timestamp)
        if (!log.userId || !timestamp) return

        const key = getAttendanceKey({ userId: log.userId, timestamp, deviceIp: log.deviceIp })

        localAttendanceLogs.set(key, {
          userId: String(log.userId),
          timestamp,
          verifyType: log.verifyType || '',
          deviceName: log.deviceName || '',
          deviceIp: log.deviceIp || '',
          syncedAt,
        })
      })

      return res.json({ synced: logs.length, syncedAt, localOnly: true })
    }

    const normalizedLogs = logs
      .map((log) => {
        const timestamp = normalizeTimestamp(log.timestamp)
        if (!log.userId || !timestamp) return null

        return {
          ...log,
          userId: String(log.userId),
          timestamp,
          deviceIp: log.deviceIp || '',
        }
      })
      .filter(Boolean)

    if (normalizedLogs.length === 0) {
      return res.json({ synced: 0, skippedInvalid: logs.length, syncedAt })
    }

    const activeLogs = normalizedLogs

    if (activeLogs.length > 0) {
      await attendanceLogs.bulkWrite(
        activeLogs.map((log) => ({
          updateOne: {
            filter: {
              userId: log.userId,
              timestamp: log.timestamp,
              deviceIp: log.deviceIp,
            },
            update: {
              $set: {
                userId: log.userId,
                timestamp: log.timestamp,
                verifyType: log.verifyType || '',
                deviceName: log.deviceName || '',
                deviceIp: log.deviceIp || '',
                syncedAt,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      )
    }

    return res.json({
      synced: activeLogs.length,
      skippedDeleted: 0,
      skippedInvalid: logs.length - normalizedLogs.length,
      syncedAt,
    })
  } catch (error) {
    return next(error)
  }
}

async function getAttendance(req, res, next) {
  try {
    let attendanceLogs

    try {
      ;({ attendanceLogs } = getCollections())
    } catch (_error) {
      return res.json(
        Array.from(localAttendanceLogs.values()).sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
        ),
      )
    }

    const data = await attendanceLogs.find({}).sort({ timestamp: -1 }).toArray()
    return res.json(data)
  } catch (error) {
    return next(error)
  }
}

async function deleteAttendance(req, res, next) {
  try {
    const { userId, timestamp, deviceIp } = req.body || {}

    if (!userId || !timestamp) {
      return res.status(400).json({ message: 'userId and timestamp are required.' })
    }

    const normalizedTimestamp = normalizeTimestamp(timestamp)

    if (!normalizedTimestamp) {
      return res.status(400).json({ message: 'timestamp is invalid.' })
    }

    let attendanceLogs

    try {
      ;({ attendanceLogs } = getCollections())
    } catch (_error) {
      const key = getAttendanceKey({ userId, timestamp: normalizedTimestamp, deviceIp })
      localAttendanceLogs.delete(key)
      return res.json({ deleted: 1, localOnly: true })
    }

    const filter = {
      userId: String(userId),
      timestamp: normalizedTimestamp,
    }

    if (deviceIp) {
      filter.deviceIp = deviceIp
    }

    const result = await attendanceLogs.deleteMany(filter)

    return res.json({ deleted: result.deletedCount })
  } catch (error) {
    return next(error)
  }
}

async function deleteAllAttendance(req, res, next) {
  try {
    let attendanceLogs
    let deletedAttendanceLogs

    try {
      ;({ attendanceLogs, deletedAttendanceLogs } = getCollections())
    } catch (_error) {
      const deleted = localAttendanceLogs.size
      localAttendanceLogs.clear()
      return res.json({ deleted, localOnly: true })
    }

    const result = await attendanceLogs.deleteMany({})
    return res.json({ deleted: result.deletedCount })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  syncAttendance,
  getAttendance,
  deleteAttendance,
  deleteAllAttendance,
}
