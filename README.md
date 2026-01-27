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
# Build and run both backend and frontend
docker-compose up --build
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

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
