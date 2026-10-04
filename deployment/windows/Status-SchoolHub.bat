@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Status-SchoolHub.ps1"
if errorlevel 1 pause
