# Sales Dashboard - Setup & Run Guide

## ✅ Status
- **Backend**: Running on http://localhost:8000
- **Frontend**: Ready to run on http://localhost:3000
- **API Docs**: http://localhost:8000/docs

## Quick Start - Option 1: Local Development (Recommended)

### Prerequisites
- Python 3.10+
- Node.js 14+
- npm

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r ../requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0
```

Backend runs on: **http://localhost:8000**

### Frontend Setup (New Terminal)
```bash
cd frontend
npm install
npm start
```

Frontend runs on: **http://localhost:3000**

---

## Quick Start - Option 2: Docker Compose

### Prerequisites
- Docker
- Docker Compose

### Start All Services
```bash
docker-compose up --build
```

- Backend: http://localhost:8000
- Frontend: http://localhost:3000

---

## Project Structure

```
fastapi-sales/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── database.py          # SQLite database config
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── auth.py              # Auth utilities
│   │   ├── routes/              # API endpoints
│   │   └── utils/               # Helper functions
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main App component
│   │   ├── api/                 # Axios configuration
│   │   ├── pages/               # Page components
│   │   └── components/          # Reusable components
│   ├── public/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── requirements.txt
└── README.md
```

---

## API Endpoints

### Authentication
- `POST /auth/login` - Login with email & password
- `POST /auth/register` - Register new user

### Sales
- `GET /sales/` - Get all sales (requires token)
- `POST /sales/` - Create new sale
- `GET /sales/{id}` - Get sale by ID

### Dashboard
- `GET /dashboard/` - Get dashboard data

---

## Frontend Features

- User Authentication (Email/Password)
- Login & Register pages
- Sales Dashboard with table
- Sales Management page
- User Profile page
- Token-based API authentication

---

## Database

- **Type**: SQLite (local file: `test.db`)
- **Location**: `backend/test.db`
- **Auto-created**: Yes, on first run

---

## Fixed Issues

✅ Removed PostgreSQL dependency (using SQLite instead)
✅ Fixed Pydantic V2 config warnings
✅ Updated frontend entry point configuration
✅ Configured environment variables for Docker
✅ Fixed axios API URL configuration

---

## Troubleshooting

### Port Already in Use
```bash
# Find process on port 8000
lsof -i :8000
# Kill process
kill -9 <PID>

# Same for port 3000
lsof -i :3000
kill -9 <PID>
```

### Frontend npm install fails
```bash
rm -rf frontend/node_modules
npm cache clean --force
cd frontend && npm install
```

### Backend import errors
```bash
cd backend
source venv/bin/activate
pip install -r ../requirements.txt
```

---

## Default Test Credentials

Create users through the `/auth/register` endpoint or API docs UI.

API Docs: http://localhost:8000/docs

---

## Technologies Used

- **Backend**: FastAPI, SQLAlchemy, Pydantic, SQLite
- **Frontend**: React 18, React Router, Axios, CSS3
- **DevOps**: Docker, Docker Compose
- **Security**: JWT tokens, password hashing with bcrypt

