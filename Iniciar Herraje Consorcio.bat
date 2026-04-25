@echo off
title Herraje Consorcio
cd /d "%~dp0"

:: ── Auto-elevacion a Administrador ──────────────────────────────────────────
net session >nul 2>&1
if errorlevel 1 (
    echo  Solicitando permisos de administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo  ==========================================
echo   HERRAJE CONSORCIO - Iniciando servidor...
echo  ==========================================
echo.

:: Verificar Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js no esta instalado.
    echo  Descargalo en: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Abrir puerto 5173 en el firewall
netsh advfirewall firewall delete rule name="Herraje Consorcio Dev" >nul 2>&1
netsh advfirewall firewall add rule name="Herraje Consorcio Dev" dir=in action=allow protocol=TCP localport=5173
echo  Puerto 5173 habilitado en el firewall.
echo.

:: Instalar dependencias si faltan
if not exist "node_modules" (
    echo  Instalando dependencias por primera vez...
    npm install
    echo.
)

:: Mostrar IP local
echo  ==========================================
echo   Direcciones para conectar desde celular:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    setlocal enabledelayedexpansion
    set IP=%%a
    set IP=!IP: =!
    if not "!IP!"=="127.0.0.1" echo   http://!IP!:5173
    endlocal
)
echo  ==========================================
echo.
echo  Para CERRAR presiona Ctrl+C en esta ventana.
echo.

:: Abrir navegador local
start "" cmd /c "timeout /t 3 >nul && start http://localhost:5173"

:: Iniciar Vite
npx vite

pause
