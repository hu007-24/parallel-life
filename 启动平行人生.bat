@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Parallel Life 平行人生实验室
if not exist dist\index.html (
  echo 首次运行：正在构建生产产物…
  call npm run build
  if errorlevel 1 (
    echo 构建失败：请先执行 npm install 安装依赖。
    pause
    exit /b 1
  )
)
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:4173"
node scripts\serve.mjs
pause