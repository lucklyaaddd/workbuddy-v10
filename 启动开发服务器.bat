@echo off
chcp 65001 >nul
title WorkBuddy Dev Server

echo ============================================
echo   WorkBuddy V10.0 Dev Server
echo ============================================
echo.

REM 切换到脚本所在目录
cd /d "%~dp0"

REM 检查 .env 文件
if not exist ".env" (
    echo [错误] .env 文件不存在！
    echo 请先复制 .env.example 为 .env 并填写配置
    echo.
    pause
    exit /b 1
)

REM 检查 node_modules
if not exist "node_modules" (
    echo [提示] 首次运行，正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo [错误] npm install 失败
        pause
        exit /b 1
    )
)

echo [启动] 正在启动 Vite dev server（监听 0.0.0.0:3000）...
echo.
echo 浏览器打开: http://localhost:3000
echo Ctrl+C 停止服务
echo.

call npm run dev

pause
