# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
import os, json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title='CareBridge AI API')
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
model = genai.GenerativeModel('gemini-2.0-flash')

app.add_middleware(CORSMiddleware, allow_origins=['*'],
    allow_methods=['*'], allow_headers=['*'])

class DischargeRequest(BaseModel):
    patient_id: str

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

@app.get('/patient/{patient_id}')
async def get_patient(patient_id: str):
    return DEMO_PATIENT

# Mock response for demo purposes
DEMO_DISCHARGE_RESULT = {
    "critical_alerts": [
        "🚨 CRITICAL - Warfarin + Ibuprofen: Ibuprofen significantly increases bleeding risk with Warfarin. This combination is contraindicated. RECOMMEND: Replace Ibuprofen with Acetaminophen 650mg TID as needed for pain.",
        "🚨 CRITICAL - INR elevated at 3.8 (target 2.0-3.0): Patient is over-anticoagulated. RECOMMEND: Reduce Warfarin to 4mg daily, recheck INR in 48 hours. Hold Ibuprofen immediately."
    ],
    "warnings": [
        "⚠️ HbA1c 9.2% - Diabetes poorly controlled. Patient needs endocrinology follow-up within 14 days.",
        "⚠️ Potassium 3.2 (low) - Monitor for hypokalemia with Furosemide. Recheck in 7 days.",
        "⚠️ Creatinine 168 (elevated) - CKD Stage 3. Adjust medication doses based on renal function.",
        "⚠️ No follow-up appointments scheduled for high-risk discharge patient."
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
        "   - Diabetic diet with CHO counting"
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
        "• Take Warfarin at the same time each day",
        "• Take Lisinopril with breakfast",
        "• Take Furosemide with breakfast",
        "• Check your blood sugar daily",
        "",
        "FOOD & ACTIVITY:",
        "• Eat a low-salt diet (reduce salt shaker use)",
        "• Avoid heavy lifting for one week",
        "• Get light walking activity daily",
        "• Don't make big changes to vegetables (affects Warfarin)"
    ],
    "summary": "Patient John Martinez, 67M with poorly-controlled Type 2 Diabetes complicated by Afib and CKD. Critical issue: Dangerous drug interaction Warfarin + Ibuprofen detected and corrected. INR over-anticoagulated - dose reduced. Multiple high-risk gaps identified: no specialist follow-ups scheduled. All issues addressed in discharge plan with clear patient education."
}
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
    "missing_followups": [list of required follow-up appointments based on diagnosis],
    "discharge_plan": [structured clinical recommendations],
    "patient_instructions": [same information in simple, plain language for patient understanding],
    "summary": [brief summary of key actions]
}}

Be specific. Cite actual medication names, lab values, and interaction mechanisms.
Focus especially on the Warfarin-Ibuprofen interaction and abnormal labs.
Return ONLY valid JSON, no additional text.'''
    
    try:
        response = model.generate_content(prompt)
        # Extract JSON from response
        response_text = response.text
        # Clean up markdown code blocks if present
        if '```json' in response_text:
            response_text = response_text.split('```json')[1].split('```')[0]
        elif '```' in response_text:
            response_text = response_text.split('```')[1].split('```')[0]
        
        result = json.loads(response_text.strip())
        return result
    except json.JSONDecodeError as e:
        return {
            "error": "Failed to parse model response",
            "raw_response": response.text
        }
    except Exception as e:
        return {
            "error": str(e),
            "details": "Error calling Gemini API"
        }

@app.get('/health')
async def health(): 
    return {'status': 'CareBridge AI running'}