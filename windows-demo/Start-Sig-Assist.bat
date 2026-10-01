@echo off
setlocal
cd /d "%~dp0"
title Sig-Assist Demo
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Serve-Demo.ps1"
if errorlevel 1 (
    echo.
    echo Sig-Assist could not start. See the message above.
    pause
)
