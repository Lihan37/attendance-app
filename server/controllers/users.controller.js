const { ObjectId } = require('mongodb')
const { getCollections } = require('../db')

const localUsers = new Map()

async function syncUsers(req, res, next) {
  try {
    const users = Array.isArray(req.body) ? req.body : req.body.users

    if (!Array.isArray(users)) {
      return res.status(400).json({ message: 'users must be an array.' })
    }

    const syncedAt = new Date()

    let usersCollection
    let deletedUsers

    if (users.length === 0) {
      return res.json({ synced: 0, syncedAt })
    }

    try {
      ;({ users: usersCollection, deletedUsers } = getCollections())
    } catch (_error) {
      users.forEach((user) => {
        const key = `${user.userId}-${user.deviceIp || ''}`
        localUsers.set(key, {
          userId: String(user.userId),
          name: user.name || '',
          cardNumber: String(user.cardNumber || ''),
          deviceName: user.deviceName || '',
          deviceIp: user.deviceIp || '',
          syncedAt,
        })
      })

      return res.json({ synced: users.length, syncedAt, localOnly: true })
    }

    const validUsers = users.filter((user) => String(user.userId || '').trim())

    if (validUsers.length === 0) {
      return res.json({ synced: 0, skippedInvalid: users.length, syncedAt })
    }

    const deletedKeys = new Set(
      (
        await deletedUsers
          .find({
            $or: validUsers.flatMap((user) => [
              {
                userId: String(user.userId),
                deviceIp: user.deviceIp || '',
              },
              {
                userId: String(user.userId),
                deviceIp: '',
              },
            ]),
          })
          .toArray()
      ).map((user) => `${user.userId}-${user.deviceIp || ''}`),
    )

    const activeUsers = validUsers.filter(
      (user) =>
        !deletedKeys.has(`${String(user.userId)}-${user.deviceIp || ''}`) &&
        !deletedKeys.has(`${String(user.userId)}-`),
    )

    if (activeUsers.length > 0) {
      await usersCollection.bulkWrite(
        activeUsers.map((user) => ({
          updateOne: {
            filter: {
              userId: String(user.userId),
              deviceIp: user.deviceIp,
            },
            update: {
              $set: {
                userId: String(user.userId),
                name: user.name || '',
                cardNumber: String(user.cardNumber || ''),
                deviceName: user.deviceName || '',
                deviceIp: user.deviceIp || '',
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
      synced: activeUsers.length,
      skippedDeleted: validUsers.length - activeUsers.length,
      skippedInvalid: users.length - validUsers.length,
      syncedAt,
    })
  } catch (error) {
    return next(error)
  }
}

async function getUsers(req, res, next) {
  try {
    let users
    let deletedUsers

    try {
      ;({ users, deletedUsers } = getCollections())
    } catch (_error) {
      return res.json(Array.from(localUsers.values()).sort((a, b) => a.userId.localeCompare(b.userId)))
    }

    const data = await users.find({}).sort({ userId: 1 }).toArray()
    return res.json(data)
  } catch (error) {
    return next(error)
  }
}

async function deleteUser(req, res, next) {
  try {
    const { _id, userId, deviceIp } = req.body || {}

    if (!_id && !userId) {
      return res.status(400).json({ message: 'userId or _id is required.' })
    }

    let users
    let deletedUsers

    try {
      ;({ users, deletedUsers } = getCollections())
    } catch (_error) {
      const key = `${userId}-${deviceIp || ''}`
      localUsers.delete(key)
      return res.json({ deleted: 1, localOnly: true })
    }

    const deleteFilter = _id ? { _id: new ObjectId(_id) } : { userId: String(userId) }

    if (!_id && deviceIp) {
      deleteFilter.deviceIp = deviceIp
    }

    const result = await users.deleteMany(deleteFilter)

    if (userId) {
      const tombstoneFilter = {
        userId: String(userId),
        deviceIp: deviceIp || '',
      }

      await deletedUsers.updateOne(
        tombstoneFilter,
        { $set: { ...tombstoneFilter, deletedAt: new Date() } },
        { upsert: true },
      )
    }

    return res.json({ deleted: result.deletedCount })
  } catch (error) {
    return next(error)
  }
}

async function deleteAllUsers(req, res, next) {
  try {
    let users
    let deletedUsers

    try {
      ;({ users, deletedUsers } = getCollections())
    } catch (_error) {
      const deleted = localUsers.size
      localUsers.clear()
      return res.json({ deleted, localOnly: true })
    }

    await deletedUsers.deleteMany({})
    const result = await users.deleteMany({})
    return res.json({ deleted: result.deletedCount })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  syncUsers,
  getUsers,
  deleteUser,
  deleteAllUsers,
}
