const http = require('http')
const fs = require('fs')
const path = require('path')

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node upload-file.js <absolute-file-path>')
  process.exit(1)
}

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath)
  process.exit(2)
}

const fileName = path.basename(filePath)
const stat = fs.statSync(filePath)
const boundary = '--------------------------' + Date.now().toString(16)

const prefix = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`)
const suffix = Buffer.from(`\r\n--${boundary}--\r\n`)

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/upload',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    // Not setting Content-Length explicitly; using chunked transfer
  }
}

const req = http.request(options, (res) => {
  let data = ''
  res.on('data', (chunk) => data += chunk)
  res.on('end', () => {
    console.log('STATUS', res.statusCode)
    console.log('HEADERS', res.headers)
    console.log('BODY', data)
  })
})

req.on('error', (err) => {
  console.error('Request error:', err)
})

// write prefix, pipe file, then write suffix
req.write(prefix)
const stream = fs.createReadStream(filePath)
stream.on('end', () => {
  req.write(suffix)
  req.end()
})
stream.pipe(req, { end: false })
