@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   Sig-Assist Clinical Normalization Workbench
echo   Windows Production Preview Launcher
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not found in your system PATH.
    echo Please install Node.js (v18 or v20+ LTS) from:
    echo   https://nodejs.org/
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0"

if not exist "node_modules\" (
    echo [INFO] Installing npm dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install encountered an error.
        pause
        exit /b %errorlevel%
    )
)

if not exist "dist\index.html" (
    echo [INFO] Building production bundle...
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Build failed.
        pause
        exit /b %errorlevel%
    )
)

echo [INFO] Starting Sig-Assist production preview on http://localhost:4173 ...
start "" "http://localhost:4173"
call npm run preview
