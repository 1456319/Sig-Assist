@echo off
setlocal DisableDelayedExpansion
title Sig-Assist Read-Only Iguana Connector
pushd "%~dp0" || goto folder_error
set "SIG_NODE="
set "SIG_DOWNLOAD="
set "SIG_SETUP_LOG="
set "SIG_VERSION=22.23.3"
set "SIG_ARCH=%PROCESSOR_ARCHITECTURE%"
if not "%PROCESSOR_ARCHITEW6432%"=="" set "SIG_ARCH=%PROCESSOR_ARCHITEW6432%"
if /i "%SIG_ARCH%"=="AMD64" set "SIG_ARCH=x64"
if /i "%SIG_ARCH%"=="ARM64" set "SIG_ARCH=arm64"
if /i "%SIG_ARCH%"=="x86" set "SIG_ARCH=x86"
set "SIG_SHA="
rem Official https://nodejs.org/dist/v22.23.3/SHASUMS256.txt
if "%SIG_ARCH%"=="x64" set "SIG_SHA=9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e"
if "%SIG_ARCH%"=="arm64" set "SIG_SHA=b5a3165ec6f24c0b1fe2a10fed58e03f6c1d7d141beb3b225ff030ceac6c5eb5"
if "%SIG_ARCH%"=="x86" set "SIG_SHA=a8aa72dda43af5357d0a502548a54e402d4f7643be221662624a2cc876cd37bb"
rem Check an optional offline copy beside the launcher, then all PATH entries.
call :try_node "%~dp0node.exe"
for /f "delims=" %%N in ('where node.exe 2^>nul') do call :try_node "%%N"
if defined SIG_NODE goto node_ready
if "%LOCALAPPDATA%"=="" goto no_profile
if not defined SIG_SHA goto unsupported_arch
set "SIG_RUNTIME=%LOCALAPPDATA%\Sig-Assist\runtime\node-v%SIG_VERSION%-win-%SIG_ARCH%"
set "SIG_CACHED_NODE=%SIG_RUNTIME%\node.exe"
call :try_node "%SIG_CACHED_NODE%"
if defined SIG_NODE goto node_ready

echo No compatible Node.js found. Setting up Node.js %SIG_VERSION% for your user.
echo No administrator access, PowerShell or system PATH changes are required.
echo Destination: "%SIG_CACHED_NODE%"
if not exist "%SIG_RUNTIME%" mkdir "%SIG_RUNTIME%"
if not exist "%SIG_RUNTIME%" goto profile_error
set "SIG_SETUP_LOG=%SIG_RUNTIME%\node-setup.log"
>"%SIG_SETUP_LOG%" echo Sig-Assist Node setup %DATE% %TIME%
if errorlevel 1 goto profile_error
>>"%SIG_SETUP_LOG%" echo Version=%SIG_VERSION% Architecture=%SIG_ARCH%
set "SIG_CURL=%SystemRoot%\System32\curl.exe"
set "SIG_CERTUTIL=%SystemRoot%\System32\certutil.exe"
if not exist "%SIG_CURL%" goto missing_curl
if not exist "%SIG_CERTUTIL%" goto missing_certutil
set "SIG_DOWNLOAD=%SIG_RUNTIME%\node-%RANDOM%-%RANDOM%.download"
set "SIG_URL=https://nodejs.org/dist/v%SIG_VERSION%/win-%SIG_ARCH%/node.exe"
echo Downloading from %SIG_URL% - the first run may take a few minutes.
>>"%SIG_SETUP_LOG%" echo Download=%SIG_URL%
"%SIG_CURL%" --fail --location --proto "=https" --proto-redir "=https" --connect-timeout 15 --max-time 300 --retry 2 --retry-max-time 300 --show-error --silent --output "%SIG_DOWNLOAD%" "%SIG_URL%" >>"%SIG_SETUP_LOG%" 2>&1
if errorlevel 1 goto download_error
echo Verifying the official SHA-256 checksum...
"%SIG_CERTUTIL%" -hashfile "%SIG_DOWNLOAD%" SHA256 >"%SIG_DOWNLOAD%.hash" 2>&1
if errorlevel 1 goto hash_error
type "%SIG_DOWNLOAD%.hash" >>"%SIG_SETUP_LOG%"
"%SystemRoot%\System32\findstr.exe" /i /x /c:"%SIG_SHA%" "%SIG_DOWNLOAD%.hash" >nul
if errorlevel 1 goto hash_error
rem Only publish a complete, verified download to the reusable cache.
move /y "%SIG_DOWNLOAD%" "%SIG_CACHED_NODE%" >>"%SIG_SETUP_LOG%" 2>&1
if errorlevel 1 goto install_error
del "%SIG_DOWNLOAD%.hash" >nul 2>nul
call :try_node "%SIG_CACHED_NODE%"
if not defined SIG_NODE goto runtime_error
>>"%SIG_SETUP_LOG%" echo Setup completed %DATE% %TIME%

