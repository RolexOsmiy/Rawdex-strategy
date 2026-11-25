@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-windows.ps1"
set "BUILD_EXIT=%ERRORLEVEL%"
if /i not "%~1"=="--no-pause" pause
exit /b %BUILD_EXIT%
