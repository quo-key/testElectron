const fs = require('fs')
const path = require('path')

const distIndex = path.join(__dirname, '..', 'dist', 'index.html')

if (!fs.existsSync(distIndex)) {
  console.error('dist/index.html not found. Please run `npm run client:build` first.')
  process.exit(1)
}

let html = fs.readFileSync(distIndex, 'utf8')

// Remove crossorigin attributes (with or without value) from script and link tags which cause file:// origin CORS issues
html = html.replace(/\s+crossorigin(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gi, '')

fs.writeFileSync(distIndex, html, 'utf8')
console.log('Removed crossorigin attributes from dist/index.html')
