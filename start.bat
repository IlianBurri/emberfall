@echo off
title EMBERFALL - Server
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js fehlt: https://nodejs.org & pause & exit /b 1)
if not exist node_modules (
  echo Installiere Abhaengigkeiten ...
  call npm install
)
node server/server.js %*
pause
