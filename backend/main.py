# backend/main.py
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from anthropic import Anthropic
import google.generativeai as genai
import os, json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title='CareBridge AI API')
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
model = genai.GenerativeModel('gemini-2.0-flash')

# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'carebridge-super-secret-key-2026')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

app.add_middleware(CORSMiddleware, allow_origins=['*'],
    allow_methods=['*'], allow_headers=['*'])

# ===== DATA MODELS =====
class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    role: str = "clinician"

class UserLogin(BaseModel):
    email: str
    password: str

class DischargeRequest(BaseModel):
    patient_id: str

class PatientCreateRequest(BaseModel):
    name: str
    age: int
    conditions: list[str]
    medications: list[str]
    allergies: list[str] = []
    notes: str = ""

# ===== IN-MEMORY DATA STORAGE =====
# Users database
USERS_DB = {
    "admin@carebridge.ai": {
        "name": "Dr. Sarah Mitchell",
        "password_hash": hashlib.sha256("admin123".encode()).hexdigest(),
        "role": "admin",
        "created_at": datetime.now().isoformat()
    },
    "doctor@carebridge.ai": {
        "name": "Dr. James Chen",
        "password_hash": hashlib.sha256("doctor123".encode()).hexdigest(),
        "role": "clinician",
        "created_at": datetime.now().isoformat()
    }
}

# Active sessions
SESSIONS = {}

# Données patient de démo (John Martinez)
DEMO_PATIENT = {
    'id': 'demo-001', 'name': 'John Martinez', 'age': 67,
    'diagnosis': 'Type 2 Diabetes — poorly controlled',
    'conditions': ['Hypertension', 'Atrial Fibrillation', 'CKD Stage 3'],
    'allergies': ['Penicillin (urticaria)', 'Sulfonamides (anaphylaxis)'],
    'medications': [
        {'name': 'Warfarin', 'dose': '5mg', 'frequency': 'daily'},
        {'name': 'Metformin', 'dose': '1000mg', 'frequency': 'twice daily'},
        {'name': 'Lisinopril', 'dose': '10mg', 'frequency': 'daily'},
        {'name': 'Ibuprofen', 'dose': '400mg', 'frequency': 'PRN'},  # CONFLICT
        {'name': 'Furosemide', 'dose': '40mg', 'frequency': 'daily'},
    ],
    'labs': {'HbA1c': '9.2%', 'INR': '3.8', 'Creatinine': '168', 'K+': '3.2'},
    'scheduled_followups': []  # Intentionally empty to trigger alert
}

# Stockage en mémoire pour les patients personnalisés
CUSTOM_PATIENTS = {}

