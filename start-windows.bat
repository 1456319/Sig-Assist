@echo off
setlocal
cd /d "%~dp0"
echo Sig-Assist Windows Development Launcher

where node >nul 2>nul
if errorlevel 1 goto missing_node
node -e "const [major,minor]=process.versions.node.split('.').map(Number); process.exit(major>22 || major===22 && minor>=12 ? 0 : 1)"
if errorlevel 1 goto missing_node
where npm >nul 2>nul
if errorlevel 1 goto missing_node

if not exist "node_modules\.package-lock.json" (
    echo [INFO] Installing locked dependencies...
    call npm ci
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
)

echo [INFO] Opening http://127.0.0.1:5173/ when the server is ready...
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open
if errorlevel 1 (
    echo [ERROR] Server could not start. Close any previous demo console.
    pause
    exit /b 1
)
exit /b 0

:missing_node
echo [ERROR] Install Node.js 22.12+ with npm, then reopen this launcher.
echo For the prebuilt demo without Node.js, see docs\WINDOWS-DEMO.md.
pause
exit /b 1
