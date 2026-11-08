@echo oFF
echo This script should be used to register COM Libraries
CD  %~dp0

set REGSVR64=%WINDIR%\system32\regsvr32.exe
set REGSVR32=%WINDIR%\syswow64\regsvr32.exe
if NOT EXIST "%REGSVR64%" goto _x86

"%REGSVR64%" UiPath_x64.dll /s %1>NUL
"%REGSVR64%" TCaptureX_x64.dll /s %1>NUL
"%REGSVR64%" SSSystemObj_x64.dll /s %1>NUL
"%REGSVR64%" UIElement_x64.dll /s %1>NUL
"%REGSVR64%" TSelection_x64.dll /s %1>NUL

: _x86
"%REGSVR32%" UiPath.dll /s %1>NUL
"%REGSVR32%" TCaptureX.dll /s %1>NUL
"%REGSVR32%" SSSystemObj.dll /s %1>NUL 
"%REGSVR32%" UIElement.dll /s %1>NUL
"%REGSVR32%" TSelection.dll /s %1>NUL