# ===== AUTHENTICATION FUNCTIONS =====
def create_jwt_token(email: str, role: str):
    """Create JWT token for user session"""
    payload = {
        'email': email,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token

def verify_jwt_token(token: str):
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    payload = verify_jwt_token(token)
    return payload

# ===== AUTHENTICATION ENDPOINTS =====
@app.post('/auth/register')
async def register(req: UserRegister):
    """Register new user"""
    if req.email in USERS_DB:
        raise HTTPException(status_code=409, detail="Email already exists")
    
    if req.role not in ['admin', 'clinician', 'staff']:
        req.role = 'clinician'
    
    password_hash = hashlib.sha256(req.password.encode()).hexdigest()
    USERS_DB[req.email] = {
        "name": req.name,
        "password_hash": password_hash,
        "role": req.role,
        "created_at": datetime.now().isoformat()
    }
    
    token = create_jwt_token(req.email, req.role)
    return {
        "success": True,
        "token": token,
        "user": {
            "email": req.email,
            "name": req.name,
            "role": req.role
        }
    }

@app.post('/auth/login')
async def login(req: UserLogin):
    """Login user"""
    if req.email not in USERS_DB:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = USERS_DB[req.email]
    password_hash = hashlib.sha256(req.password.encode()).hexdigest()
    
    if user['password_hash'] != password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(req.email, user['role'])
    return {
        "success": True,
        "token": token,
        "user": {
            "email": req.email,
            "name": user["name"],
            "role": user["role"]
        }
    }

@app.get('/auth/me')
async def get_me(current_user = Depends(get_current_user)):
    """Get current user info"""
    email = current_user['email']
    user = USERS_DB[email]
    return {
        "email": email,
        "name": user["name"],
        "role": current_user["role"]
    }

# Mock response for demo purposes
DEMO_DISCHARGE_RESULT = {
    "critical_alerts": [
        "🚨 CRITICAL - Warfarin + Ibuprofen: Ibuprofen significantly increases bleeding risk with Warfarin. This combination is contraindicated. RECOMMEND: Replace Ibuprofen with Acetaminophen 650mg as needed for pain.",
        "🚨 CRITICAL - INR elevated at 3.8 (target 2.0-3.0): Patient is over-anticoagulated. RECOMMEND: Reduce Warfarin to 4mg daily, recheck INR in 48 hours. Hold Ibuprofen immediately."
    ],
    "warnings": [
        "⚠️ HbA1c 9.2% - Diabetes poorly controlled. Patient needs endocrinology follow-up within 14 days.",
        "⚠️ Potassium 3.2 (low) - Monitor for hypokalemia with Furosemide. Recheck in 7 days.",
        "⚠️ Creatinine 168 (elevated) - CKD Stage 3. Adjust medication doses based on renal function.",
        "⚠️ No follow-up appointments scheduled for high-risk discharge patient."
    ],
    "critical_alerts": [
        "🚨 CRITICAL - Warfarin + Ibuprofen: Ibuprofen significantly increases bleeding risk with Warfarin. This combination is contraindicated. RECOMMEND: Replace Ibuprofen with Acetaminophen 650mg as needed for pain.",
        "🚨 CRITICAL - INR elevated at 3.8 (target 2.0-3.0): Patient is over-anticoagulated. RECOMMEND: Reduce Warfarin to 4mg daily, recheck INR in 48 hours. Hold Ibuprofen immediately."
    ],
    "warnings": [
        "⚠️ HbA1c 9.2% - Diabetes poorly controlled. Patient needs endocrinology follow-up within 14 days.",
        "⚠️ Potassium 3.2 (low) - Monitor for hypokalemia with Furosemide. Recheck in 7 days.",
        "⚠️ Creatinine 168 (elevated) - CKD Stage 3. Adjust medication doses based on renal function.",
        "⚠️ No follow-up appointments scheduled for high-risk discharge patient."
    ],
    "missing_followups": [
        "Cardiology within 21 days",
        "Endocrinology within 14 days",
        "Primary care within 7 days",
        "INR recheck in 48 hours",
        "Basic metabolic panel in 7 days"
    ],
    "discharge_plan": [
        "1. Medication Changes at Discharge:",
        "   - STOP Ibuprofen immediately",
        "   - Change Warfarin to 4mg daily (reduced from 5mg)",
        "   - Continue Metformin 1000mg BID",
        "   - Continue Lisinopril 10mg daily",
        "   - Continue Furosemide 40mg daily",
        "",
        "2. Follow-up Appointments (URGENT - Schedule before discharge):",
        "   - Cardiology: within 21 days (Afib, INR management)",
        "   - Endocrinology: within 14 days (HbA1c 9.2%)",
        "   - Primary Care: within 7 days",
        "   - Lab work: INR recheck in 48 hours, Basic metabolic panel in 7 days",
        "",
        "3. Activity Restrictions:",
        "   - Avoid strenuous activity for 1 week",
        "   - No heavy lifting >10 lbs",
        "   - Resume normal activities gradually",
        "",
        "4. Diet:",
        "   - Low sodium diet (<2g daily)",
        "   - Consistent vitamin K intake (affects Warfarin)",
        "   - Diabetic diet with carbohydrate counting"
    ],
    "patient_instructions": [
        "YOUR DISCHARGE PLAN (In Simple Language)",
        "",
        "IMPORTANT MEDICATION CHANGES:",
        "• STOP taking Ibuprofen right away - it can cause serious bleeding with your blood thinner",
        "• If you have pain, take Tylenol (Acetaminophen) instead",
        "• Your Warfarin dose is being LOWERED from 5mg to 4mg daily",
        "• Keep taking your other medications the same way",
        "",
        "WHEN TO SCHEDULE APPOINTMENTS:",
        "• Call your heart doctor (Cardiology) - need to see them within 21 days",
        "• Call your diabetes doctor (Endocrinology) - need to see them within 14 days",
        "• Call your regular doctor - need to see them within 7 days",
        "• Get blood work done in 2 days to check INR level",
        "",
        "RED FLAGS - GO TO ER IF YOU HAVE:",
        "• Heavy bleeding or bruising",
        "• Blood in urine or stool",
        "• Vomiting blood",
        "• Severe shortness of breath",
        "• Chest pain",
        "• Confusion or severe headache",
        "",
        "DAILY ROUTINE:",
        "• Take Metformin with dinner",
        "• Take Warfarin at the same time each day (morning or evening - pick one and stick with it)",
        "• Take Lisinopril with breakfast",
        "• Take Furosemide with breakfast",
        "• Check your blood sugar daily if you have a meter"
    ],
    "summary": "Patient John Martinez, 67M with poorly-controlled Type 2 Diabetes complicated by Afib and CKD. Critical issue: Dangerous drug interaction Warfarin + Ibuprofen detected and corrected. INR over-anticoagulated - dose reduced. Multiple high-risk gaps identified: no specialist follow-ups scheduled. All issues addressed in discharge plan with clear patient education."
}

@app.get('/patient/{patient_id}')
async def get_patient(patient_id: str):
    return DEMO_PATIENT

@app.get('/medication-scan/{patient_id}')
async def medication_scan(patient_id: str):
    return {
        'critical_alerts': DEMO_DISCHARGE_RESULT['critical_alerts'],
        'warnings': DEMO_DISCHARGE_RESULT['warnings'],
        'summary': 'Medication safety scan completed. Two critical issues detected on the current regimen.'
    }

@app.get('/followup-review/{patient_id}')
async def followup_review(patient_id: str):
    return {
        'missing_followups': DEMO_DISCHARGE_RESULT['missing_followups'],
        'followup_summary': 'High-risk patient has no scheduled follow-up appointments. Several time-sensitive referrals are required.'
    }

@app.get('/translate-instructions/{patient_id}')
async def translate_instructions(patient_id: str):
    return {
        'patient_instructions': DEMO_DISCHARGE_RESULT['patient_instructions']
    }

@app.post('/generate-discharge')
async def generate_discharge(req: DischargeRequest):
    patient = DEMO_PATIENT
    prompt = f'''You are CareBridge AI, a clinical discharge planning assistant working for a top-tier healthcare system.

PATIENT DATA:
{json.dumps(patient, indent=2)}

YOUR TASK:
Analyze this patient comprehensively. Identify ALL medication safety issues, missing follow-ups, and create a discharge plan.

CRITICAL: Return a valid JSON object with these exact fields:
{{
    "critical_alerts": [list of urgent medication/safety issues with specific medication names],
    "warnings": [list of non-critical concerns],
    "discharge_plan": [structured clinical recommendations],
    "patient_instructions": [same information in simple, plain language for patient understanding],
    "summary": [brief summary of key actions]
}}

Be specific. Cite actual medication names, lab values, and interaction mechanisms.
Focus especially on the Warfarin-Ibuprofen interaction and abnormal labs.
Return ONLY valid JSON, no additional text.'''
    
    try:
        response = model.generate_content(prompt)
        response_text = response.text if hasattr(response, 'text') else ''

        if '```json' in response_text:
            response_text = response_text.split('```json', 1)[1].split('```', 1)[0]
        elif '```' in response_text:
            response_text = response_text.split('```', 1)[1].split('```', 1)[0]

        result = json.loads(response_text.strip())
        return result
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}, using demo response")
        return DEMO_DISCHARGE_RESULT
    except Exception as e:
        print(f"Gemini API error: {str(e)}")
        print("Using demo response for demonstration")
        return DEMO_DISCHARGE_RESULT

