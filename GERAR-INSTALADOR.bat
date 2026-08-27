@echo off
chcp 65001 >nul
title Gerar instalador - Farmacinha Leticia
cd /d "%~dp0"

echo ============================================
echo   Farmacinha Leticia - Gerar instalador exe
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] O Node.js nao esta instalado neste computador.
  echo     Baixe e instale em: https://nodejs.org
  pause
  exit /b
)

if not exist "node_modules" (
  echo Instalando os componentes... aguarde alguns minutos.
  call npm install
)

echo.
echo Gerando o instalador .exe... isso pode demorar um pouco.
echo.
call npm run dist
if errorlevel 1 (
  echo.
  echo [!] Houve um erro ao gerar o instalador.
  pause
  exit /b
)

echo.
echo ============================================
echo  PRONTO! O instalador esta na pasta "dist".
echo  Procure o arquivo "Farmacinha Leticia Setup".
echo ============================================
echo.
pause
