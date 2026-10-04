@echo off
echo SchoolHub Phase 11 now uses one root configuration file.
echo This compatibility launcher will open the unified setup.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup-SchoolHub.ps1"
if errorlevel 1 pause
