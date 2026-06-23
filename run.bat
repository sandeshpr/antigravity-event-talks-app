@echo off
title BigQuery Release Pulse Server
echo =======================================================
echo        BIGQUERY RELEASE PULSE & TWEET COMPOSER
echo =======================================================
echo.
echo [1/3] Navigating to project directory...
cd /d "%~dp0"

echo [2/3] Activating virtual environment...
if not exist "venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found. Please run installation command first.
    pause
    exit /b 1
)
call venv\Scripts\activate.bat

echo [3/3] Launching Flask server...
echo.
echo Application will be running at: http://127.0.0.1:5000/
echo Press Ctrl+C in this terminal window to stop the server.
echo.
python app.py
if %errorlevel% neq 0 (
    echo.
    echo Server terminated with error code %errorlevel%.
    pause
)
