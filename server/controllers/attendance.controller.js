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
    let deletedAttendanceLogs

    if (logs.length === 0) {
      return res.json({ synced: 0, syncedAt })
    }

    try {
      ;({ attendanceLogs, deletedAttendanceLogs } = getCollections())
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

    const normalizedLogs = logs.map((log) => ({
      ...log,
      userId: String(log.userId),
      timestamp: new Date(log.timestamp).toISOString(),
      deviceIp: log.deviceIp || '',
    }))

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
      ).map((log) => `${log.userId}-${log.timestamp}-${log.deviceIp || ''}`),
    )

    const activeLogs = normalizedLogs.filter(
      (log) => !deletedKeys.has(`${log.userId}-${log.timestamp}-${log.deviceIp || ''}`),
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

    const normalizedTimestamp = new Date(timestamp).toISOString()

    let attendanceLogs

    try {
      ;({ attendanceLogs } = getCollections())
    } catch (_error) {
      const key = `${userId}-${normalizedTimestamp}-${deviceIp || ''}`
      localAttendanceLogs.delete(key)
      return res.json({ deleted: 1, localOnly: true })
    }

    const filter = {
      userId: String(userId),
      timestamp: normalizedTimestamp,
      deviceIp: deviceIp || '',
    }

    const result = await attendanceLogs.deleteOne(filter)
    await deletedAttendanceLogs.updateOne(
      filter,
      { $set: { ...filter, deletedAt: new Date() } },
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
