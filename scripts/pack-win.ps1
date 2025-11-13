# One-click pack script for Windows (PowerShell)
# Usage: Open an elevated PowerShell (if needed) and run: .\scripts\pack-win.ps1
# This script will:
# 1) build the renderer (vite build)
# 2) generate app icons
# 3) run electron-builder to create Windows installer (NSIS)

param(
    [switch]$SkipIcon
)

Write-Host "Starting packaging for Windows..."

# Step 1: build renderer
Write-Host "1) Building renderer (vite)..."
npm run client:build
if ($LASTEXITCODE -ne 0) {
    Write-Error "client:build failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

# Step 2: generate icon (unless skipped)
if (-not $SkipIcon) {
    Write-Host "2) Generating icon..."
    npm run generate-icon
    if ($LASTEXITCODE -ne 0) {
        Write-Error "generate-icon failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
} else {
    Write-Host "Skipping icon generation as requested."
}

# Step 3: run electron-builder
Write-Host "3) Running electron-builder (NSIS)..."
# ensure node_modules/.bin is on PATH in case electron-builder is installed locally
$env:PATH = "${env:PATH};$(Resolve-Path node_modules/.bin)"

npx electron-builder --win nsis
if ($LASTEXITCODE -ne 0) {
    Write-Error "electron-builder failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "Packaging complete. Output is in the 'dist' folder."
