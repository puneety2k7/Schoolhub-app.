@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Validate-SchoolHub.ps1"
if errorlevel 1 pause
