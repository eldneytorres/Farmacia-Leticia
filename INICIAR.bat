@echo off
chcp 65001 >nul
title Farmacinha Leticia
cd /d "%~dp0"

echo ============================================
echo        Farmacinha Leticia - Iniciando
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] O Node.js nao esta instalado neste computador.
  echo.
  echo     Baixe e instale em: https://nodejs.org
  echo     Escolha a versao "LTS", instale, e depois
  echo     de duplo-clique neste arquivo de novo.
  echo.
  pause
  exit /b
)

if not exist "node_modules" (
  echo Primeira vez: instalando os componentes...
  echo Isso pode levar alguns minutos. Aguarde.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [!] Houve um erro na instalacao. Tente rodar de novo.
    pause
    exit /b
  )
)

echo.
echo Abrindo o aplicativo...
call npm start
