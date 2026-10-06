@echo off
setlocal enabledelayedexpansion

REM Change to script directory
cd /d "%~dp0"

echo.
echo QuestTracker Vencord Plugin Installer
echo =====================================
echo.

set "VENCORD_DIR=%cd%\..\Vencord"
set "PLUGIN_DIR=questTracker"

if not exist "%VENCORD_DIR%" (
    echo Error: Vencord directory not found: %VENCORD_DIR%
    echo.
    echo Please clone Vencord first:
    echo   git clone https://github.com/Vendicated/Vencord
    echo.
    pause
    exit /b 1
)

echo Installing to: %VENCORD_DIR%\src\userplugins\%PLUGIN_DIR%
echo.

mkdir "%VENCORD_DIR%\src\userplugins\%PLUGIN_DIR%" 2>nul

copy /Y "src\index.tsx" "%VENCORD_DIR%\src\userplugins\%PLUGIN_DIR%\index.tsx" >nul
copy /Y "src\quests.ts" "%VENCORD_DIR%\src\userplugins\%PLUGIN_DIR%\quests.ts" >nul
copy /Y "src\i18n.ts" "%VENCORD_DIR%\src\userplugins\%PLUGIN_DIR%\i18n.ts" >nul

echo.
echo [OK] QuestTracker plugin files copied successfully!
echo.
echo Important:
echo   - Folder name is camelCase: questTracker
echo   - This plugin is read-only (no automation or cheating)
echo.

set /p BUILD="Do you want to build and inject Vencord now? (y/n): "
if /i "%BUILD%"=="y" (
    echo.
    echo Building Vencord from source...
    cd /d "%VENCORD_DIR%"
    call pnpm install --frozen-lockfile
    call pnpm build
    call pnpm inject
    echo.
    echo [OK] Done! Restart Discord and open Settings ^-^> Vencord ^-^> Plugins
) else (
    echo.
    echo To finish setup manually, run:
    echo   cd "%VENCORD_DIR%"
    echo   pnpm install --frozen-lockfile
    echo   pnpm build
    echo   pnpm inject
)

echo.
pause
