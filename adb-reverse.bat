@echo off
echo Running adb reverse...
adb reverse tcp:5000 tcp:5000
adb reverse tcp:8081 tcp:8081
echo Done! Port forwarding active.
pause
