@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deployment\windows\Start-SchoolHub.ps1"
if errorlevel 1 pause
