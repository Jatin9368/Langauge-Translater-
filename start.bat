@echo off
echo Starting Samvaadini Bharat...

echo [1] Starting Backend...
start "Backend" cmd /k "cd /d D:\Bhashantar\BharatTranslate\backend && npm run dev"

timeout /t 3 /nobreak > nul

echo [2] Forwarding ports to phone...
adb reverse tcp:5000 tcp:5000
adb reverse tcp:8081 tcp:8081

echo [3] Starting Metro bundler...
start "Metro" cmd /k "cd /d D:\Bhashantar\BharatTranslate\BharatTranslateApp && npx react-native start"

echo.
echo All services started!
echo If network error comes again, just run: adb reverse tcp:5000 tcp:5000
pause
