@echo off
setlocal
title SchoolHub Production Server

for %%I in ("%~dp0..") do set "SCHOOLHUB_ROOT=%%~fI"
set "START_SCRIPT=%SCHOOLHUB_ROOT%\deployment\windows\Start-SchoolHub.ps1"
set "CONFIG_FILE=%SCHOOLHUB_ROOT%\schoolhub.config.env"

if not exist "%START_SCRIPT%" (
  echo ERROR: SchoolHub startup script was not found.
  echo Expected: %START_SCRIPT%
  pause
  exit /b 1
)

if not exist "%CONFIG_FILE%" (
  echo ERROR: SchoolHub configuration file was not found.
  echo Expected: %CONFIG_FILE%
  echo Run Setup-SchoolHub.bat before using this launcher.
  pause
  exit /b 1
)

echo Starting the SchoolHub PostgreSQL API and application server...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%START_SCRIPT%" -ConfigPath "%CONFIG_FILE%"
if errorlevel 1 (
  echo.
  echo SchoolHub could not be started. Review the message above and the logs folder.
  pause
  exit /b 1
)

echo.
echo SchoolHub Production services are running.
echo Application: http://127.0.0.1:8080/SchoolHub_School_Management_App_Complete.html
echo.
echo Note: Server Production must be activated once inside the browser after server login.
exit /b 0
