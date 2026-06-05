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

    const deletedKeys = new Set(
      (
        await deletedUsers
          .find({
            $or: users.map((user) => ({
              userId: String(user.userId),
              deviceIp: user.deviceIp || '',
            })),
          })
          .toArray()
      ).map((user) => `${user.userId}-${user.deviceIp || ''}`),
    )

    const activeUsers = users.filter(
      (user) => !deletedKeys.has(`${String(user.userId)}-${user.deviceIp || ''}`),
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

    return res.json({ synced: activeUsers.length, skippedDeleted: users.length - activeUsers.length, syncedAt })
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
    const { userId, deviceIp } = req.body || {}

    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' })
    }

    let users

    try {
      ;({ users } = getCollections())
    } catch (_error) {
      const key = `${userId}-${deviceIp || ''}`
      localUsers.delete(key)
      return res.json({ deleted: 1, localOnly: true })
    }

    const filter = {
      userId: String(userId),
      deviceIp: deviceIp || '',
    }

    const result = await users.deleteOne(filter)
    await deletedUsers.updateOne(
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
  syncUsers,
  getUsers,
  deleteUser,
}