@app.post('/patients')
async def create_patient(req: PatientCreateRequest):
    patient_id = f"custom-{len(CUSTOM_PATIENTS) + 1}"
    patient_data = {
        'id': patient_id,
        'name': req.name,
        'age': req.age,
        'diagnosis': f'Custom patient - {", ".join(req.conditions[:2])}',
        'conditions': req.conditions,
        'allergies': req.allergies,
        'medications': [{'name': med, 'dose': 'Unknown', 'frequency': 'Unknown'} for med in req.medications],
        'labs': {},
        'scheduled_followups': [],
        'notes': req.notes
    }
    CUSTOM_PATIENTS[patient_id] = patient_data
    return patient_data

@app.get('/patients')
async def list_patients():
    all_patients = [DEMO_PATIENT] + list(CUSTOM_PATIENTS.values())
    return all_patients

@app.get('/patient/{patient_id}')
async def get_patient(patient_id: str):
    if patient_id == 'demo-001':
        return DEMO_PATIENT
    elif patient_id in CUSTOM_PATIENTS:
        return CUSTOM_PATIENTS[patient_id]
    else:
        raise HTTPException(status_code=404, detail="Patient not found")

@app.get('/medication-scan/{patient_id}')
async def medication_scan(patient_id: str):
    patient = await get_patient(patient_id)
    # Pour les patients personnalisés, générer des alertes basées sur les données
    if patient_id.startswith('custom-'):
        alerts = []
        warnings = []
        if 'ibuprofen' in [med['name'].lower() for med in patient['medications']]:
            alerts.append("🚨 CRITICAL - Ibuprofen detected: May interact with other medications. Review regimen carefully.")
        if len(patient['medications']) > 3:
            warnings.append("⚠️ Multiple medications: Monitor for potential interactions.")
        return {
            'critical_alerts': alerts,
            'warnings': warnings,
            'summary': f'Medication safety scan completed for {patient["name"]}.'
        }
    else:
        return {
            'critical_alerts': DEMO_DISCHARGE_RESULT['critical_alerts'],
            'warnings': DEMO_DISCHARGE_RESULT['warnings'],
            'summary': 'Medication safety scan completed. Two critical issues detected on the current regimen.'
        }

