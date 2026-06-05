require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { connectDB, getMongoStatus } = require('./db')
const usersRoutes = require('./routes/users.routes')
const attendanceRoutes = require('./routes/attendance.routes')

function createApp({ logger } = {}) {
  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '5mb' }))

  app.use((req, res, next) => {
    const startedAt = Date.now()
    res.on('finish', () => {
      logger?.info?.(`API ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`)
    })
    next()
  })

  app.get('/api/health', async (_req, res) => {
    try {
      const mongo = await getMongoStatus()
      return res.json({
        server: 'running',
        mongo,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      return res.status(503).json({
        server: 'running',
        mongo: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      })
    }
  })

  app.use('/api/users', usersRoutes)
  app.use('/api/attendance', attendanceRoutes)

  app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
  })

  app.use((error, _req, res, _next) => {
    logger?.error?.(error.stack || error.message)
    console.error(error)
    res.status(500).json({ message: error.message || 'Internal server error.' })
  })

  return app
}

async function startServer({ port = Number(process.env.PORT || 5000), logger } = {}) {
  try {
    await connectDB()
  } catch (error) {
    const message = `MongoDB is not connected: ${error.message}`
    logger?.warn?.(message)
    logger?.warn?.('API server will still start. Add DB_USER and DB_PASS to .env to enable persistence.')
    console.warn(message)
    console.warn('API server will still start. Add DB_USER and DB_PASS to .env to enable persistence.')
  }

  return new Promise((resolve, reject) => {
    const app = createApp({ logger })
    const server = app.listen(port, '127.0.0.1', () => {
      console.log(`Attendance API running on http://localhost:${port}`)
      logger?.info?.(`Attendance API running on http://127.0.0.1:${port}`)
      resolve(server)
    })

    server.on('error', (error) => {
      logger?.error?.(`Unable to start server: ${error.message}`)
      reject(error)
    })
  })
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`Unable to start server: ${error.message}`)
    process.exit(1)
  })
}

module.exports = {
  createApp,
  startServer,
}
