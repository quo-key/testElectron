打包产物说明

已生成的分发文件（在本项目的 `dist` 目录）：

- `dist\win-unpacked\`：Electron 解包后的可运行目录，包含 `TestDemo.exe`，可直接将该目录复制到 Windows 电脑运行。
- `dist\TestDemo-win32-x64.zip`：已压缩的便携 ZIP，解压后直接双击 `TestDemo.exe` 运行。

如何在另一台 Windows 电脑上打开：

1. 复制 `dist\TestDemo-win32-x64.zip` 到目标电脑
2. 右键 -> 解压到某个文件夹
3. 双击文件夹内的 `TestDemo.exe` 运行（不需要安装 Node.js）

注意事项：
- 初次运行 Windows 可能会弹出“Windows 保护你的电脑”或 SmartScreen 警告；这属于未签名的 exe 常见提示。要消除该提示，需要对安装包进行代码签名（需要证书）。
- 如果需要安装程序（.exe 安装器）而非便携 zip，我可以在你允许安装 makensis 并允许 electron-builder 访问网络的情况下重新打包为 NSIS 安装器。
