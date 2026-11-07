@echo off
cd /d "%~dp0"
call npm run dev -- --hostname 0.0.0.0 --port 3101
