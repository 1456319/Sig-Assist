@ECHO OFF
REM ***********************************************************************
REM This file will register all required components for use in DocuTrack
REM ***********************************************************************
CLS

ECHO *** Registering all DocuTrack 5.x components

if /i %PROCESSOR_ARCHITECTURE%==X86 GOTO LBL_X86
rem do x64 stuff
SET TOOL_REGSSVR32=%SYSTEMROOT%\SYSWOW64\regsvr32.exe

GOTO LBL_START
:LBL_X86
rem do x86 stuff
SET TOOL_REGSSVR32=%SYSTEMROOT%\SYSTEM32\regsvr32.exe

GOTO LBL_START

rem we now have our stuff initialized, do the work.
:LBL_START
rem initialize common things.
SET TOOL_REGASM=%windir%\Microsoft.Net\Framework\v4.0.30319\regasm.exe

rem Check for tool availability, report and fail if they are not found.
ECHO.
if NOT EXIST "%TOOL_REGSSVR32%" (
  call:ToolMissing "%TOOL_REGSSVR32%"
  GOTO EOF
  )
if NOT EXIST "%TOOL_REGASM%" (
  call:ToolMissing "%TOOL_REGASM%"
  GOTO EOF
  )

rem REGISTERING components
ECHO ***  Registering all standard COM Objects:
call:RegCOM aximages4.dll
call:RegCOM DCIDocument.dll
call:RegCOM DTClientInterface.dll
ECHO.

ECHO *** Registering all .Net COM Objects:
call:RegNET IS.WM.Architecture.Logging.dll
call:RegNET IS.OMS.DirectConnect.DirectConnectCOMClient.dll
call:RegNET IS.OMS.DirectConnect.DirectConnectClientAgent.dll
call:RegNET IS.OMS.DirectConnect.DocumentEngineWebserviceAgent.dll
ECHO.

ECHO *** Registering all COM Servers:
call:RegCOMSERVER dciserver.exe
ECHO.

ECHO *** Finished. Review for any errors and report or fix as necessary.
PAUSE

GOTO LBL_END


:RegCOMSERVER
REM Register a standard COM dll, report error if failed.
ECHO Registering: %~1
%1 /REGSERVER
if %ERRORLEVEL% NEQ 0 (
  ECHO.
  ECHO.      *** WARNING *** Registration has failed for: %~1
  ECHO.
) ELSE (
  REM nothing to do if it succeeds yet.
)
GOTO EOF


:RegCOM
REM Register a standard COM dll, report error if failed.
ECHO Registering: %~1
%TOOL_REGSSVR32% /s %1
if %ERRORLEVEL% NEQ 0 (
  ECHO.
  ECHO.      *** WARNING *** Registration has failed for: %~1
  ECHO.
) ELSE (
  REM nothing to do if it succeeds yet.
)
GOTO EOF

:RegNET
REM Register a .Net COM dll, report error if failed.
ECHO Registering: %~1
%TOOL_REGASM% /silent %1
if %ERRORLEVEL% NEQ 0 (
  ECHO.
  ECHO.      *** WARNING *** Registration has failed for: %~1
  ECHO.
) ELSE (
  REM nothing to do if it succeeds yet.
)
GOTO EOF

:ToolMissing
REM Report a missing tool
ECHO.
ECHO *** Error: one or more tools required for the script were not found.
ECHO Tool: %~1
ECHO.

:LBL_END
set TOOL_REGSSVR32=
set TOOL_REGASM=

:EOF
