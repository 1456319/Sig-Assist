@echo off
setlocal DisableDelayedExpansion
title Sig-Assist PILOT ONLY - workstation probe
pushd "%~dp0" || exit /b 1
set "PROBE_APP=docutrack"
echo PILOT ONLY v0.1.4 - read-only local workstation probe
echo Leave DocuTrack or Framework open in the same Windows session.
echo 1. DocuTrack     2. Framework     3. DocuTrack folder check     4. Exit
choice /c 1234 /n /m "Choose a capture: "
if errorlevel 4 goto end
if errorlevel 3 (set "PROBE_APP=folder") else if errorlevel 2 (set "PROBE_APP=framework")
set "PROBE_CACHE=%LOCALAPPDATA%\Sig-Assist\pilot-probe"
if not exist "%PROBE_CACHE%\." mkdir "%PROBE_CACHE%" || goto failed
:unique
set "PROBE_WORK=%PROBE_CACHE%\run-%RANDOM%-%RANDOM%"
if exist "%PROBE_WORK%\." goto unique
mkdir "%PROBE_WORK%" || goto failed
set "PROBE_FX=%SystemRoot%\Microsoft.NET\Framework\v4.0.30319"
"%PROBE_FX%\csc.exe" /nologo /target:exe /platform:anycpu "/out:%PROBE_WORK%\Probe.exe" "/reference:%PROBE_FX%\WPF\UIAutomationClient.dll" "/reference:%PROBE_FX%\WPF\UIAutomationTypes.dll" "/reference:%PROBE_FX%\WPF\WindowsBase.dll" /reference:Accessibility.dll /reference:System.Web.Extensions.dll "WorkstationProbe.cs" "FolderSelectionProbe.cs" >nul
if errorlevel 1 (
  echo Windows .NET Framework 4.5 or later with UI Automation is needed. No capture was taken.
  goto cleanup
)
echo Reading the selected application's controls. No clicks or keystrokes are sent.
set "PROBE_FILE=%PROBE_WORK%\workstation-map.json"
"%PROBE_WORK%\Probe.exe" %PROBE_APP% > "%PROBE_FILE%"
if errorlevel 1 (
  echo Windows could not complete the capture.
  del /q "%PROBE_FILE%" >nul 2>nul
  goto cleanup
)
echo Your local report is "%PROBE_FILE%"
echo Review it in Notepad. Use Save As to keep a named copy or share it yourself.
start "" notepad.exe "%PROBE_FILE%"
:cleanup
del /q "%PROBE_WORK%\Probe.exe" >nul 2>nul
goto end
:failed
echo The local capture folder could not be prepared.
:end
popd
pause
