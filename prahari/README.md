# PRAHARI — AI-Powered Mobile Urban Intelligence Platform

A complete full-stack application that turns a virtual public-transport fleet into a software-based mobile urban sensing network.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  SIMULATION LAYER                    │
│  Virtual Buses → GPS Engine → Camera Engine         │
├─────────────────────────────────────────────────────┤
│                    AI LAYER                          │
│  Object Detection → Tracking → Incident Analysis    │
├─────────────────────────────────────────────────────┤
│               CENTRAL PLATFORM                       │
│  FastAPI → SQLite → WebSockets → React Dashboard    │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

**Frontend:** React 18, TypeScript, Tailwind CSS, Framer Motion, Leaflet, Recharts, Lucide Icons, Zustand

**Backend:** Python 3.14, FastAPI, SQLAlchemy, SQLite (PostgreSQL-ready), WebSockets

**Simulation:** Custom Python virtual bus engine with Delhi GPS routes, AI detection pipeline

## Quick Start

### Option 1 — PowerShell Script
```powershell
.\start.ps1
```

### Option 2 — Manual

**Backend:**
```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```powershell
cd frontend
npm run dev
```

## Access

- **App:** http://localhost:5173
- **API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## Credentials

| Username | Password | Role |
|---|---|---|
| admin | prahari123 | Admin |
| operator | operator123 | Operator |
| viewer | viewer123 | Viewer |

## Features

- **Command Center** — Live GIS map with 20 moving virtual buses
- **Live Fleet** — Real-time bus monitoring and filtering
- **AI Vision** — Canvas-based camera simulation with bounding boxes
- **Incidents** — Full lifecycle management (Detected → Closed)
- **Road Intelligence** — GIS-based road defect tracking
- **Traffic Intelligence** — Congestion analysis from AI detections
- **Routes** — Route intelligence and delay analysis
- **Infrastructure** — Urban infrastructure deficiency tracking
- **Analytics** — Charts from real application data
- **Reports** — CSV report generation
- **System Health** — Live service monitoring
- **Settings** — Platform configuration

## Database

Uses SQLite by default (auto-created at `backend/prahari.db`).
Switch to PostgreSQL by setting `DATABASE_URL` in `backend/.env`.
