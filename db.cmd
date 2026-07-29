@echo off
rem Local Supabase stack launcher — mirrors dev.cmd's portable-tool approach so
rem neither Node nor the Supabase CLI has to be on the system PATH.
rem
rem   db.cmd start      spin the stack up (Docker Desktop must be running)
rem   db.cmd status     print URLs and the anon / service-role keys
rem   db.cmd stop       shut the containers down
rem   db.cmd db reset   drop and rebuild from supabase/schema.sql
set "PATH=%LOCALAPPDATA%\supabase-cli;%LOCALAPPDATA%\node;%PATH%"
cd /d "%~dp0"
supabase %*
