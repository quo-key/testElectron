const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const ASSETS_DIR = path.join(__dirname, '..', 'assets')
const UPLOADS_DIR = path.join(ASSETS_DIR, 'uploads')

if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR)
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR)

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = `img_${Date.now()}_${Math.floor(Math.random()*1e6)}${ext}`
    cb(null, name)
  }
})
const upload = multer({ storage })

const app = express()
// Parse JSON bodies for delete requests
app.use(express.json())
// Simple CORS middleware to allow the front-end (vite dev server) to POST files
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})
app.use('/assets', express.static(ASSETS_DIR))

// Delete uploaded file. Accepts JSON { url: '/assets/uploads/xxx' } or { filename: 'xxx' }
app.post('/delete', (req, res) => {
  try {
    const { url, filename } = req.body || {}
    let name = filename
    if (!name && typeof url === 'string') {
      name = path.basename(url)
    }
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'missing filename or url' })
    // Prevent directory traversal by using basename and ensuring resolved path is inside UPLOADS_DIR
    const safeName = path.basename(name)
    const filePath = path.join(UPLOADS_DIR, safeName)
    if (!filePath.startsWith(UPLOADS_DIR)) return res.status(400).json({ error: 'invalid filename' })
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'not found' })
    fs.unlink(filePath, (err) => {
      if (err) return res.status(500).json({ error: 'delete failed' })
      return res.json({ ok: true })
    })
  } catch (e) {
    return res.status(500).json({ error: 'server error' })
  }
})

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' })
  const url = `/assets/uploads/${req.file.filename}`
  res.json({ url })
})

const PORT = process.env.UPLOAD_PORT || 3001
app.listen(PORT, () => console.log(`upload server listening on ${PORT}`))