@app.get('/followup-review/{patient_id}')
async def followup_review(patient_id: str):
    patient = await get_patient(patient_id)
    if patient_id.startswith('custom-'):
        missing = ["Primary care follow-up within 7 days", "Specialist consultation if needed"]
        return {
            'missing_followups': missing,
            'followup_summary': f'Basic follow-up plan recommended for {patient["name"]}.'
        }
    else:
        return {
            'missing_followups': DEMO_DISCHARGE_RESULT['missing_followups'],
            'followup_summary': 'High-risk patient has no scheduled follow-up appointments. Several time-sensitive referrals are required.'
        }

@app.get('/translate-instructions/{patient_id}')
async def translate_instructions(patient_id: str):
    patient = await get_patient(patient_id)
    if patient_id.startswith('custom-'):
        instructions = [
            f"YOUR DISCHARGE PLAN FOR {patient['name'].upper()}",
            "",
            "MEDICATIONS TO TAKE:",
        ] + [f"• {med['name']}" for med in patient['medications']] + [
            "",
            "WHEN TO SEE YOUR DOCTOR:",
            "• Call your regular doctor within 7 days",
            "",
            "CALL YOUR DOCTOR IF:",
            "• You feel worse",
            "• New symptoms appear"
        ]
        return {'patient_instructions': instructions}
    else:
        return {
            'patient_instructions': DEMO_DISCHARGE_RESULT['patient_instructions']
        }

