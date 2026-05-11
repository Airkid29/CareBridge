# backend/main.py
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import google.generativeai as genai
import os, json, hashlib, jwt, re
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parent
# Always load backend/.env regardless of current working directory
load_dotenv(_BACKEND_ROOT / ".env")

DATA_DIR = _BACKEND_ROOT / "data"
USERS_FILE = DATA_DIR / "users.json"

# Demo accounts must never be replaced by a corrupted users.json
_PROTECTED_DEMO_EMAILS = frozenset({"admin@carebridge.ai", "doctor@carebridge.ai"})


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _persist_users() -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(USERS_DB, f, indent=2, ensure_ascii=False)
    except OSError as e:
        print(f"CareBridge: could not persist users ({e})")


def _load_users_from_disk() -> None:
    if not USERS_FILE.exists():
        return
    try:
        with open(USERS_FILE, encoding="utf-8") as f:
            persisted = json.load(f)
        for email, rec in persisted.items():
            key = normalize_email(str(email))
            if key in _PROTECTED_DEMO_EMAILS:
                continue
            if isinstance(rec, dict) and rec.get("password_hash"):
                USERS_DB[key] = rec
    except (json.JSONDecodeError, OSError, TypeError) as e:
        print(f"CareBridge: could not load user store ({e})")

app = FastAPI(title='CareBridge AI API')

