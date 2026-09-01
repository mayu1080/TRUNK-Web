@echo off
setlocal
cd /d "%~dp0app"
if errorlevel 1 (
  echo Failed to cd to app\
  pause
  exit /b 1
)
echo Starting production single preview (PRODUCT_LIST skip). Not a 4-screen substitute.
call npm run start:production:preview
echo.
pause
