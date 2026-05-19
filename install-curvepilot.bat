@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "STAGED_SOURCE=%SCRIPT_DIR%\build\cep\curvepilot"
set "REPO_SOURCE=%SCRIPT_DIR%"
set "INSTALL_ROOT=%APPDATA%\Adobe\CEP\extensions"
set "INSTALL_DIR=%INSTALL_ROOT%\curvepilot"
set "SOURCE_DIR="

echo CurvePilot Windows installer helper
echo.
echo This will install CurvePilot to:
echo   %INSTALL_DIR%
echo.
echo Close Adobe Premiere Pro before continuing.
echo.

if exist "%SCRIPT_DIR%\package.json" if exist "%SCRIPT_DIR%\scripts\package-cep-extension.mjs" (
  where node >nul 2>nul
  if not errorlevel 1 (
    echo Building the latest staged CEP package...
    pushd "%SCRIPT_DIR%" >nul
    node "%SCRIPT_DIR%\scripts\package-cep-extension.mjs"
    if errorlevel 1 (
      popd >nul
      echo.
      echo ERROR: Failed to build the CurvePilot CEP package.
      exit /b 1
    )
    popd >nul
    echo.
  )
)

if exist "%STAGED_SOURCE%\CSXS\manifest.xml" (
  set "SOURCE_DIR=%STAGED_SOURCE%"
) else if exist "%REPO_SOURCE%\CSXS\manifest.xml" (
  set "SOURCE_DIR=%REPO_SOURCE%"
)

if not defined SOURCE_DIR (
  echo ERROR: Could not find CurvePilot extension files to install.
  echo Expected either:
  echo   %STAGED_SOURCE%\CSXS\manifest.xml
  echo or
  echo   %REPO_SOURCE%\CSXS\manifest.xml
  exit /b 1
)

echo Installing from:
echo   %SOURCE_DIR%
echo.

if not exist "%INSTALL_ROOT%" (
  mkdir "%INSTALL_ROOT%"
  if errorlevel 1 (
    echo ERROR: Failed to create the Adobe CEP extensions directory.
    exit /b 1
  )
)

if exist "%INSTALL_DIR%" (
  echo Removing previous CurvePilot install...
  rmdir /S /Q "%INSTALL_DIR%"
  if exist "%INSTALL_DIR%" (
    echo ERROR: Failed to remove the previous CurvePilot install.
    exit /b 1
  )
)

echo Copying CurvePilot extension files...
robocopy "%SOURCE_DIR%" "%INSTALL_DIR%" /E /R:1 /W:1 >nul
set "ROBOCOPY_EXIT=%ERRORLEVEL%"
if %ROBOCOPY_EXIT% GEQ 8 (
  echo ERROR: File copy failed with Robocopy exit code %ROBOCOPY_EXIT%.
  exit /b %ROBOCOPY_EXIT%
)

echo Enabling Adobe CEP PlayerDebugMode for the current user...
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
if errorlevel 1 (
  echo ERROR: Failed to set PlayerDebugMode for CSXS.11.
  exit /b 1
)

reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
if errorlevel 1 (
  echo ERROR: Failed to set PlayerDebugMode for CSXS.12.
  exit /b 1
)

if not exist "%INSTALL_DIR%\CSXS\manifest.xml" (
  echo ERROR: Install completed but manifest.xml was not found in the installed location.
  exit /b 1
)

echo.
echo CurvePilot was installed successfully.
echo.
echo Next steps:
echo   1. Start Adobe Premiere Pro.
echo   2. Open Window ^> Extensions ^> CurvePilot.
echo   3. If needed, also check Window ^> Extensions ^(Legacy^) ^> CurvePilot.
echo.
pause
exit /b 0
