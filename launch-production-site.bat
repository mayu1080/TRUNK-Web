@echo off
setlocal
cd /d "%~dp0app"
if errorlevel 1 (
  echo Failed to cd to app\
  pause
  exit /b 1
)
echo Starting production SITE mode (OS display.bounds, preview env cleared)...
call npm run start:production:site
echo.
pause
