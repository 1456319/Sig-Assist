@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   Sig-Assist Clinical Normalization Workbench
echo   Windows Development Launcher
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
    echo [INFO] First time setup: Installing npm dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install encountered an error.
        pause
        exit /b %errorlevel%
    )
)

echo [INFO] Starting Sig-Assist on http://localhost:5173 ...
start "" "http://localhost:5173"
call npm run dev
