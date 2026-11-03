@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "sig_assist_dir=%~dp0"
pushd "%sig_assist_dir%" >nul
if errorlevel 1 goto missing_directory
if not exist "%sig_assist_dir%windows-demo\Start-Iguana-Connector.bat" goto missing_connector
call "%sig_assist_dir%windows-demo\Start-Iguana-Connector.bat" %*
set "sig_assist_exit=%errorlevel%"
popd
exit /b %sig_assist_exit%

:missing_connector
echo [ERROR] The Iguana connector launcher is missing from windows-demo.
echo Extract all files from the Windows demo ZIP and try again.
popd
pause
exit /b 1

:missing_directory
echo [ERROR] Cannot open the Sig-Assist directory.
pause
exit /b 1
