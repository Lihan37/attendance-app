const fs = require('fs')
const path = require('path')

let logFile

function initLogger(userDataPath) {
  const logsDir = path.join(userDataPath, 'logs')
  fs.mkdirSync(logsDir, { recursive: true })
  logFile = path.join(logsDir, 'attendance-system.log')
}

function write(level, message) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`
  if (logFile) {
    fs.appendFileSync(logFile, line)
  }
  console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](line.trim())
}

module.exports = {
  initLogger,
  info: (message) => write('INFO', message),
  warn: (message) => write('WARN', message),
  error: (message) => write('ERROR', message),
}
