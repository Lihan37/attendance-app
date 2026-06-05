import { useEffect, useMemo, useRef, useState } from 'react'
import DataTable from './components/DataTable.jsx'
import FormField from './components/FormField.jsx'
import StatusMessage from './components/StatusMessage.jsx'
import {
  fetchAttendanceFromApi,
  fetchUsersFromApi,
  deleteAllAttendanceFromApi,
  deleteAllUsersFromApi,
  deleteAttendanceFromApi,
  deleteUserFromApi,
  normalizeBaseUrl,
  syncAttendanceToApi,
  syncUsersToApi,
} from './services/apiClient.js'

const DEFAULT_CONFIG = {
  deviceName: '',
  ipAddress: '192.168.0.120',
  port: '4370',
  password: '0',
  useTcp: true,
}

const DEFAULT_BASE_URL = 'https://attendance-app-production-f38f.up.railway.app'

function getSavedState() {
  try {
    const savedBaseUrl = localStorage.getItem('attendance.baseUrl') || DEFAULT_BASE_URL
    const baseUrl =
      savedBaseUrl.includes('127.0.0.1') || savedBaseUrl.includes('localhost')
        ? DEFAULT_BASE_URL
        : savedBaseUrl

    return {
      baseUrl,
      deviceConfig: {
        ...DEFAULT_CONFIG,
        ...JSON.parse(localStorage.getItem('attendance.deviceConfig') || '{}'),
      },
    }
  } catch (_error) {
    return { baseUrl: DEFAULT_BASE_URL, deviceConfig: DEFAULT_CONFIG }
  }
}

