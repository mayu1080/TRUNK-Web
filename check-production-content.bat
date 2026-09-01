@echo off
setlocal
cd /d "%~dp0app"
if errorlevel 1 (
  echo Failed to cd to app\
  pause
  exit /b 1
)
echo Running content check...
call npm run check:production-content
echo.
pause
