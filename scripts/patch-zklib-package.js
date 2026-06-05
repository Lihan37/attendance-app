const fs = require('fs')
const path = require('path')

const packagePath = path.join(__dirname, '../node_modules/zklib-js/package.json')
const lockPaths = [
  path.join(__dirname, '../package-lock.json'),
  path.join(__dirname, '../node_modules/.package-lock.json'),
]

if (!fs.existsSync(packagePath)) {
  process.exit(0)
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

if (packageJson.dependencies?.['zklib-js']) {
  delete packageJson.dependencies['zklib-js']
}

if (packageJson.dependencies && Object.keys(packageJson.dependencies).length === 0) {
  delete packageJson.dependencies
}

fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

lockPaths.forEach((lockPath) => {
  if (!fs.existsSync(lockPath)) return

  const packageLock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
  const zklibPackage = packageLock.packages?.['node_modules/zklib-js']

  if (zklibPackage?.dependencies?.['zklib-js']) {
    delete zklibPackage.dependencies['zklib-js']
  }

  if (zklibPackage?.dependencies && Object.keys(zklibPackage.dependencies).length === 0) {
    delete zklibPackage.dependencies
  }

  fs.writeFileSync(lockPath, `${JSON.stringify(packageLock, null, 2)}\n`)
})
