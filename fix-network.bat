@echo off
echo Fixing network connection...
adb reverse tcp:5000 tcp:5000
adb reverse tcp:8081 tcp:8081
echo Done! Now reload the app on your phone.
pause
