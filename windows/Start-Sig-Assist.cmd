@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Sig-Assist Demo
rem Keep the original CMD entry point compatible with the browser-only demo.
set "sig_assist_launcher=%~dp0Start-Sig-Assist.bat"
if exist "%sig_assist_launcher%" goto launch
set "sig_assist_launcher=%~dp0..\windows-demo\Start-Sig-Assist.bat"
if exist "%sig_assist_launcher%" goto launch

echo [ERROR] The prebuilt browser launcher is missing.
echo Extract all files from Sig-Assist-Windows-Demo.zip into this folder.
echo For live intake, run Start-Iguana-Connector.bat from the extracted ZIP.
if /I not "%~1"=="--check" pause
exit /b 1

:launch
call "%sig_assist_launcher%" %*
exit /b %errorlevel%
