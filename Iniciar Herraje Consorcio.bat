@echo off
title Herraje Consorcio
cd /d "%~dp0"

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

:: Verificar archivo .env con credenciales de base de datos
if not exist ".env" (
    echo  ==========================================
    echo   ERROR: Falta el archivo .env
    echo  ==========================================
    echo.
    echo  Este archivo contiene las credenciales de
    echo  la base de datos y es necesario para correr
    echo  la aplicacion.
    echo.
    echo  Pasos:
    echo   1. Copia el archivo .env.ejemplo a esta carpeta
    echo   2. Renombralo a exactamente:  .env
    echo   3. Vuelve a abrir este archivo .bat
    echo.
    echo  Si no tienes el archivo .env, pidelo al
    echo  administrador del sistema.
    echo.
    pause
    exit /b 1
)

echo  Base de datos: OK (.env encontrado)
echo.

:: Abrir puerto en firewall (ignora si falla permisos)
netsh advfirewall firewall delete rule name="Herraje Consorcio Dev" >nul 2>&1
netsh advfirewall firewall add rule name="Herraje Consorcio Dev" dir=in action=allow protocol=TCP localport=5173 >nul 2>&1

:: Instalar dependencias frontend si faltan
if not exist "node_modules" (
    echo  Instalando dependencias frontend por primera vez...
    call npm install
    echo.
)

:: Instalar dependencias backend si faltan
if not exist "backend\node_modules" (
    echo  Instalando dependencias backend por primera vez...
    cd backend
    call npm install
    cd ..
    echo.
)

:: Mostrar IPs disponibles
echo  ==========================================
echo   Direcciones para otros dispositivos:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    setlocal enabledelayedexpansion
    set IP=%%a
    set IP=!IP: =!
    if not "!IP!"=="127.0.0.1" echo   --^> http://!IP!:5173
    endlocal
)
echo  ==========================================
echo.
echo  Para CERRAR presiona Ctrl+C
echo.

:: Abrir navegador
start "" cmd /c "timeout /t 3 >nul && start http://localhost:5173"

:: Iniciar backend en ventana separada
echo  Iniciando backend (puerto 3001)...
start "Herraje - Backend" cmd /k "cd /d "%~dp0backend" && node server.js"

:: Esperar un momento para que el backend levante
timeout /t 2 >nul

:: Iniciar frontend
echo  Iniciando frontend (puerto 5173)...
npm run dev

pause
