@echo off
rem Production launcher — what you want for a demo.
rem
rem Unlike dev.cmd, this serves a pre-built app: no on-demand compilation, so
rem there is no 10-15 second stall the first time you open a page. Build once,
rem then start; re-run this after changing code.
rem
rem   start.cmd          build (if needed) and serve on http://localhost:3000
rem   start.cmd build    force a rebuild first
setlocal
set "PATH=%LOCALAPPDATA%\node;%PATH%"
cd /d "%~dp0"

if /i "%~1"=="build" goto build
if not exist ".next\BUILD_ID" goto build
goto serve

:build
echo Building production bundle (about a minute)...
call npm run build || exit /b 1

:serve
echo.
echo LunchMatch running at http://localhost:3000  (Ctrl+C to stop)
call npm run start