@app.post('/generate-discharge')
async def generate_discharge(req: DischargeRequest):
    patient = await get_patient(req.patient_id)
    if req.patient_id.startswith('custom-'):
        # Pour les patients personnalisés, créer un plan de décharge simple
        result = {
            "critical_alerts": [],
            "warnings": [f"⚠️ New patient {patient['name']} - Review medication regimen carefully."],
            "discharge_plan": [
                f"Discharge plan for {patient['name']}, age {patient['age']}",
                f"Conditions: {', '.join(patient['conditions'])}",
                "Recommendations:",
                "• Continue current medications",
                "• Schedule follow-up appointment",
                "• Monitor for side effects"
            ],
            "patient_instructions": [
                f"YOUR DISCHARGE PLAN FOR {patient['name'].upper()}",
                "",
                "MEDICATIONS:",
            ] + [f"• Take {med['name']} as prescribed" for med in patient['medications']] + [
                "",
                "FOLLOW-UP:",
                "• Call your doctor within 7 days",
                "",
                "WHEN TO CALL YOUR DOCTOR:",
                "• If you feel sick",
                "• If you have questions"
            ],
            "summary": f"Discharge plan created for {patient['name']}. Monitor closely and schedule timely follow-up."
        }
        return result
    else:
        prompt = f'''You are CareBridge AI, a clinical discharge planning assistant working for a top-tier healthcare system.

PATIENT DATA:
{json.dumps(patient, indent=2)}

YOUR TASK:
Analyze this patient comprehensively. Identify ALL medication safety issues, missing follow-ups, and create a discharge plan.

CRITICAL: Return a valid JSON object with these exact fields:
{{
    "critical_alerts": [list of urgent medication/safety issues with specific medication names],
    "warnings": [list of non-critical concerns],
    "discharge_plan": [structured clinical recommendations],
    "patient_instructions": [same information in simple, plain language for patient understanding],
    "summary": [brief summary of key actions]
}}

Be specific. Cite actual medication names, lab values, and interaction mechanisms.
Focus especially on the Warfarin-Ibuprofen interaction and abnormal labs.
Return ONLY valid JSON, no additional text.'''
        
        try:
            response = model.generate_content(prompt)
            response_text = response.text if hasattr(response, 'text') else ''

            if '```json' in response_text:
                response_text = response_text.split('```json', 1)[1].split('```', 1)[0]
            elif '```' in response_text:
                response_text = response_text.split('```', 1)[1].split('```', 1)[0]

            result = json.loads(response_text.strip())
            return result
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}, using demo response")
            return DEMO_DISCHARGE_RESULT
        except Exception as e:
            print(f"Gemini API error: {str(e)}")
            print("Using demo response for demonstration")
            return DEMO_DISCHARGE_RESULT

@app.get('/health')
async def health(): 
    return {'status': 'CareBridge AI running'}

