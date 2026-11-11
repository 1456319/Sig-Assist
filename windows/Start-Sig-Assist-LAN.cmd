@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem Keep check/support invocations synchronous so callers get their exit code.
if not "%~1"=="" goto support
rem The live launcher handles UNC itself; do not pass it a temporary mapped drive.
set "SIG_ASSIST_BACKGROUND=1"
start "Sig-Assist order connector" /min "%ComSpec%" /d /c call "%~dp0Start-Iguana-Connector.bat"
exit /b %errorlevel%
:support
call "%~dp0Start-Iguana-Connector.bat" %*
exit /b %errorlevel%
