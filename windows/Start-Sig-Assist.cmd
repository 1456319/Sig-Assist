@echo off
setlocal
cd /d "%~dp0"
echo Starting Sig-Assist. Keep this window open during the demo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
if errorlevel 1 (
  echo.
  echo Sig-Assist could not start. See the error above.
  pause
  exit /b 1
)
