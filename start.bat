@echo off
title APD Listener Tool - Launcher
color 0A
echo.
echo  =========================================
echo   APD Listener Tool - Starting Services
echo  =========================================
echo.

:: ── Start Backend (Python) ────────────────────────────────────────────────────
echo [1/2] Starting Backend (Python FastAPI)...
cd /d "%~dp0backend"

:: Activate virtualenv if it exists
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)

start "APD Backend" cmd /k "python main.py & pause"
echo       Backend starting on http://127.0.0.1:10000
echo.

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

:: ── Start Frontend (React) ────────────────────────────────────────────────────
echo [2/2] Starting Frontend (React)...
cd /d "%~dp0Frontend"
start "APD Frontend" cmd /k "npm start & pause"
echo       Frontend starting on http://localhost:3000
echo.

echo  =========================================
echo   Both services are starting up!
echo   Frontend: http://localhost:3000
echo   Backend:  http://127.0.0.1:10000
echo  =========================================
echo.
echo  Close this window anytime - services run in their own windows.
echo.
pause