# ===== ADMIN DASHBOARD ENDPOINTS =====
@app.get('/admin/stats')
async def admin_stats(current_user = Depends(get_current_user)):
    """Get admin dashboard statistics"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "total_patients": len(CUSTOM_PATIENTS) + 1,
        "total_users": len(USERS_DB),
        "active_sessions": len(SESSIONS),
        "total_discharges": 42,
        "system_uptime": "99.8%",
        "api_calls_today": 3847,
        "average_response_time": "245ms",
        "patients_by_status": {
            "admitted": 15,
            "in_transition": 8,
            "discharged": 42,
            "readmitted": 3
        },
        "clinical_metrics": {
            "medication_safety_alerts": 23,
            "follow_up_compliance": 87,
            "readmission_rate": 12.5,
            "patient_satisfaction": 94.2
        },
        "performance_trends": {
            "week": [85, 87, 82, 89, 91, 88, 90],
            "month": [82, 84, 86, 85, 87, 89, 88, 90, 91, 92, 88, 89, 87, 85, 86, 88, 89, 91, 90, 92, 94, 93, 95, 94, 96, 95, 97, 96, 98, 97]
        }
    }

@app.get('/admin/users')
async def admin_users(current_user = Depends(get_current_user)):
    """List all users (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users_list = []
    for email, user_data in USERS_DB.items():
        users_list.append({
            "email": email,
            "name": user_data["name"],
            "role": user_data["role"],
            "created_at": user_data["created_at"],
            "status": "active"
        })
    return users_list

@app.get('/admin/audit-log')
async def admin_audit_log(current_user = Depends(get_current_user)):
    """Get system audit log"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return [
        {"timestamp": "2026-05-04 08:45", "user": "doctor@carebridge.ai", "action": "Generated discharge plan", "patient": "John Martinez", "status": "success"},
        {"timestamp": "2026-05-04 08:32", "user": "admin@carebridge.ai", "action": "Created new user", "patient": "N/A", "status": "success"},
        {"timestamp": "2026-05-04 08:15", "user": "doctor@carebridge.ai", "action": "Approved discharge plan", "patient": "Jane Doe", "status": "success"},
        {"timestamp": "2026-05-04 07:58", "user": "doctor@carebridge.ai", "action": "Ran medication safety scan", "patient": "John Martinez", "status": "success"},
        {"timestamp": "2026-05-04 07:42", "user": "admin@carebridge.ai", "action": "System health check", "patient": "N/A", "status": "success"},
        {"timestamp": "2026-05-04 07:30", "user": "doctor@carebridge.ai", "action": "Updated patient record", "patient": "Robert Williams", "status": "success"},
        {"timestamp": "2026-05-04 06:55", "user": "admin@carebridge.ai", "action": "Database backup", "patient": "N/A", "status": "success"},
        {"timestamp": "2026-05-04 06:12", "user": "doctor@carebridge.ai", "action": "Generated discharge plan", "patient": "Mary Johnson", "status": "success"},
    ]

@app.get('/admin/alerts')
async def admin_alerts(current_user = Depends(get_current_user)):
    """Get system alerts and warnings"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "critical": [
            {"timestamp": "2026-05-04 08:10", "message": "API response time exceeding threshold (512ms)", "severity": "critical"},
            {"timestamp": "2026-05-04 07:15", "message": "High medication interaction alert rate detected", "severity": "critical"}
        ],
        "warnings": [
            {"timestamp": "2026-05-04 08:45", "message": "Database query optimization recommended", "severity": "warning"},
            {"timestamp": "2026-05-04 08:30", "message": "3 users without 2FA enabled", "severity": "warning"},
            {"timestamp": "2026-05-04 08:00", "message": "SSL certificate expiring in 30 days", "severity": "warning"}
        ],
        "info": [
            {"timestamp": "2026-05-04 08:50", "message": "Scheduled backup completed successfully", "severity": "info"},
            {"timestamp": "2026-05-04 08:20", "message": "Model update available: Gemini 2.1", "severity": "info"}
        ]
    }

@app.post('/admin/user-role')
async def update_user_role(email: str, role: str, current_user = Depends(get_current_user)):
    """Update user role (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if email not in USERS_DB:
        raise HTTPException(status_code=404, detail="User not found")
    
    if role not in ['admin', 'clinician', 'staff']:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    USERS_DB[email]['role'] = role
    return {"success": True, "message": f"User role updated to {role}"}

@app.get('/admin/reports')
async def admin_reports(current_user = Depends(get_current_user)):
    """Get various admin reports"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "discharge_quality_report": {
            "total_discharges": 42,
            "with_safety_issues_identified": 12,
            "with_follow_up_scheduled": 38,
            "average_plan_quality_score": 8.7,
            "patient_readmission_rate": 12.5
        },
        "clinical_performance": {
            "medication_drug_interactions_caught": 156,
            "follow_up_compliance_rate": 87,
            "average_discharge_time": "2.3 hours",
            "critical_alerts_generated": 23
        },
        "system_reliability": {
            "uptime_percentage": 99.8,
            "api_availability": 99.95,
            "average_response_time_ms": 245,
            "error_rate_percent": 0.05
        },
        "user_activity": {
            "active_clinicians": 12,
            "active_staff": 5,
            "login_attempts_today": 287,
            "failed_logins": 3
        }
    }
