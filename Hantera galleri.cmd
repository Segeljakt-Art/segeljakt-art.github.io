@echo off
cd /d "%~dp0"
where pyw >nul 2>nul
if not errorlevel 1 (
  start "" pyw -3 "%~dp0_manager\server.py"
  exit /b 0
)
where pythonw >nul 2>nul
if not errorlevel 1 (
  start "" pythonw "%~dp0_manager\server.py"
  exit /b 0
)
echo Python 3 saknas. Installera Python fran https://www.python.org/downloads/windows/
pause
exit /b 1
