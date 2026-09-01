@echo off
setlocal
cd /d "%~dp0app"
if errorlevel 1 (
  echo Failed to cd to app\
  pause
  exit /b 1
)
echo Starting production 4-window shell...
echo Do not use preview commands for site 4-screen QA.
call npm run start:production
echo.
pause
