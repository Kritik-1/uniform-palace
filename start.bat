@echo off
echo ========================================
echo    Uniform Palace Business System
echo ========================================
echo.

echo Starting the system...
echo.

echo 1. Installing dependencies...
npm install

echo.
echo 2. Creating necessary directories...
if not exist "uploads" mkdir uploads
if not exist "logs" mkdir logs

echo.
echo 3. Setting up environment...
echo Please create a .env file with your configuration
echo You can copy from config.env.example and modify as needed

echo.
echo 4. Starting the system...
echo.
echo The system will be available at:
echo - Website: http://localhost:5000
echo - API: http://localhost:5000/api
echo.
echo Press Ctrl+C to stop the server
echo.

npm start

pause
