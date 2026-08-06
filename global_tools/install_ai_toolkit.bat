@echo off
setlocal enabledelayedexpansion

echo ==================================================
echo Iniciando instalacion/actualizacion del Toolkit de IA
echo ==================================================

:: 1. Verificar Node.js
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [X] Error: npm no esta instalado. Instala Node.js primero.
    pause
    exit /b 1
)

:: 2. Verificar uv
where uv >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] Instalando uv...
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
) else (
    echo [v] uv ya esta instalado.
)

echo.
echo 1/4. Instalando/Actualizando Caveman...
echo (Nota: En Windows, instala Caveman via WSL o Git Bash si es necesario).

echo.
echo 2/4. Instalando/Actualizando Tessl CLI...
call npm install -g @tessl/cli

echo.
echo 3/4. Instalando/Actualizando Graphify...
call uv tool install graphifyy
set "PATH=%USERPROFILE%\.local\bin;%PATH%"

echo.
echo 4/4. Configurando Antigravity IDE (Mirror Update)...
set PLUGIN_DEST=%USERPROFILE%\.gemini\config\plugins\shipedge-toolkit-plugin
set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

if exist "%SCRIPT_DIR%\plugin" (
    echo [~] Limpiando configuraciones antiguas...
    if exist "%PLUGIN_DEST%" rmdir /s /q "%PLUGIN_DEST%"
    mkdir "%PLUGIN_DEST%"
    
    echo [~] Copiando nuevos archivos del plugin...
    xcopy /E /I /Y "%SCRIPT_DIR%\plugin\*" "%PLUGIN_DEST%\" >nul
    echo [v] Plugin actualizado con exito.
) else (
    echo [!] Advertencia: No se encontro la carpeta 'plugin'.
)

echo.
echo ==================================================
echo [v] Todo listo. 
echo Recuerda: Cuando haya cambios, haz 'git pull' y ejecuta este script de nuevo.
echo ==================================================
pause
