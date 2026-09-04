@echo off
setlocal
cd /d "%~dp0app"
if errorlevel 1 (
  echo Failed to cd to app\
  pause
  exit /b 1
)
if not defined TRUNK_PRODUCTION_IDLE_SECONDS set TRUNK_PRODUCTION_IDLE_SECONDS=120
echo Starting canonical production (OS display.bounds, preview env cleared, idle 120s)...
call npm run start:production:site
echo.
pause
