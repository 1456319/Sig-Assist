@echo off
setlocal
title Sig-Assist Read-Only Iguana Connector
pushd "%~dp0" || goto folder_error
where node.exe >nul 2>nul
if errorlevel 1 goto no_node
node.exe -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=12)?0:1)"
if errorlevel 1 goto no_node
if exist "iguana-bridge.mjs" (
  node.exe iguana-bridge.mjs
) else (
  node.exe "..\scripts\iguana-bridge.mjs"
)
popd
echo.
echo Connector stopped. See any error above.
pause
exit /b
:no_node
echo Live intake requires Node.js 22.12 or newer on the computer running this bridge.
echo PowerShell is not used. You can still open index.html and import a HAR without Node.js.
popd
pause
exit /b 1
:folder_error
echo Cannot open the extracted connector folder. Extract the entire ZIP and try again.
pause
exit /b 1
