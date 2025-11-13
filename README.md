# TestDemo Electron 打包说明

此仓库包含若干静态页面（例如 `index.html`、`test.html`）和样式文件，本说明演示如何将其打包成 Windows 桌面应用（使用 Electron + electron-builder）。

快速上手（在开发机上执行）：

1. 进入项目目录

```powershell
cd D:\testDemo
```

2. 安装开发依赖

```powershell
npm install --save-dev electron electron-builder
```

3. 启动应用进行本地调试

```powershell
npm run start
.\dist\win-unpacked\计算器.exe --devtools
```


4. 打包为 Windows 安装器或 ZIP

```powershell
npm run dist
```

默认配置会尝试生成 NSIS 安装程序（以及 zip 便携包）。生成的安装程序文件名遵循 package.json 中的 `build.artifactName` 设置，当前默认会生成：

```
TestDemo-Setup-1.0.0.exe  （示例，实际版本取自 package.json 的 version 字段）
```

产物会放在 `dist/` 目录下（例如 `dist\win-unpacked` 与生成的 installer/zip）。复制或传输生成的安装器/zip 到其它 Windows 电脑，解压或运行安装器即可。

图标与自定义文件名：
- 请把你的 Windows 图标文件（`.ico`）放到 `build/icon.ico`，electron-builder 和 Electron 将自动使用它作为应用程序图标。
- 如果你想修改最终生成文件名模式，请编辑 `package.json` 中的 `build.artifactName` 字段（当前为 `${productName}-Setup-${version}.${ext}`）。

注意：生成 NSIS 安装器需要在构建机上可执行的 makensis（NSIS），并且 electron-builder 在某些步骤会访问 GitHub 下载一些二进制工具；若你的网络环境受限，可能会导致构建失败。若出现类似错误，可改为仅生成 zip（在 package.json 中把 win.target 调整为 ["zip"]），或者允许网络访问并安装 NSIS。 

注意：如果想生成安装程序（NSIS），请在目标机器上安装 makensis 并修改 `package.json` 中的 `build.win.target` 配置。

如需我代为运行安装并生成产物，请允许我在终端执行 npm install 与构建命令（这可能会下载 electron 二进制并耗时）。
