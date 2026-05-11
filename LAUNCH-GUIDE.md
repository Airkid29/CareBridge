# 🚀 CareBridge AI - Launch Guide

## Pre-Launch Checklist ✅

- ✅ Frontend React build successful (83.51 KB gzipped)
- ✅ Backend FastAPI imports validated
- ✅ MCP Server protocol ready
- ✅ All dependencies installed
- ✅ Environment variables configured (.env present)

---

## Quick Start (3 Terminals)

### Terminal 1: Backend API Server
```bash
cd backend
source ../.venv/bin/activate
uvicorn main:app --reload
# Expected: INFO: Uvicorn running on http://127.0.0.1:8000
```

### Terminal 2: Frontend React App
```bash
cd frontend/carebridge-ui
npm start
# Expected: Compiled successfully! App running on http://localhost:3000
```

### Terminal 3: MCP Server
```bash
cd mcp-server
source ../.venv/bin/activate
python3 server.py
# Expected: MCP Server initialized and listening
```

---

## API Testing

### FastAPI Auto-Docs
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Demo Credentials
```
Email: admin@carebridge.ai
Password: admin123
Role: admin

OR

Email: doctor@carebridge.ai
Password: doctor123
Role: clinician
```

### Test Patient
- **ID**: demo-001
- **Name**: John Martinez
- **Age**: 67
- **Diagnosis**: Type 2 Diabetes (poorly controlled)
- **Key Finding**: Warfarin + Ibuprofen drug interaction

---

## Troubleshooting

### Frontend Issues
```bash
# If npm start fails with "react-scripts: not found"
cd frontend/carebridge-ui
rm -rf node_modules package-lock.json
npm install

# If build warnings appear
npm run build  # Creates optimized production build in 'build/' folder
```

### Backend Issues
```bash
# If Google Gemini API fails
# Check .env file has valid GEMINI_API_KEY

# If port 8000 already in use
uvicorn main:app --reload --port 8001
```

### MCP Server Issues
```bash
# Ensure MCP SDK installed
pip install mcp

# Check Python version (requires 3.12+)
python3 --version
```

---

## Project Structure

```
carebridge-ai/
├── backend/                 FastAPI + Gemini AI
│   ├── main.py             - API endpoints & workflows
│   └── main_broken.py      - (backup file - unused)
│
├── frontend/
│   └── carebridge-ui/      React + Tailwind CSS
│       ├── src/
│       │   ├── App.jsx     - Main application component
│       │   ├── components/ - Reusable React components
│       │   └── index.js
│       ├── public/         - Static assets
│       ├── build/          - Production build output
│       └── package.json
│
├── mcp-server/             MCP Protocol Implementation
│   └── server.py           - Stdio-based MCP server
│
├── .env                    - Environment configuration
├── SUBMISSION_FORM.md      - Hackathon submission details
└── LAUNCH-GUIDE.md         - This file
```

---

## Key Features Demo Workflow

### Step 1: Login
- Open http://localhost:3000
- Login as `doctor@carebridge.ai` / `doctor123`

### Step 2: Load Patient
- Click "Load Demo Patient"
- Loads John Martinez (demo-001)

### Step 3: Run Safety Scans
1. **Medication Scan**: Detects Warfarin + Ibuprofen interaction
2. **Follow-up Review**: Identifies missing specialist appointments
3. **Generate Plan**: Creates personalized discharge instructions

### Step 4: Approve & Finalize
- Clinician reviews and approves the plan
- Plan marked as "Ready for discharge"

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **API** | FastAPI + Uvicorn |
| **AI Model** | Google Gemini 2.0 Flash |
| **Protocol** | Model Context Protocol (MCP) |
| **Standards** | FHIR R4 (HL7) |
| **Frontend** | React 19.2.5 + Tailwind CSS |
| **Auth** | JWT (HS256) |
| **Database** | In-memory (demo), PostgreSQL-ready |

---

## Environment Variables (.env)

```
# Gemini API Configuration
GEMINI_API_KEY=your_key_here

# FHIR Server
FHIR_SERVER_URL=https://hapi.fhir.org/baseR4

# JWT Configuration
JWT_SECRET=carebridge-super-secret-key-2026
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Server Ports
BACKEND_PORT=8000
FRONTEND_PORT=3000
MCP_SERVER_PORT=5000
```

---

## Deployment Notes

### Production Build
```bash
# Frontend
cd frontend/carebridge-ui
npm run build
# Output: build/ folder ready for static hosting

# Backend
# Deploy to cloud with environment variables configured
# Example: Docker container or serverless function
```

### Docker Support (Future)
```bash
# Pre-configured for containerization
# Dockerfile definitions available upon request
```

---

## Support & Documentation

- **API Docs**: http://localhost:8000/docs
- **GitHub**: [Repository URL]
- **Demo Patient**: John Martinez (67M, Type 2 Diabetes)
- **Contact**: [Your email]

---

**Last Updated**: 11 May 2026  
**Version**: 1.0.0 - Hackathon Submission Ready
