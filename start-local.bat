@echo off
cd /d %~dp0
where py >nul 2>nul
if %errorlevel%==0 (
  start "Badminton Club Server" cmd /k "cd /d %~dp0 && py -m http.server 8080"
) else (
  start "Badminton Club Server" cmd /k "cd /d %~dp0 && python -m http.server 8080"
)
timeout /t 1 /nobreak >nul
start "" http://localhost:8080
