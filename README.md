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
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── index.jsx
│   ├── public/
│   │   └── index.html
│   └── package.json
└── requirements.txt
```

## Setup & Running

### Docker

This repository no longer includes Docker configuration. Please use the **Local Development** instructions below to run the backend and frontend on your machine.

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

**Tip:** You can also run both services at once with the included `start.sh` script: `./start.sh` (Linux/macOS).

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
- **DevOps**: Local development
