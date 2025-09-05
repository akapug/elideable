@echo off
REM Elideable Development Restart Script for Windows
REM Kills and restarts both backend and frontend services

echo 🔄 Restarting Elideable services...

REM Kill existing processes
echo 🛑 Stopping existing services...

echo    Killing processes on port 8787 (Elide backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8787"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo    Killing processes on port 5173 (Vite frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo    Killing Node.js processes...
taskkill /f /im node.exe >nul 2>&1

REM Wait for processes to terminate
timeout /t 2 /nobreak >nul

REM Start backend
echo 🚀 Starting Elide backend...
cd services\elide
start "Elide Backend" cmd /k "node --env-file=../../.env elide.mjs"

REM Wait for backend to initialize
timeout /t 3 /nobreak >nul

REM Start frontend
echo 🎨 Starting Vite frontend...
cd ..\..\apps\web
start "Vite Frontend" cmd /k "pnpm dev"

REM Wait for services to start
timeout /t 3 /nobreak >nul

echo.
echo ✅ Services restarted successfully!
echo    🔗 Frontend: http://localhost:5173
echo    🔗 Backend:  http://localhost:8787
echo.
echo 💡 Two new command windows opened:
echo    - "Elide Backend" - Backend server logs
echo    - "Vite Frontend" - Frontend development server
echo.
echo 🛑 To stop services: Close the command windows or use Ctrl+C
echo.
pause
