@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "sig_assist_dir=%~dp0"
if not exist "%sig_assist_dir%index.html" goto missing_page
echo Opening the prebuilt Sig-Assist page in your browser.
if /I "%~1"=="--check" goto check_page
start "" "%sig_assist_dir%index.html"
if errorlevel 1 (
    echo [ERROR] Windows could not open the browser automatically.
    echo Open index.html from this folder in Edge or Chrome.
    pause
    exit /b 1
)
exit /b 0

:check_page
echo Prebuilt page found: "%sig_assist_dir%index.html"
exit /b 0

:missing_page
echo [ERROR] The prebuilt index.html is missing.
echo Extract all files from the Windows demo ZIP and try again.
pause
exit /b 1
