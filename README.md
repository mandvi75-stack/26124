Prahari 🚍

AI-Powered Mobile Urban Intelligence Platform

Prahari is an AI-powered urban intelligence platform designed to improve public transport safety and road monitoring through simulated fleet tracking, AI-based incident detection, and road condition analysis.

The platform provides a centralized interface to monitor buses, identify potential road safety incidents, and support faster investigation through visual evidence and location-based information.

🚀 Key Features

1. Live Fleet Monitoring

- Monitor simulated public transport vehicles.
- View bus locations on an interactive map.
- Track fleet information through a centralized dashboard.

2. AI-Based Incident Detection

- Identify potential road safety incidents.
- Detect simulated events such as rash driving, hit-and-run incidents, and sudden braking.
- Display incident information for investigation.

3. Road Intelligence

- Identify potential road infrastructure issues.
- Monitor simulated potholes, damaged roads, waterlogging, and missing road markings.
- Present road-related information through the dashboard.

4. Incident Management

- View reported incidents.
- Examine available evidence and incident details.
- Display relevant timestamps, vehicle information, and location data where available.

5. Analytics Dashboard

- Visualize fleet and incident information.
- Present road safety insights.
- Support monitoring through centralized dashboard views.

🛠️ Tech Stack

Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Leaflet

Backend

- Python
- FastAPI

Database

- PostgreSQL
- SQLAlchemy
- Alembic

🏗️ Project Structure

Prahari/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── services/
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── main.py
│   │
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md

Note: The structure above represents the intended organization. Actual folders and files may differ.

⚙️ Installation and Setup

Prerequisites

- Node.js
- Python 3.11+
- Git
- PostgreSQL (if using the database-backed backend)

1. Clone the Repository

git clone <repository-url>
cd Prahari

2. Frontend Setup

cd frontend
npm install
npm run dev

The frontend will run at the local URL provided by Vite.

3. Backend Setup

Open another terminal:

cd backend
python -m venv venv

Activate the virtual environment.

Windows:

venv\Scripts\activate

Install dependencies:

pip install -r requirements.txt

Start the FastAPI server:

uvicorn app.main:app --reload

The backend will run locally on port 8000, unless configured otherwise.

API documentation:

http://localhost:8000/docs

🌐 Deployment

Frontend

The frontend is deployed using Vercel.

Backend

The backend is designed to run as a FastAPI service.

Backend deployment and external service integrations depend on the configured environment and deployment status.

🔐 Environment Variables

Sensitive credentials should be stored in environment variables and deployment settings rather than committed to the repository.

Example:

DATABASE_URL=
SECRET_KEY=

Additional variables may be required depending on the configured services.

Never commit actual API keys, passwords, or private credentials.

⚠️ Limitations

- Fleet monitoring and incident information may use simulated data.
- AI-based detection depends on the implemented detection pipeline and available inputs.
- External service integrations require valid credentials and configuration.
- Detection results should be treated as potential incidents and verified before taking action.
- The platform is intended as a monitoring and decision-support tool, not a replacement for human investigation.

🎯 Objective

Prahari aims to demonstrate how AI-assisted monitoring, fleet intelligence, and road safety analysis can contribute to safer and more efficient public transportation systems.

👩‍💻 Project Team

Developed as a team project for the Smart India Hackathon.

Team: Navodaya

Problem Statement: SIH26124

Project: AI-Powered Mobile Urban Intelligence Platform Using Public Transport Fleet

📌 Disclaimer

Prahari is a prototype developed for demonstration and innovation purposes. Its outputs depend on the available data, implemented functionality, and configured services. It does not independently establish that an incident has occurred.
