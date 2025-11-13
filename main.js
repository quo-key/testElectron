const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises
const fsSync = require('fs')
const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,               // 启动窗口宽度
    height: 800,               // 启动窗口高度
    minWidth: 800,
    minHeight: 600,
    center: true,
    resizable: true,
    show: false,               // 等待 ready-to-show 后再显示，避免闪烁
    title: app.getName(),
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.ico'), // 请将你的 .ico 放到 build/icon.ico
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // 在生产（被打包）时允许关闭 webSecurity 以便通过 file:// 协议加载 ESM 资源（例如 Vite 的 type="module" 脚本）
      // 注意：这会放宽同源策略，仅在你信任本地资源时使用
      webSecurity: isDev,
      // 加载 preload 脚本以暴露有限的 IPC 接口给渲染进程
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 在开发模式下，加载 Vite 的开发服务器；生产模式下加载构建后的 dist/index.html
  // Allow several ways to enable DevTools in production:
  //  - environment variable ELECTRON_ENABLE_DEVTOOLS=1
  //  - command line argument --devtools
  const enableDevtools = isDev || process.env.ELECTRON_ENABLE_DEVTOOLS === '1' || process.env.ELECTRON_ENABLE_DEVTOOLS === 'true' || process.argv.includes('--devtools')

  if (isDev) {
    const devUrl = 'http://localhost:5173'
    win.loadURL(devUrl).catch((e) => {
      console.error('Failed to load dev server:', e)
    })
  } else {
    // 打包后，renderer 构建输出放在 dist/ 下
    win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }

  // 根据环境决定是否打开开发者工具（允许在已打包的程序中通过环境变量开启）
  if (enableDevtools) {
    // 打开开发者工具以便调试已打包应用
    try { win.webContents.openDevTools(); } catch (e) { /* ignore */ }
  }

  // 在准备好时显示窗口
  win.once('ready-to-show', () => {
    win.show();
  });

  // 隐藏默认菜单（更原生的窗口）
  try { win.removeMenu(); } catch (e) { /* ignore */ }
}

app.whenReady().then(() => {
  // 在 macOS 上，app.name 通常由 package.json 的 productName 提供
  createWindow();
});

// Ensure uploads directory exists and return its path
function getUploadsDir() {
  const uploads = path.join(app.getPath('userData'), 'uploads')
  if (!fsSync.existsSync(uploads)) fsSync.mkdirSync(uploads, { recursive: true })
  return uploads
}

// Save image via IPC
ipcMain.handle('save-image', async (event, { name, base64 }) => {
  try {
    const uploads = getUploadsDir()
    const safeName = path.basename(name || `img_${Date.now()}.jpg`)
    const filePath = path.join(uploads, safeName)
    // base64 may be data:[mime];base64,xxxx or raw base64
    const match = typeof base64 === 'string' && base64.match(/^data:(.+);base64,(.+)$/)
    const b64data = match ? match[2] : base64
    const buffer = Buffer.from(b64data, 'base64')
    await fs.writeFile(filePath, buffer)
    return { ok: true, url: `file://${filePath}`, filename: safeName }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

ipcMain.handle('delete-image', async (event, { filename }) => {
  try {
    const uploads = getUploadsDir()
    const safe = path.basename(filename)
    const target = path.join(uploads, safe)
    // ensure inside uploads
    if (!target.startsWith(uploads)) return { ok: false, error: 'invalid filename' }
    if (!fsSync.existsSync(target)) return { ok: false, error: 'not found' }
    await fs.unlink(target)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

// Show an absolute path (file:// or plain path) in OS file manager
ipcMain.handle('show-item', async (event, filePath) => {
  try {
    if (!filePath) return { ok: false, error: 'empty' }
    let p = String(filePath)
    if (p.startsWith('file://')) p = p.replace(/^file:\/\//, '')
    await shell.showItemInFolder(p)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

// Show a project-relative path (e.g. /assets/uploads/...) in file manager
ipcMain.handle('show-relative', async (event, relPath) => {
  try {
    if (!relPath) return { ok: false, error: 'empty' }
    // strip leading slashes
    const safe = String(relPath).replace(/^\/+/, '')
    const abs = path.join(process.cwd(), safe)
    if (!fsSync.existsSync(abs)) return { ok: false, error: 'not found', path: abs }
    await shell.showItemInFolder(abs)
    return { ok: true, path: abs }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
