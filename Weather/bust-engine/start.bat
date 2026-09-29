@echo off
echo ============================================================
echo ForecastBustAI - Bust Probability Engine (Python/FastAPI)
echo ============================================================
cd /d "%~dp0"

REM Find Python executable
set "PYTHON_EXE=python"
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if exist "%LOCALAPPDATA%\Python\bin\python.exe" (
        set "PYTHON_EXE=%LOCALAPPDATA%\Python\bin\python.exe"
    ) else (
        py --version >nul 2>&1
        if %ERRORLEVEL% equ 0 (
            set "PYTHON_EXE=py"
        ) else (
            echo [ERROR] Python not found. Please install Python 3.11+
            pause
            exit /b 1
        )
    )
)

echo [INFO] Using Python: %PYTHON_EXE%

REM Install dependencies if needed
echo [INFO] Installing/verifying Python dependencies...
"%PYTHON_EXE%" -m pip install -r requirements.txt --quiet

REM Start FastAPI server on port 8001
echo [INFO] Starting FastAPI bust-probability engine on port 8001...
echo [INFO] API docs available at: http://localhost:8001/docs
echo.
"%PYTHON_EXE%" -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
pause
