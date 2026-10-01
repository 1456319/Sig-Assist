@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing_node
node -e "if (Number(process.versions.node.split('.')[0]) < 22) process.exit(1)"
if errorlevel 1 goto missing_node
call npm ci --no-audit --no-fund
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
call npm run preview -- --host localhost --port 4173 --strictPort --open
if errorlevel 1 goto failed
exit /b 0
:missing_node
echo Node.js 22 or newer is required for development.
echo For the prebuilt demo, run windows-demo\Start-Sig-Assist.bat instead.
pause
exit /b 1
:failed
echo Sig-Assist setup, build or startup failed. See the message above.
pause
exit /b 1
