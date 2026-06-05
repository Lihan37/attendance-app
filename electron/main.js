const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const axios = require('axios')
const logger = require('./logger')
const {
  connectDevice,
  getUsers,
  getAttendances,
  disconnectDevice,
} = require('../server/device/zkteco.service')

const isDev = !app.isPackaged
let mainWindow
let splashWindow
let reconnectTimer
let lastDeviceConfig

const singleInstanceLock = app.requestSingleInstanceLock()

if (!singleInstanceLock) {
  app.quit()
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 280,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: '#111827',
    show: true,
  })

  splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <html>
        <body style="margin:0;background:#111827;color:#f9fafb;font-family:Segoe UI,Arial,sans-serif;display:flex;height:100vh;align-items:center;justify-content:center;">
          <div style="text-align:center">
            <div style="font-size:22px;font-weight:700;margin-bottom:8px;">Attendance Management Software</div>
            <div style="color:#2dd4bf;font-size:14px;">Starting services...</div>
          </div>
        </body>
      </html>
    `)}`,
  )
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#111827',
    title: 'Attendance Management Software',
    icon: path.join(__dirname, '../build/icon.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#111827',
      symbolColor: '#f9fafb',
      height: 34,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
    }
    mainWindow.show()
  })

  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    logger.error(`Renderer failed to load: ${code} ${description}`)
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    logger.info(`Renderer console(${level}) ${sourceId}:${line} ${message}`)
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-react/index.html'))
  }
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '')
}

async function postRemote({ baseUrl, route, payload, queueType }) {
  const target = normalizeBaseUrl(baseUrl)
  if (!target) {
    throw new Error('Backend Base URL is required.')
  }

  const { data } = await axios.post(`${target}${route}`, payload, { timeout: 15000 })
  logger.info(`Synced ${queueType} to ${target}${route}`)
  return data
}

function startAutoReconnect() {
  if (reconnectTimer) {
    clearInterval(reconnectTimer)
  }

  reconnectTimer = setInterval(async () => {
    if (!lastDeviceConfig) return

    try {
      const result = await connectDevice(lastDeviceConfig)
      logger.info(`Auto reconnect result: ${result.message}`)
    } catch (error) {
      logger.warn(`Auto reconnect failed: ${error.message}`)
    }
  }, 60000)
}

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData')
  logger.initLogger(userDataPath)
  logger.info(`App data path: ${userDataPath}`)

  createSplashWindow()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('second-instance', () => {
  if (!mainWindow) return

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.focus()
})

app.on('before-quit', async () => {
  if (reconnectTimer) clearInterval(reconnectTimer)
  await disconnectDevice()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('device:connect', async (_event, config) => {
  lastDeviceConfig = config
  const result = await connectDevice(config)
  logger.info(`Device connection: ${result.message}`)
  startAutoReconnect()
  return result
})

ipcMain.handle('device:users', async () => {
  return getUsers()
})

ipcMain.handle('device:attendance', async () => {
  return getAttendances()
})

ipcMain.handle('sync:users', async (_event, { baseUrl, users }) => {
  return postRemote({
    baseUrl,
    route: '/api/users/sync',
    payload: { users },
    queueType: 'users',
  })
})

ipcMain.handle('sync:attendance', async (_event, { baseUrl, logs }) => {
  return postRemote({
    baseUrl,
    route: '/api/attendance/sync',
    payload: { logs },
    queueType: 'attendance',
  })
})
