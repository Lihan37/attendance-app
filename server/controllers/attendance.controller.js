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
    let deletedAttendanceLogs

    if (logs.length === 0) {
      return res.json({ synced: 0, syncedAt })
    }

    try {
      ;({ attendanceLogs, deletedAttendanceLogs } = getCollections())
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

    const deletedKeys = new Set(
      (
        await deletedAttendanceLogs
          .find({
            $or: normalizedLogs.map((log) => ({
              userId: log.userId,
              timestamp: log.timestamp,
              deviceIp: log.deviceIp,
            })),
          })
          .toArray()
      ).map((log) => getAttendanceKey(log)),
    )

    const activeLogs = normalizedLogs.filter(
      (log) =>
        !deletedKeys.has(getAttendanceKey(log)) &&
        !deletedKeys.has(getAttendanceKey({ ...log, deviceIp: '' })),
    )

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

    return res.json({ synced: activeLogs.length, skippedDeleted: logs.length - activeLogs.length, syncedAt })
  } catch (error) {
    return next(error)
  }
}

async function getAttendance(req, res, next) {
  try {
    let attendanceLogs
    let deletedAttendanceLogs

    try {
      ;({ attendanceLogs, deletedAttendanceLogs } = getCollections())
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
    await deletedAttendanceLogs.updateOne(
      {
        userId: String(userId),
        timestamp: normalizedTimestamp,
        deviceIp: deviceIp || '',
      },
      {
        $set: {
          userId: String(userId),
          timestamp: normalizedTimestamp,
          deviceIp: deviceIp || '',
          deletedAt: new Date(),
        },
      },
      { upsert: true },
    )

    return res.json({ deleted: result.deletedCount })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  syncAttendance,
  getAttendance,
  deleteAttendance,
}
