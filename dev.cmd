@echo off
rem Dev-server launcher: puts portable Node on PATH, runs the app from this repo.
rem %~dp0 is this script's own directory, so the launcher works from any clone
rem path (it used to hardcode C:\Claude\LunchMatch and broke on a second machine).
set "PATH=%LOCALAPPDATA%\node;%PATH%"
cd /d "%~dp0"
npm run dev