:node_ready
echo Using Node.js: "%SIG_NODE%"
"%SIG_NODE%" --version
if /i "%~1"=="--check" goto check_ok
set "SIG_BRIDGE=%~dp0iguana-bridge.mjs"
if not exist "%SIG_BRIDGE%" set "SIG_BRIDGE=%~dp0..\scripts\iguana-bridge.mjs"
if not exist "%SIG_BRIDGE%" goto missing_bridge
"%SIG_NODE%" "%SIG_BRIDGE%" %*
set "SIG_EXIT=%ERRORLEVEL%"
popd
echo.
echo Connector stopped. See any error above.
pause
exit /b %SIG_EXIT%

:try_node
if defined SIG_NODE exit /b 0
if not exist "%~1" exit /b 1
"%~1" -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=12)?0:1)" >nul 2>nul
if errorlevel 1 exit /b 1
set "SIG_NODE=%~1"
exit /b 0

:check_ok
popd
exit /b 0
:download_error
echo [ERROR] Node.js download failed. Check the internet connection or proxy.
goto setup_failed
:hash_error
echo [ERROR] Node.js checksum could not be verified. The download was not installed.
if exist "%SIG_DOWNLOAD%.hash" type "%SIG_DOWNLOAD%.hash" >>"%SIG_SETUP_LOG%"
goto setup_failed
:install_error
echo [ERROR] Cannot save Node.js in the user runtime folder.
goto setup_failed
:runtime_error
echo [ERROR] Downloaded Node.js cannot run. Check Windows support or application policy.
goto setup_failed
:missing_curl
echo [ERROR] Windows curl.exe is unavailable. Automatic download cannot run.
goto setup_failed
:missing_certutil
echo [ERROR] Windows certutil.exe is unavailable. The download cannot be verified.
goto setup_failed
:setup_failed
if defined SIG_DOWNLOAD del "%SIG_DOWNLOAD%" "%SIG_DOWNLOAD%.hash" >nul 2>nul
echo Setup log: "%SIG_SETUP_LOG%"
type "%SIG_SETUP_LOG%"
echo You can place a compatible official node.exe beside this launcher and retry.
goto failed
:no_profile
echo [ERROR] LOCALAPPDATA is unavailable. Cannot find your user runtime folder.
goto failed
:profile_error
echo [ERROR] Cannot write the user runtime folder: "%SIG_RUNTIME%"
goto failed
:unsupported_arch
echo [ERROR] Unsupported Windows architecture: %SIG_ARCH%
goto failed
:missing_bridge
echo [ERROR] Connector script missing. Extract the entire ZIP and try again.
:failed
echo You can still open index.html and import a HAR without Node.js.
popd
if /i not "%~1"=="--check" pause
exit /b 1
:folder_error
echo [ERROR] Cannot open the extracted connector folder. Extract the entire ZIP and try again.
if /i not "%~1"=="--check" pause
exit /b 1
