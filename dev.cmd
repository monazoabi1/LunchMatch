@echo off
rem Dev-server launcher: puts portable Node on PATH, runs the demo-mode app.
set "PATH=%LOCALAPPDATA%\node;%PATH%"
cd /d C:\Claude\LunchMatch
npm run dev
