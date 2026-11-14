@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo ERROR: Node.js not found & pause & exit /b 1)
echo Local server: http://localhost:8000
npx --yes serve -l 8000 .