const fs = require('fs')
const path = require('path')

const src = process.argv[2]
if (!src) {
  console.error('Usage: node copy-local-to-assets.js <absolute-file-path>')
  process.exit(1)
}
if (!fs.existsSync(src)) {
  console.error('Source file not found:', src)
  process.exit(2)
}

const projectRoot = path.resolve(__dirname, '..')
const assetsDir = path.join(projectRoot, 'assets')
const uploadsDir = path.join(assetsDir, 'uploads')
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir)
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir)

const ext = path.extname(src)
const name = `img_${Math.floor(Date.now()/1000)}_${Math.floor(Math.random()*1e6)}${ext}`
const dest = path.join(uploadsDir, name)
fs.copyFileSync(src, dest)
console.log(JSON.stringify({ ok: true, url: `/assets/uploads/${name}`, path: dest }))
