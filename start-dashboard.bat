@echo off
title Dashboard Startup
color 0A

echo ========================================
echo   Starting AI Stock Dashboard
echo ========================================
echo.

REM Check if backend directory exists
if not exist "backend\" (
    echo ERROR: backend directory not found!
    pause
    exit /b 1
)

REM Check if .env files exist
if not exist "backend\.env" (
    echo WARNING: backend\.env file not found!
    echo You need to configure Upstox access token.
    pause
)

if not exist ".env.local" (
    echo WARNING: .env.local file not found!
    echo You may need to configure backend URL.
)

echo Step 1: Starting Backend Server...
echo ----------------------------------------
start "Backend Server" cmd /k "cd /d %~dp0backend && npm run dev"

echo Waiting for backend to start...
timeout /t 8 /nobreak >nul

echo.
echo Step 2: Starting Frontend Server...
echo ----------------------------------------
start "Frontend Server" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ========================================
echo   Dashboard is starting...
echo ========================================
echo.
echo Backend:       http://localhost:5002
echo Frontend:      http://localhost:3000
echo Health Check:  http://localhost:5002/api/health-check/upstox
echo.
echo Waiting 15 seconds for servers to initialize...
timeout /t 15 /nobreak >nul

echo.
echo Opening health check in browser...
start http://localhost:5002/api/health-check/upstox

timeout /t 3 /nobreak >nul
echo.
echo Opening dashboard...
start http://localhost:3000

echo.
echo ========================================
echo Dashboard should now be running!
echo.
echo If you see issues:
echo 1. Check the health check page
echo 2. Read TROUBLESHOOTING.md
echo 3. Check both terminal windows for errors
echo ========================================
pause
