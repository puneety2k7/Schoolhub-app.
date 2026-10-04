@echo off
rem SchoolHub V2 only. Does not touch the old SchoolHub application or database.
cd /d "%~dp0v2"
where node >nul 2>nul || (echo Node.js 22 or newer is required. Install it from https://nodejs.org & pause & exit /b 1)
node scripts\v2ctl.mjs setup
echo.
pause
