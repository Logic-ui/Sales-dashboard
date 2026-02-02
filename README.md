# Sales Dashboard

A full-stack sales management application with FastAPI backend and React frontend.

## Project Structure

```
fastapi-sales/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── config.py
│   │   ├── auth.py
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── sales.py
│   │   │   └── dashboard.py
│   │   └── utils/
│   │       ├── hashing.py
│   │       └── jwt.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── index.jsx
│   ├── public/
│   │   └── index.html
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── requirements.txt
```

## Setup & Running

### Using Docker (Recommended)

```bash
# Build and run both backend and frontend (detached)
docker compose up --build -d
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Debugging in Docker 🔧

- Build and start containers (detached):

```bash
docker compose up --build -d
```

- Attach debuggers from VS Code (see `.vscode/launch.json` added to the repo):
  - **Python (Backend)**: attach to `localhost:5678` (uses `debugpy`)
  - **Node (Frontend)**: attach to `localhost:9229` (Node inspector)

- Useful commands:
  - View logs: `docker compose logs -f backend` or `docker compose logs -f frontend`
  - Rebuild when dependencies change: `docker compose up --build -d --force-recreate`

> ⚠️ Note: Ensure Docker is running locally and ports 8000/3000/5678/9229 are available.

### Local Development

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r ../requirements.txt
uvicorn app.main:app --reload
```

Backend runs on: http://localhost:8000

#### Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs on: http://localhost:3000

## Features

- User Authentication (Email/Password)
- Sales Management
- Dashboard with Sales Analytics
- RESTful API with FastAPI
- Modern React UI

## Default Credentials

Create users through the API or registration endpoint.

## Technologies

- **Backend**: FastAPI, SQLAlchemy, SQLite
- **Frontend**: React 18, Axios, CSS3
- **DevOps**: Docker, Docker Compose
