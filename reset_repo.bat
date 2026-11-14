@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo   RESET REPOSITORY
echo ============================================================
echo.
echo This will:
echo   1. Delete local .git folder (all history and branches)
echo   2. Reinitialize git with a fresh 'main' branch
echo   3. Force-push to GitHub (overwrites remote main)
echo.
echo Make a backup of this folder first if unsure.
echo.
set /p CONFIRM=Type YES to continue: 
if /i not "%CONFIRM%"=="YES" (
    echo Aborted.
    pause
    exit /b 0
)

echo.
echo [1/6] Checking .gitignore...
if not exist ".gitignore" (
    echo Creating .gitignore...
    (
        echo data/nicks/
        echo node_modules/
        echo .DS_Store
        echo Thumbs.db
        echo *.log
    ) > .gitignore
) else (
    findstr /c:"data/nicks" .gitignore >nul 2>nul
    if errorlevel 1 (
        echo Adding data/nicks/ to .gitignore...
        echo data/nicks/>> .gitignore
    )
)

echo.
echo [2/6] Removing local .git...
if exist ".git" (
    rmdir /s /q .git
    if exist ".git" (
        echo ERROR: could not remove .git. Close editors/terminals using it.
        pause
        exit /b 1
    )
)

echo.
echo [3/6] Initializing new repository...
git init || (echo ERROR: git init failed & pause & exit /b 1)
git branch -M main || (echo ERROR: branch rename failed & pause & exit /b 1)

echo.
echo [4/6] Adding remote origin...
git remote add origin https://github.com/ChervyachokMigo/ChervyachokMigo.github.io.git || (echo ERROR: remote add failed & pause & exit /b 1)

echo.
echo [5/6] Staging files...
git add -A || (echo ERROR: git add failed & pause & exit /b 1)

echo.
echo Files to be committed:
git status --short

echo.
echo [6/6] Committing and force-pushing...
git commit -m "Initial commit" || (echo ERROR: commit failed & pause & exit /b 1)
git push -u --force origin main
if errorlevel 1 (
    echo.
    echo ERROR: push failed. Check network/auth and try manually:
    echo   git push -u --force origin main
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   DONE
echo ============================================================
echo.
echo IMPORTANT - do this on GitHub:
echo   1. Settings - Pages - Source = 'main' / '(root)' (re-enable if needed)
echo   2. Settings - Branches - Default = 'main'
echo.
echo Site will be live in 1-3 minutes.
pause
endlocal