@echo off
chcp 65001 >nul
title Atualizar Farmacinha Leticia
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [!] O Node.js nao esta instalado. Instale em https://nodejs.org e tente de novo.
  pause
  exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0atualizar.ps1"
