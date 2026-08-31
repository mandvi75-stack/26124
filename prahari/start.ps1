#!/usr/bin/env pwsh
# PRAHARI - Start Script

Write-Host "
╔══════════════════════════════════════════╗
║  PRAHARI - Urban Intelligence Platform  ║
║  Starting application servers...        ║
╚══════════════════════════════════════════╝
" -ForegroundColor Cyan

# Start backend
Write-Host "[1/2] Starting PRAHARI Backend (FastAPI)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" -WindowStyle Normal

Start-Sleep -Seconds 3

# Start frontend
Write-Host "[2/2] Starting PRAHARI Frontend (React/Vite)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "
✅ PRAHARI is starting up!

   Frontend: http://localhost:5173
   Backend:  http://localhost:8000
   API Docs: http://localhost:8000/docs

   Default login: admin / prahari123

" -ForegroundColor Green
