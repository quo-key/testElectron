const { app, BrowserWindow } = require('electron');
const path = require('path');

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
      contextIsolation: true
    }
  });

  // 加载项目根目录下的 test.html
  win.loadFile(path.join(__dirname, 'test.html'));

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
