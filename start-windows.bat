@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "sig_assist_dir=%~dp0"
pushd "%sig_assist_dir%" >nul
if errorlevel 1 goto missing_directory
echo Sig-Assist Windows Development Launcher

where node >nul 2>nul
if errorlevel 1 goto prebuilt
node -e "const [major,minor]=process.versions.node.split('.').map(Number); process.exit(major>22 || major===22 && minor>=12 ? 0 : 1)"
if errorlevel 1 goto prebuilt
where npm >nul 2>nul
if errorlevel 1 goto prebuilt

if not exist "node_modules\.package-lock.json" (
    echo [INFO] Installing locked dependencies...
    call npm ci
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed.
        pause
        popd
        exit /b 1
    )
)

echo [INFO] Opening http://127.0.0.1:5173/ when the server is ready...
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open
if errorlevel 1 (
    echo [ERROR] Server could not start. Close any previous demo console.
    pause
    popd
    exit /b 1
)
popd
exit /b 0

:prebuilt
if not exist "windows-demo\Start-Sig-Assist.bat" goto missing_node
echo [INFO] Using the bundled prebuilt demo. Node.js is not required.
call "%sig_assist_dir%windows-demo\Start-Sig-Assist.bat" %*
set "sig_assist_exit=%errorlevel%"
popd
exit /b %sig_assist_exit%

:missing_node
echo [ERROR] This source launcher needs Node.js 22.12+ with npm.
echo The bundled prebuilt demo is missing. Download the Windows demo ZIP:
echo https://github.com/1456319/Sig-Assist/raw/refs/heads/main/windows-demo/Sig-Assist-Windows-Demo.zip
echo Extract all files and run Start-Sig-Assist.bat.
pause
popd
exit /b 1

:missing_directory
echo [ERROR] Windows could not access the Sig-Assist folder.
echo Extract the complete demo ZIP to a writable folder and try again.
pause
exit /b 1
