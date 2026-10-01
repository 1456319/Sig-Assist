@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "sig_assist_dir=%~dp0"
pushd "%sig_assist_dir%" >nul
if errorlevel 1 goto missing_directory
title Sig-Assist Demo
echo Starting Sig-Assist. Keep this window open during the demo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%sig_assist_dir%Serve-Demo.ps1" %*
set "sig_assist_exit=%errorlevel%"
popd
if not "%sig_assist_exit%"=="0" (
    echo.
    echo Sig-Assist could not start. See the message above.
    pause
)
exit /b %sig_assist_exit%

:missing_directory
echo [ERROR] Windows could not access the Sig-Assist folder.
echo Extract the complete demo ZIP to a writable folder and try again.
pause
exit /b 1
