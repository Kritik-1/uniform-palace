# Uniform Palace Business System Startup Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Uniform Palace Business System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting the system..." -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Installing dependencies..." -ForegroundColor Green
npm install

Write-Host ""
Write-Host "2. Creating necessary directories..." -ForegroundColor Green
if (!(Test-Path "uploads")) { New-Item -ItemType Directory -Name "uploads" }
if (!(Test-Path "logs")) { New-Item -ItemType Directory -Name "logs" }

Write-Host ""
Write-Host "3. Setting up environment..." -ForegroundColor Green
Write-Host "Please create a .env file with your configuration" -ForegroundColor Yellow
Write-Host "You can copy from config.env.example and modify as needed" -ForegroundColor Yellow

Write-Host ""
Write-Host "4. Starting the system..." -ForegroundColor Green
Write-Host ""
Write-Host "The system will be available at:" -ForegroundColor Cyan
Write-Host "- Website: http://localhost:5000" -ForegroundColor White
Write-Host "- API: http://localhost:5000/api" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm start

Read-Host "Press Enter to exit"
