@echo off
echo Starting Hisba SaaS (Backend & Frontend) ...

echo [1/2] Starting Django Backend on Port 8000
start cmd /k "cd backend && python manage.py runserver 0.0.0.0:8000"

echo [2/2] Starting React Vite Frontend on Port 5173
start cmd /k "cd frontend && npm run dev"

echo.
echo Application is starting! 
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:8000/api/
echo Wait a few seconds for servers to boot up...
pause
