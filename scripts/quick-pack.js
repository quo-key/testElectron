const fs = require('fs')
const path = require('path')
const fse = require('fs-extra')

async function main() {
  const root = path.resolve(__dirname, '..')
  const electronDist = path.join(root, 'node_modules', 'electron', 'dist')
  const outDir = path.join(root, 'dist', 'quick', '计算器-win32-x64')
  const appResources = path.join(outDir, 'resources', 'app')

  console.log('electronDist:', electronDist)
  if (!fs.existsSync(electronDist)) {
    console.error('本地 electron 运行时不存在，请先安装 electron')
    process.exit(1)
  }

  // 清理并创建输出目录
  await fse.remove(outDir)
  await fse.ensureDir(appResources)

  // 复制 electron 运行时文件
  console.log('复制 Electron 运行时...')
  const entries = fs.readdirSync(electronDist)
  for (const name of entries) {
    const src = path.join(electronDist, name)
    const dest = path.join(outDir, name)
    // copy files and directories
    await fse.copy(src, dest)
  }

  // 复制应用文件到 resources/app
  console.log('复制应用文件到 resources/app...')
  // copy built client (dist) if exists
  const clientDist = path.join(root, 'dist')
  if (fs.existsSync(path.join(clientDist, 'index.html')) || fs.existsSync(path.join(clientDist, 'index.html'))) {
    // prefer client build output already in dist (vite build)
    await fse.copy(path.join(root, 'dist'), path.join(appResources))
  }

  // copy main.js, package.json, test.html, icon
  const filesToCopy = ['main.js', 'package.json', 'test.html']
  for (const file of filesToCopy) {
    const src = path.join(root, file)
    if (fs.existsSync(src)) await fse.copy(src, path.join(appResources, file))
  }
  const iconSrc = path.join(root, 'build', 'icon.ico')
  if (fs.existsSync(iconSrc)) await fse.copy(iconSrc, path.join(outDir, 'icon.ico'))

  // ensure package.json in appResources points to main.js
  const appPackagePath = path.join(appResources, 'package.json')
  try {
    let appPkg = { name: 'testdemo-app', version: '1.0.0', main: 'main.js' }
    if (fs.existsSync(appPackagePath)) {
      appPkg = JSON.parse(fs.readFileSync(appPackagePath, 'utf8'))
      appPkg.main = appPkg.main || 'main.js'
    }
    fs.writeFileSync(appPackagePath, JSON.stringify(appPkg, null, 2), 'utf8')
  } catch (e) {
    console.warn('写入 app package.json 失败', e)
  }

  // 重命名 electron.exe 为 应用名
  const exeSrc = path.join(outDir, 'electron.exe')
  const exeDest = path.join(outDir, '计算器.exe')
  if (fs.existsSync(exeSrc)) {
    await fse.move(exeSrc, exeDest, { overwrite: true })
    console.log('已创建可执行文件:', exeDest)
  } else {
    console.warn('未找到 electron.exe，输出目录可能不完整')
  }

  console.log('quick pack 完成, 输出目录:', outDir)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
