const { getCollections } = require('../db')

const localAttendanceLogs = new Map()

async function syncAttendance(req, res, next) {
  try {
    const logs = Array.isArray(req.body) ? req.body : req.body.logs

    if (!Array.isArray(logs)) {
      return res.status(400).json({ message: 'logs must be an array.' })
    }

    const syncedAt = new Date()

    let attendanceLogs

    try {
      ;({ attendanceLogs } = getCollections())
    } catch (_error) {
      logs.forEach((log) => {
        const timestamp = new Date(log.timestamp).toISOString()
        const key = `${log.userId}-${timestamp}-${log.deviceIp || ''}`

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

    if (logs.length > 0) {
      await attendanceLogs.bulkWrite(
        logs.map((log) => ({
          updateOne: {
            filter: {
              userId: String(log.userId),
              timestamp: new Date(log.timestamp).toISOString(),
              deviceIp: log.deviceIp,
            },
            update: {
              $set: {
                userId: String(log.userId),
                timestamp: new Date(log.timestamp).toISOString(),
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

    return res.json({ synced: logs.length, syncedAt })
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

    const normalizedTimestamp = new Date(timestamp).toISOString()

    let attendanceLogs

    try {
      ;({ attendanceLogs } = getCollections())
    } catch (_error) {
      const key = `${userId}-${normalizedTimestamp}-${deviceIp || ''}`
      localAttendanceLogs.delete(key)
      return res.json({ deleted: 1, localOnly: true })
    }

    const result = await attendanceLogs.deleteOne({
      userId: String(userId),
      timestamp: normalizedTimestamp,
      deviceIp: deviceIp || '',
    })

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