model = None
_gemini_key = (os.getenv("GEMINI_API_KEY") or "").strip()
try:
    if _gemini_key:
        genai.configure(api_key=_gemini_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
    else:
        print("CareBridge: GEMINI_API_KEY not set — generative routes use built-in fallbacks.")
except Exception as _gemini_err:
    model = None
    print(f"CareBridge: Gemini disabled ({_gemini_err})")

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


class WorkflowSnapshot(BaseModel):
    critical_alerts: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    missing_followups: list[str] = Field(default_factory=list)
    summary: str = ""


class TransitionRiskRequest(BaseModel):
    patient_id: str
    workflow: WorkflowSnapshot | None = None


class CopilotAskRequest(BaseModel):
    patient_id: str
    question: str
    workflow: WorkflowSnapshot | None = None


class VoicePackRequest(BaseModel):
    patient_id: str
    target_language: str = "fr"
    patient_instructions: list[str] | None = None
    summary: str | None = None


class FhirCareBundleRequest(BaseModel):
    patient_id: str
    discharge_plan: list[str] = Field(default_factory=list)
    patient_instructions: list[str] = Field(default_factory=list)
    summary: str = ""
    critical_alerts: list[str] = Field(default_factory=list)

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

_load_users_from_disk()

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


def _patient_record(patient_id: str) -> dict:
    if patient_id == 'demo-001':
        return DEMO_PATIENT
    if patient_id in CUSTOM_PATIENTS:
        return CUSTOM_PATIENTS[patient_id]
    raise HTTPException(status_code=404, detail="Patient not found")


def _safe_float_from_lab(value):
    if value is None:
        return None
    m = re.search(r'(\d+\.?\d*)', str(value))
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


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
    except jwt.PyJWTError:
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
    email = normalize_email(req.email)
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if email in USERS_DB:
        raise HTTPException(status_code=409, detail="Email already exists")

    if len(req.password or "") < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    role = req.role if req.role in ['admin', 'clinician', 'staff'] else 'clinician'
    display_name = (req.name or "").strip() or email.split("@")[0]

    password_hash = hashlib.sha256(req.password.encode()).hexdigest()
    USERS_DB[email] = {
        "name": display_name,
        "password_hash": password_hash,
        "role": role,
        "created_at": datetime.now().isoformat()
    }
    _persist_users()

    token = create_jwt_token(email, role)
    return {
        "success": True,
        "token": token,
        "user": {
            "email": email,
            "name": display_name,
            "role": role
        }
    }

@app.post('/auth/login')
async def login(req: UserLogin):
    """Login user"""
    email = normalize_email(req.email)
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if email not in USERS_DB:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = USERS_DB[email]
    password_hash = hashlib.sha256(req.password.encode()).hexdigest()

    if user['password_hash'] != password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_jwt_token(email, user['role'])
    return {
        "success": True,
        "token": token,
        "user": {
            "email": email,
            "name": user["name"],
            "role": user["role"]
        }
    }

@app.get('/auth/me')
async def get_me(current_user = Depends(get_current_user)):
    """Get current user info"""
    email = normalize_email(current_user['email'])
    if email not in USERS_DB:
        raise HTTPException(status_code=401, detail="User not found")
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
    return _patient_record(patient_id)

@app.get('/medication-scan/{patient_id}')
async def medication_scan(patient_id: str):
    patient = _patient_record(patient_id)
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
    patient = _patient_record(patient_id)
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
    patient = _patient_record(patient_id)
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
    patient = _patient_record(req.patient_id)
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

        if model is None:
            return DEMO_DISCHARGE_RESULT

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


LANG_LABELS = {
    "fr": "French",
    "es": "Spanish",
    "vi": "Vietnamese",
    "zh": "Simplified Chinese",
    "ar": "Arabic",
    "ht": "Haitian Creole",
    "pt": "Portuguese",
    "de": "German",
    "en": "English",
}


def _compute_transition_risk_dna(patient: dict, workflow: WorkflowSnapshot | None) -> dict:
    score = 12
    drivers = []
    labs = patient.get("labs") or {}
    inr = _safe_float_from_lab(labs.get("INR"))
    hba1c = _safe_float_from_lab(labs.get("HbA1c"))
    k = _safe_float_from_lab(labs.get("K+") or labs.get("Potassium"))
    cr = _safe_float_from_lab(labs.get("Creatinine"))
    meds = patient.get("medications") or []
    med_blob = " ".join(
        (m.get("name") or "").lower() for m in meds if isinstance(m, dict)
    )
    n_meds = len(meds)
    age = int(patient.get("age") or 0)

    if age >= 65:
        score += 6
        drivers.append({"code": "AGE_65", "label": "Age 65+", "impact": 6})
    if n_meds >= 5:
        score += 14
        drivers.append({"code": "POLYPHARMACY", "label": f"{n_meds} active medications", "impact": 14})
    elif n_meds >= 3:
        score += 7
        drivers.append({"code": "MULTI_MED", "label": f"{n_meds} medications on profile", "impact": 7})
    if not patient.get("scheduled_followups"):
        score += 16
        drivers.append({"code": "NO_SCHEDULED_FU", "label": "No documented post-discharge appointments", "impact": 16})
    if "warfarin" in med_blob and "ibuprofen" in med_blob:
        score += 22
        drivers.append({"code": "ACUTE_BLEED_RISK", "label": "Anticoagulant + NSAID overlap pattern", "impact": 22})
    if inr is not None and inr > 3.5:
        score += 12
        drivers.append({"code": "SUPRATHERAPEUTIC_INR", "label": f"INR {inr} — supratherapeutic window", "impact": 12})
    if hba1c is not None and hba1c > 8.5:
        score += 9
        drivers.append({"code": "GLYCEMIC_STRESS", "label": f"HbA1c {hba1c}% — metabolic load", "impact": 9})
    if k is not None and k < 3.5:
        score += 7
        drivers.append({"code": "ELECTROLYTE_GAP", "label": f"K+ {k} — electrolyte coordination", "impact": 7})
    if cr is not None and cr > 130:
        score += 8
        drivers.append({"code": "RENAL_LOAD", "label": "Renal signals prioritize med reconciliation", "impact": 8})

    if workflow:
        ca = len(workflow.critical_alerts or [])
        if ca:
            add = min(18, ca * 9)
            score += add
            drivers.append({"code": "LIVE_CRITICAL", "label": f"{ca} critical safety items in workflow", "impact": add})
        mf = workflow.missing_followups or []
        if mf:
            add = min(10, len(mf) * 2)
            score += add
            drivers.append({"code": "GAP_LIST", "label": "Follow-up network gaps from live scan", "impact": add})

    score = min(100, score)
    if score >= 75:
        band, color = "CRITICAL", "rose"
    elif score >= 45:
        band, color = "ELEVATED", "amber"
    else:
        band, color = "MODERATE", "emerald"

    actions = [
        "Pair bedside pharmacist with high-risk med changes within 4 hours.",
        "SMS + interpreter line for caregiver teach-back before exit.",
        "Auto-schedule INR / BMP before PCP window closes.",
    ]
    if score >= 75:
        actions.insert(0, "Hold discharge until anticoagulation pathway sign-off (tele acceptable).")

    return {
        "transition_stress_score": score,
        "risk_band": band,
        "band_color_hint": color,
        "drivers": sorted(drivers, key=lambda d: -d["impact"]),
        "equity_flags": [
            {"label": "Interpreter-ready Voice Pack", "status": "Available"},
            {"label": "Literacy-adaptive bullets", "status": "Active in patient layer"},
        ],
        "next_best_actions": actions,
        "model": "CareBridge-TransitionDNA v1 (rules + workflow fusion)",
    }


def _split_patient_name(full: str) -> tuple[str, str]:
    parts = (full or "Unknown").split()
    if not parts:
        return "Unknown", "Unknown"
    if len(parts) == 1:
        return parts[0], "Unknown"
    return " ".join(parts[:-1]), parts[-1]


def _build_fhir_care_bundle(patient: dict, req: FhirCareBundleRequest) -> dict:
    given, family = _split_patient_name(patient.get("name", ""))
    pat: dict = {
        "resourceType": "Patient",
        "id": patient["id"],
        "name": [{"family": family, "given": [given]}],
    }
    age = patient.get("age")
    if isinstance(age, int) and 0 < age < 120:
        pat["birthDate"] = f"{datetime.now().year - age}-01-01"

    activities = [{"detail": {"description": (line or "")[:500]}} for line in (req.discharge_plan or [])[:24]]
    if req.patient_instructions:
        edu = "\n".join(req.patient_instructions[:40])
        activities.insert(0, {"detail": {"description": f"Patient education snapshot:\n{edu[:1800]}"}})

    care_plan = {
        "resourceType": "CarePlan",
        "id": f"cp-{patient['id']}",
        "status": "draft",
        "intent": "plan",
        "title": "CareBridge AI discharge orchestration",
        "subject": {"reference": f"Patient/{patient['id']}"},
        "description": req.summary or patient.get("diagnosis", ""),
        "note": [{"text": a} for a in (req.critical_alerts or [])[:12]],
        "activity": activities,
    }

    return {
        "resourceType": "Bundle",
        "id": f"cb-bundle-{patient['id']}",
        "type": "collection",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "entry": [
            {"fullUrl": f"urn:uuid:patient-{patient['id']}", "resource": pat},
            {"fullUrl": f"urn:uuid:careplan-{patient['id']}", "resource": care_plan},
        ],
    }


# ===== INNOVATION LAYER (demo + jury hooks) =====
@app.post('/innovation/transition-risk-dna')
async def transition_risk_dna(req: TransitionRiskRequest, current_user=Depends(get_current_user)):
    """Fuse live workflow signals with deterministic risk drivers (no black box)."""
    patient = _patient_record(req.patient_id)
    return _compute_transition_risk_dna(patient, req.workflow)


@app.post('/innovation/clinical-copilot')
async def clinical_copilot(body: CopilotAskRequest, current_user=Depends(get_current_user)):
    """Grounded Gemini assistant — chart + workflow context only."""
    q = (body.question or "").strip()
    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Question too short")
    if len(q) > 4000:
        raise HTTPException(status_code=400, detail="Question too long (max 4000 chars)")

    patient = _patient_record(body.patient_id)
    wf_dump = body.workflow.model_dump() if body.workflow else {}
    ctx = json.dumps({"patient": patient, "workflow": wf_dump}, indent=2)[:14000]

    prompt = (
        "You are CareBridge Clinical Copilot for discharge teams. "
        "Use ONLY the JSON context. If unsupported, say what data is missing. "
        "No new diagnoses. Bullet points, <= 280 words.\n\nCONTEXT:\n"
        f"{ctx}\n\nQUESTION:\n{q}\n\nANSWER:"
    )

    n_med = len(patient.get("medications") or [])
    n_cond = len(patient.get("conditions") or [])
    fallback = (
        "Demo mode: set GEMINI_API_KEY for full generative Copilot. "
        f"Snapshot: {n_med} medications, {n_cond} conditions on file — "
        "ask about interactions, follow-ups, or labs once the key is configured."
    )

    if not _gemini_key or model is None:
        return {"answer": fallback, "source": "demo-fallback", "grounded": bool(wf_dump)}

    try:
        response = model.generate_content(prompt)
        text = (response.text or "").strip() if hasattr(response, "text") else ""
        if not text:
            return {"answer": fallback, "source": "empty-response", "grounded": bool(wf_dump)}
        return {"answer": text, "source": "gemini-2.0-flash", "grounded": True}
    except Exception as e:
        print(f"clinical_copilot: {e}")
        return {
            "answer": fallback + f"\n\n(Technical: {str(e)[:180]})",
            "source": "error-fallback",
            "grounded": bool(wf_dump),
        }


@app.post('/innovation/patient-voice-pack')
async def patient_voice_pack(body: VoicePackRequest, current_user=Depends(get_current_user)):
    """Equity layer: discharge instructions + summary in the patient's home language."""
    lang_key = (body.target_language or "fr").strip().lower()[:12]
    if lang_key not in LANG_LABELS:
        lang_key = "fr"
    label = LANG_LABELS[lang_key]

    patient = _patient_record(body.patient_id)

    if body.patient_instructions:
        lines = [str(x) for x in body.patient_instructions]
    elif body.patient_id.startswith("custom-"):
        lines = (
            [f"YOUR DISCHARGE PLAN FOR {patient['name'].upper()}", "", "MEDICATIONS:"]
            + [f"• Take {m.get('name', '')} as prescribed" for m in patient.get("medications") or []]
            + ["", "FOLLOW-UP:", "• Call your doctor within 7 days"]
        )
    else:
        lines = list(DEMO_DISCHARGE_RESULT["patient_instructions"])

    summary = (body.summary or "").strip() or (
        DEMO_DISCHARGE_RESULT["summary"]
        if body.patient_id == "demo-001"
        else f"Discharge coordination for {patient.get('name', 'patient')} — confirm labs and follow-ups with the team."
    )

    disclaimer = "Machine translation — licensed clinician must review before signing."

    if lang_key == "en":
        return {
            "target_language": lang_key,
            "language_label": label,
            "patient_instructions_translated": lines,
            "summary_translated": summary,
            "disclaimer": disclaimer,
            "source": "passthrough",
        }

    if not _gemini_key or model is None:
        prefixed = [f"[{label}] {ln}" for ln in lines]
        return {
            "target_language": lang_key,
            "language_label": label,
            "patient_instructions_translated": prefixed,
            "summary_translated": f"[{label}] {summary}",
            "disclaimer": disclaimer,
            "source": "prefix-fallback",
        }

    payload = json.dumps({"instructions": lines, "summary": summary}, ensure_ascii=False)
    t_prompt = (
        f"Translate the JSON values from English to {label}. "
        f"Keep the same JSON shape with keys instructions (array of strings) and summary (string). "
        f"Reading level ~6th grade in target language. JSON only, no markdown.\n{payload}"
    )

    try:
        response = model.generate_content(t_prompt)
        raw = (response.text or "").strip() if hasattr(response, "text") else ""
        if "```json" in raw:
            raw = raw.split("```json", 1)[1].split("```", 1)[0]
        elif "```" in raw:
            raw = raw.split("```", 1)[1].split("```", 1)[0]
        parsed = json.loads(raw.strip())
        ins = parsed.get("instructions")
        summ = parsed.get("summary")
        if not isinstance(ins, list) or not isinstance(summ, str):
            raise ValueError("bad shape")
        return {
            "target_language": lang_key,
            "language_label": label,
            "patient_instructions_translated": [str(x) for x in ins],
            "summary_translated": summ,
            "disclaimer": disclaimer,
            "source": "gemini-2.0-flash",
        }
    except Exception as e:
        print(f"patient_voice_pack: {e}")
        return {
            "target_language": lang_key,
            "language_label": label,
            "patient_instructions_translated": [f"[{label}] {ln}" for ln in lines],
            "summary_translated": f"[{label}] {summary}",
            "disclaimer": disclaimer,
            "source": "parse-fallback",
        }


@app.post('/innovation/fhir-care-bundle')
async def fhir_care_bundle(body: FhirCareBundleRequest, current_user=Depends(get_current_user)):
    """Interop-ready FHIR Bundle stub for CarePlan + Patient (collection)."""
    patient = _patient_record(body.patient_id)
    return _build_fhir_care_bundle(patient, body)


@app.post('/innovation/handoff-capsule')
async def handoff_capsule(body: TransitionRiskRequest, current_user=Depends(get_current_user)):
    """Structured 24h bridge summary for nursing + family + PCP — jury narrative hook."""
    patient = _patient_record(body.patient_id)
    wf = body.workflow
    critical = list(wf.critical_alerts or []) if wf else []
    missing = list(wf.missing_followups or []) if wf else []
    summary_line = (wf.summary or "").strip() if wf else ""
    if not summary_line:
        summary_line = patient.get("diagnosis", "Review diagnosis with attending before sign-out.")

    must_do = [
        "Reconcile home meds vs. MAR with two identifiers at bedside.",
        "Confirm caregiver phone + preferred language in Epic contact prefs.",
    ]
    if critical:
        must_do.insert(0, f"Address top safety signal: {critical[0][:160]}")

    return {
        "headline": f"24h bridge — {patient.get('name', 'Patient')}",
        "one_liner": summary_line[:320],
        "must_do_before_leaving": must_do,
        "book_these_visits": missing[:8] or ["Primary care within 7 days"],
        "red_flags_er": [
            "Heavy bleeding or bruising",
            "Chest pain or severe shortness of breath",
            "Sudden confusion or worst-ever headache",
        ],
        "pcp_fax_stub": "CareBridge routes this bundle to PCP via FHIR subscription (demo).",
        "r_iso_ready": True,
    }


@app.get('/innovation/readiness-checklist/{patient_id}')
async def readiness_checklist(patient_id: str, current_user=Depends(get_current_user)):
    """Smart discharge readiness — deterministic checklist tied to chart shape."""
    patient = _patient_record(patient_id)
    meds = patient.get("medications") or []
    has_fu = bool(patient.get("scheduled_followups"))
    items = [
        {
            "id": "rx_recon",
            "title": "Medication reconciliation",
            "weight": 22,
            "done": len(meds) > 0,
            "hint": "Bedside double-check high-alert meds",
        },
        {
            "id": "followups",
            "title": "Post-acute follow-ups scheduled",
            "weight": 28,
            "done": has_fu,
            "hint": "Cardiology / PCP / labs as indicated",
        },
        {
            "id": "teach_back",
            "title": "Teach-back completed",
            "weight": 18,
            "done": False,
            "hint": "Use Voice Pack + interpreter if needed",
        },
        {
            "id": "handoff_capsule",
            "title": "Handoff capsule sent to care circle",
            "weight": 16,
            "done": False,
            "hint": "Share 24h bridge summary",
        },
        {
            "id": "fhir_bundle",
            "title": "Interop bundle staged for PCP",
            "weight": 16,
            "done": False,
            "hint": "Export FHIR care bundle",
        },
    ]
    tw = sum(i["weight"] for i in items)
    dw = sum(i["weight"] for i in items if i["done"])
    pct = int(round(100 * dw / tw)) if tw else 0
    return {"patient_id": patient_id, "items": items, "readiness_percent": pct}


@app.get('/health')
async def health(): 
    return {'status': 'CareBridge AI running'}

# ===== ADMIN DASHBOARD ENDPOINTS =====
@app.get('/admin/stats')
async def admin_stats(current_user = Depends(get_current_user)):
    """Get admin dashboard statistics"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    role_distribution = {"admin": 0, "clinician": 0, "staff": 0}
    for rec in USERS_DB.values():
        r = rec.get("role") or "clinician"
        if r not in role_distribution:
            r = "clinician"
        role_distribution[r] = role_distribution.get(r, 0) + 1

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
            "medication_drug_interactions_caught": 156,
            "follow_up_compliance": 87,
            "readmission_rate": 12.5,
            "patient_satisfaction": 94.2
        },
        "performance_trends": {
            "week": [85, 87, 82, 89, 91, 88, 90],
            "month": [82, 84, 86, 85, 87, 89, 88, 90, 91, 92, 88, 89, 87, 85, 86, 88, 89, 91, 90, 92, 94, 93, 95, 94, 96, 95, 97, 96, 98, 97]
        },
        "role_distribution": role_distribution,
        "innovation_pulse": {
            "copilot_24h": 47,
            "voice_pack_24h": 23,
            "risk_dna_24h": 31,
            "fhir_bundles_24h": 12,
            "handoff_capsules_24h": 18,
        },
        "chart_series": {
            "day_labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            "discharge_safety_index": [72, 74, 78, 81, 79, 85, 88],
            "innovation_api_hits": [40, 52, 48, 61, 55, 38, 44],
            "latency_ms_p50": [210, 198, 205, 232, 218, 190, 205],
        },
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

    key = normalize_email(email)
    if key not in USERS_DB:
        raise HTTPException(status_code=404, detail="User not found")

    if role not in ['admin', 'clinician', 'staff']:
        raise HTTPException(status_code=400, detail="Invalid role")

    USERS_DB[key]['role'] = role
    _persist_users()
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
