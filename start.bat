@echo off
title tact-intensity-OSC
echo tact-intensity-OSC - VRChat OSC to bHaptics
echo.
echo Dashboard: http://localhost:1969
echo Opening browser in 4 seconds...
start /b cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:1969"
npm start
