@echo off
cd /d "%~dp0"
where pyw >nul 2>nul
if not errorlevel 1 (
  start "" pyw "%~dp0upload-painting.pyw"
  exit /b 0
)
where pythonw >nul 2>nul
if not errorlevel 1 (
  start "" pythonw "%~dp0upload-painting.pyw"
  exit /b 0
)
echo Python 3 saknas. Installera Python fran https://www.python.org/downloads/windows/
echo Installera med Tcl/Tk och Python-kommandon aktiverade.
pause
exit /b 1
