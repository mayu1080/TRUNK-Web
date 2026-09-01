@echo off
setlocal
cd /d "%~dp0app"
if errorlevel 1 (
  echo Failed to cd to app\
  pause
  exit /b 1
)
echo Building Electron main then production renderer...
call npm run build
if errorlevel 1 (
  echo npm run build failed
  pause
  exit /b 1
)
call npm run build:production
if errorlevel 1 (
  echo npm run build:production failed
  pause
  exit /b 1
)
echo Build ok.
echo.
pause
