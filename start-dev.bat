@echo off
echo Starting Indian Stock Dashboard...
echo.

echo [1/2] Starting Backend Server...
start "Backend Server" cmd /c "cd backend && npm start"

echo [2/2] Starting Frontend Server...
start "Frontend Server" cmd /c "npm run dev"

echo.
echo ✅ Both servers are starting up...
echo.
echo 🌐 Frontend will be available at: http://localhost:3000
echo 🔧 Backend API will be available at: http://localhost:5001
echo.
echo Press any key to continue...
pause > nul
