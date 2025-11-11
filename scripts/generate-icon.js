#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
// jimp 在较新版本也使用了 ESM 导出，动态 import 可保证兼容性
// png-to-ico is published as an ES module; use dynamic import inside async code
// to remain compatible with CommonJS scripts.

// 支持的图标尺寸（从最小 16 到最大 256）
const SIZES = [16, 32, 48, 64, 128, 256]

async function main() {
  const src = process.argv[2] || path.join(__dirname, '..', 'build', 'icon.png')
  const out = process.argv[3] || path.join(__dirname, '..', 'build', 'icon.ico')

  // 如果源文件不存在，则自动生成一个占位图（512x512）方便测试/开发
  if (!fs.existsSync(src)) {
    console.warn(`源文件未找到: ${src}，将生成占位图`)
    try {
      const pureimage = require('pureimage')
      const WIDTH = 512
      const HEIGHT = 512
      const img = pureimage.make(WIDTH, HEIGHT)
      const ctx = img.getContext('2d')
      // 背景
      ctx.fillStyle = '#2b2b2b'
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
      // 中央大字
      ctx.fillStyle = '#ffffff'
      const font = pureimage.registerFont(require('path').join(__dirname, '..', 'node_modules', 'pureimage', 'fonts', 'SourceSansPro-Regular.ttf'), 'SourceSans')
      try { font.loadSync() } catch (e) { /* ignore if font not available */ }
      ctx.font = '72pt SourceSans'
      const text = 'ICON'
      const w = ctx.measureText(text).width
      ctx.fillText(text, (WIDTH - w) / 2, HEIGHT / 2 + 24)
      // 确保目录存在
      fs.mkdirSync(path.dirname(src), { recursive: true })
      await pureimage.encodePNGToStream(img, fs.createWriteStream(src))
      console.log(`已生成占位源图片: ${src}`)
    } catch (err) {
      console.error('无法生成占位图：', err)
      process.exit(2)
    }
  }

  // 如果输出已经存在并且比源更新，则跳过生成（增量），以减少不必要的构建时间
  try {
    if (fs.existsSync(out) && fs.existsSync(src)) {
      const outStat = fs.statSync(out)
      const srcStat = fs.statSync(src)
      if (outStat.mtimeMs >= srcStat.mtimeMs) {
        console.log(`输出已是最新，跳过 icon 生成: ${out}`)
        return
      }
    }
  } catch (e) {
    // ignore stat errors and continue
  }

  console.log(`读取源图片: ${src}`)
  // 使用 pureimage 读取并缩放图片，兼容性更好
  const pureimage = require('pureimage')
  const { PassThrough } = require('stream')

  async function pngFromCanvas(imgCanvas) {
    return new Promise((resolve, reject) => {
      const stream = new PassThrough()
      const chunks = []
      stream.on('data', (c) => chunks.push(c))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
      pureimage.encodePNGToStream(imgCanvas, stream).catch(reject)
    })
  }

  const srcStream = fs.createReadStream(src)
  const srcImg = await pureimage.decodePNGFromStream(srcStream)
  const w = srcImg.width
  const h = srcImg.height

  // 为每个尺寸生成 PNG Buffer（允许放大或缩小）
  const buffers = []
  for (const size of SIZES) {
    const canvas = pureimage.make(size, size)
    const ctx = canvas.getContext('2d')
    // 透明背景
    ctx.clearRect(0, 0, size, size)
    const scale = Math.max(size / w, size / h)
    const newW = Math.max(1, Math.round(w * scale))
    const newH = Math.max(1, Math.round(h * scale))
    const dx = Math.round((size - newW) / 2)
    const dy = Math.round((size - newH) / 2)
    // drawImage 支持缩放绘制
    ctx.drawImage(srcImg, 0, 0, w, h, dx, dy, newW, newH)
    const buf = await pngFromCanvas(canvas)
    buffers.push(buf)
    console.log(`已生成 PNG ${size}x${size}`)
  }

  console.log('正在把 PNG 转为 ICO（包含多个分辨率）...')
  const pngToIco = (await import('png-to-ico')).default
  const icoBuf = await pngToIco(buffers)
  fs.writeFileSync(out, icoBuf)
  console.log(`生成成功: ${out}`)
}

main().catch(err => {
  console.error('生成图标失败:', err)
  process.exit(1)
})
