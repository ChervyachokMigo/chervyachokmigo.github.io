@echo off
cd /d "%~dp0"

echo [1/4] Copy from editor...
node copy_data.js || (echo ERROR: copy_data.js failed & pause & exit /b 1)

echo.
echo [2/4] Anonymize data...
node anonymize_data.js || (echo ERROR: anonymize_data.js failed & pause & exit /b 1)

echo.
echo [3/4] Generate manifest...
node generate_manifest.js || (echo ERROR: generate_manifest.js failed & pause & exit /b 1)

echo.
echo [4/4] Git commit and push...
git add -A
git diff --cached --quiet && (echo No changes & pause & exit /b 0)
git commit -m "Update tables (%DATE% %TIME%)" || (echo ERROR: commit failed & pause & exit /b 1)
git push || (echo ERROR: push failed & pause & exit /b 1)

echo.
echo ✅ Done
pause