export default function App() {
  const saved = useMemo(getSavedState, [])
  const [baseUrl, setBaseUrl] = useState(saved.baseUrl)
  const [deviceConfig, setDeviceConfig] = useState(saved.deviceConfig)
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [attendance, setAttendance] = useState([])
  const [message, setMessage] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pollingTimer = useRef(null)

  const electronReady = Boolean(window.electronAPI)

  function buildUsersFromAttendance(logs) {
    const usersById = new Map()

    logs.forEach((log) => {
      if (!log.userId || usersById.has(log.userId)) return

      usersById.set(log.userId, {
        userId: log.userId,
        name: 'Unknown User',
        cardNumber: '',
        deviceName: log.deviceName || deviceConfig.deviceName,
        deviceIp: log.deviceIp || deviceConfig.ipAddress,
      })
    })

    return Array.from(usersById.values())
  }

  function isValidAttendanceLog(log) {
    const timestamp = new Date(log.timestamp)
    return Boolean(log.userId) && !Number.isNaN(timestamp.getTime()) && timestamp.getFullYear() > 2000
  }

  function mergeByKey(currentRows, nextRows, getKey) {
    const rows = new Map()

    currentRows.forEach((row) => rows.set(getKey(row), row))
    nextRows.forEach((row) => rows.set(getKey(row), row))

    return Array.from(rows.values())
  }

  async function pullDeviceData({ silent = false, targetBaseUrl = baseUrl } = {}) {
    if (!electronReady) {
      throw new Error('Electron API is unavailable. Run the desktop app.')
    }

    const [deviceUsers, deviceAttendance] = await Promise.all([
      window.electronAPI.fetchUsers(),
      window.electronAPI.fetchAttendance(),
    ])

    const validAttendance = deviceAttendance.filter(isValidAttendanceLog)
    const displayUsers =
      deviceUsers.length > 0 ? deviceUsers : buildUsersFromAttendance(validAttendance)

    await syncCollectedData(displayUsers, validAttendance, targetBaseUrl)

    const targetUrl = normalizeBaseUrl(targetBaseUrl)
    const [backendUsers, backendAttendance] = await Promise.all([
      fetchUsersFromApi(targetUrl),
      fetchAttendanceFromApi(targetUrl),
    ])

    setUsers(backendUsers)
    setAttendance(backendAttendance.filter(isValidAttendanceLog))

    if (!silent) {
      setMessage({ type: 'success', text: 'Latest backend data loaded.' })
    }

    return { users: backendUsers, attendance: backendAttendance }
  }

  function startDevicePolling() {
    if (pollingTimer.current) {
      window.clearInterval(pollingTimer.current)
    }

    pollingTimer.current = window.setInterval(async () => {
      try {
        await pullDeviceData({ silent: true })
      } catch (error) {
        setMessage({ type: 'error', text: error.message })
      }
    }, 10000)
  }

  function updateConfig(key, value) {
    setDeviceConfig((current) => ({ ...current, [key]: value }))
  }

  async function saveSettings() {
    const nextBaseUrl = normalizeBaseUrl(baseUrl)

    localStorage.setItem('attendance.baseUrl', nextBaseUrl)
    localStorage.setItem('attendance.deviceConfig', JSON.stringify(deviceConfig))
    setBaseUrl(nextBaseUrl)
    setMessage({ type: 'success', text: 'Settings saved.' })
    return nextBaseUrl
  }

  async function syncCollectedData(nextUsers, nextAttendance, targetBaseUrl = baseUrl) {
    const targetUrl = normalizeBaseUrl(targetBaseUrl)

    if (electronReady) {
      await window.electronAPI.syncUsers({ baseUrl: targetUrl, users: nextUsers })
      await window.electronAPI.syncAttendance({ baseUrl: targetUrl, logs: nextAttendance })
      return
    }

    await syncUsersToApi(targetUrl, nextUsers)
    await syncAttendanceToApi(targetUrl, nextAttendance)
  }

  async function handleConnect() {
    setIsConnecting(true)
    setMessage({ type: 'info', text: 'Connecting to biometric device...' })

    try {
      const targetBaseUrl = await saveSettings()

      if (!electronReady) {
        throw new Error('Electron API is unavailable. Run the app with npm run dev:all or npm run electron.')
      }

      const connection = await window.electronAPI.connectDevice(deviceConfig)

      if (connection.mock) {
        setUsers([])
        setAttendance([])
        setMessage({
          type: 'error',
          text: `${connection.message} Real device connection is required before syncing data.`,
        })
        return
      }

      await pullDeviceData({ silent: true, targetBaseUrl })
      startDevicePolling()

      setMessage({
        type: connection.mock ? 'info' : 'success',
        text: `${connection.message} Auto refresh is running every 10 seconds.`,
      })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsConnecting(false)
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true)
    setMessage({ type: 'info', text: 'Refreshing data...' })

    try {
      const targetUrl = normalizeBaseUrl(baseUrl)
      const [latestUsers, latestAttendance] = await Promise.all([
        fetchUsersFromApi(targetUrl),
        fetchAttendanceFromApi(targetUrl),
      ])

      setUsers(latestUsers)
      setAttendance(latestAttendance)
      setMessage({ type: 'success', text: 'Latest server data loaded.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleDeleteRow(row) {
    const confirmed = window.confirm('Delete this row from backend data?')
    if (!confirmed) return

    try {
      if (activeTab === 'users') {
        await deleteUserFromApi(baseUrl, {
          userId: row.userId,
          _id: row._id,
          deviceIp: row.deviceIp,
        })

        const nextUsers = users.filter(
          (user) =>
            !(
              String(user._id || '') === String(row._id || '') ||
              String(user.userId) === String(row.userId) &&
              String(user.deviceIp || '') === String(row.deviceIp || '')
            ),
        )

        setUsers(nextUsers)
      } else {
        await deleteAttendanceFromApi(baseUrl, {
          userId: row.userId,
          timestamp: row.timestamp,
          deviceIp: row.deviceIp,
        })

        const nextAttendance = attendance.filter(
          (log) =>
            !(
              String(log.userId) === String(row.userId) &&
              String(log.timestamp) === String(row.timestamp) &&
              String(log.deviceIp || '') === String(row.deviceIp || '')
            ),
        )

        setAttendance(nextAttendance)
      }

      setMessage({ type: 'success', text: 'Row deleted from backend.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  async function handleDeleteAll() {
    const label = activeTab === 'users' ? 'all users' : 'all attendance logs'
    const confirmed = window.confirm(`Delete ${label} from backend?`)
    if (!confirmed) return

    try {
      if (activeTab === 'users') {
        await deleteAllUsersFromApi(baseUrl)
        setUsers([])
      } else {
        await deleteAllAttendanceFromApi(baseUrl)
        setAttendance([])
      }

      setMessage({ type: 'success', text: `${label} deleted from backend.` })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  useEffect(() => {
    const timer = message ? window.setTimeout(() => setMessage(null), 5000) : null
    return () => {
      if (timer) window.clearTimeout(timer)
    }
  }, [message])

  useEffect(() => {
    return () => {
      if (pollingTimer.current) {
        window.clearInterval(pollingTimer.current)
      }
    }
  }, [])

  return (
    <main className="flex h-screen flex-col bg-[#e8e8e8]">
      <div className="h-[34px] shrink-0 bg-gray-900" />

      <section className="flex flex-1 flex-col px-8 pb-6 pt-5">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-normal text-gray-900">
            Attendance Management Software
          </h1>
          <p className="mt-1 text-base font-semibold text-gray-700">Real Time Data</p>
        </header>

        <div className="mt-5 flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-700" htmlFor="baseUrl">
            Base URL:
          </label>
          <input
            id="baseUrl"
            className="h-10 flex-1 rounded-sm border border-gray-400 bg-white px-3 text-gray-900 outline-none transition focus:border-[#008b88] focus:ring-2 focus:ring-teal-100"
            placeholder="https://attendance-app-production-f38f.up.railway.app"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
          <button
            className="h-10 rounded-full bg-[#008b88] px-8 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007a77] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={saveSettings}
          >
            Save
          </button>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(360px,520px)_1fr] gap-6">
          <div className="space-y-3">
            <FormField
              label="Device Name"
              value={deviceConfig.deviceName}
              onChange={(event) => updateConfig('deviceName', event.target.value)}
            />
            <FormField
              label="IP Address"
              value={deviceConfig.ipAddress}
              onChange={(event) => updateConfig('ipAddress', event.target.value)}
            />
            <FormField
              label="Port"
              type="number"
              value={deviceConfig.port}
              onChange={(event) => updateConfig('port', event.target.value)}
            />
            <FormField
              label="Password"
              type="number"
              value={deviceConfig.password}
              onChange={(event) => updateConfig('password', event.target.value)}
            />

            <label className="flex items-center gap-3 pl-[124px] text-sm font-semibold text-gray-700">
              <input
                checked={deviceConfig.useTcp}
                className="h-4 w-4 accent-[#008b88]"
                type="checkbox"
                onChange={(event) => updateConfig('useTcp', event.target.checked)}
              />
              <span>Uncheck to use UDP</span>
            </label>

            <button
              className="ml-[124px] h-10 rounded-full bg-[#008b88] px-10 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007a77] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>

          <div className="flex items-start justify-end">
            <StatusMessage message={message} />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                activeTab === 'users'
                  ? 'bg-[#008b88] text-white'
                  : 'border border-gray-400 bg-white text-gray-700 hover:border-[#008b88]'
              }`}
              type="button"
              onClick={() => setActiveTab('users')}
            >
              Users Data
            </button>
            <button
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                activeTab === 'attendance'
                  ? 'bg-[#008b88] text-white'
                  : 'border border-gray-400 bg-white text-gray-700 hover:border-[#008b88]'
              }`}
              type="button"
              onClick={() => setActiveTab('attendance')}
            >
              Attendances Data From Server
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="rounded-full border border-red-300 bg-red-50 px-6 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleDeleteAll}
              disabled={activeTab === 'users' ? users.length === 0 : attendance.length === 0}
            >
              Delete All
            </button>
            <button
              className="rounded-full bg-[#008b88] px-7 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007a77] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <DataTable
          activeTab={activeTab}
          users={users}
          attendance={attendance}
          onDeleteRow={handleDeleteRow}
        />

        <footer className="shrink-0 pt-4 text-right text-sm font-semibold text-gray-700">
          Powered by National IT Hub
        </footer>
      </section>
    </main>
  )
}
