@echo off
title Herraje Consorcio
cd /d "%~dp0"

echo.
echo  ==========================================
echo   HERRAJE CONSORCIO - Iniciando servidor...
echo  ==========================================
echo.

:: Verificar que Node.js esta instalado
where node >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js no esta instalado.
    echo  Descargalo en: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Verificar que las dependencias esten instaladas
if not exist "node_modules" (
    echo  Instalando dependencias por primera vez...
    echo  Esto puede tardar unos minutos.
    echo.
    npm install
    echo.
)

echo  Servidor iniciando en http://localhost:5173
echo  Abre tu navegador si no se abre automaticamente.
echo.
echo  Para CERRAR el servidor presiona Ctrl+C en esta ventana.
echo.

:: Esperar 2 segundos y abrir el navegador
start "" cmd /c "timeout /t 2 >nul && start http://localhost:5173"

:: Iniciar servidor con acceso desde red local (para celular)
npx vite --host

pause
