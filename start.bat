@echo off
title Samvaadini Bharat - Starting...
color 0A

echo.
echo  ==========================================
echo   Samvaadini Bharat - Starting Services
echo  ==========================================
echo.

:: Kill any existing node processes on port 5000
echo [1/3] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

:: Start Backend
echo [2/3] Starting Backend (port 5000)...
start "Samvaadini Backend" cmd /k "cd /d D:\Bhashantar\BharatTranslate\backend && npm run dev"

:: Wait for backend to start
timeout /t 4 /nobreak > nul

:: Forward ports
echo [3/3] Connecting phone (adb reverse)...
adb reverse tcp:5000 tcp:5000 >nul 2>&1
adb reverse tcp:8081 tcp:8081 >nul 2>&1

echo.
echo  ==========================================
echo   All services started successfully!
echo   Backend: http://localhost:5000
echo   
echo   Now run Metro in another terminal:
echo   cd BharatTranslateApp
echo   npx react-native start
echo  ==========================================
echo.
pause
