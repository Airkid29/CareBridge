# mcp-server/server.py
import asyncio
import json
import os
import requests
from anthropic import Anthropic
from dotenv import load_dotenv
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

# Load environment variables from .env file
load_dotenv()

# Initialize Claude
client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

# Initialize MCP Server
app = Server('carebridge-mcp')
FHIR_BASE = os.getenv('FHIR_SERVER_URL', 'https://hapi.fhir.org/baseR4')

# Demo patient data
DEMO_PATIENT = {
    'id': 'demo-001',
    'name': 'John Martinez',
    'age': 67,
    'gender': 'Male',
    'diagnosis': 'Type 2 Diabetes - poorly controlled',
    'conditions': ['Hypertension', 'Atrial Fibrillation', 'CKD Stage 3'],
    'allergies': ['Penicillin (urticaria)', 'Sulfonamides (anaphylaxis)'],
    'medications': [
        {'name': 'Warfarin', 'dose': '5mg', 'frequency': 'daily'},
        {'name': 'Metformin', 'dose': '1000mg', 'frequency': 'twice daily'},
        {'name': 'Lisinopril', 'dose': '10mg', 'frequency': 'daily'},
        {'name': 'Ibuprofen', 'dose': '400mg', 'frequency': 'PRN'},
        {'name': 'Furosemide', 'dose': '40mg', 'frequency': 'daily'},
    ],
    'labs': {
        'HbA1c': '9.2%',
        'INR': '3.8',
        'Creatinine': '168 µmol/L',
        'Potassium': '3.2 mEq/L',
        'Fasting_glucose': '14.2 mmol/L'
    },
    'scheduled_followups': []
}


def _extract_json_payload(raw_text: str) -> str:
    text = raw_text.strip()
    if '```json' in text:
        return text.split('```json', 1)[1].split('```', 1)[0].strip()
    if '```' in text:
        return text.split('```', 1)[1].split('```', 1)[0].strip()
    return text


def _call_gemini(prompt: str) -> tuple[str, str]:
    if not os.getenv('GEMINI_API_KEY'):
        raise RuntimeError('GEMINI_API_KEY is missing')
    model = genai.GenerativeModel(GEMINI_MODEL)
    response = model.generate_content(prompt)
    text = response.text if hasattr(response, 'text') else ''
    if not text:
        raise RuntimeError('Gemini returned empty content')
    return _extract_json_payload(text), 'gemini'


def _call_deepseek(prompt: str) -> tuple[str, str]:
    api_key = os.getenv('DEEPSEEK_API_KEY')
    if not api_key:
        raise RuntimeError('DEEPSEEK_API_KEY is missing')

    response = requests.post(
        DEEPSEEK_API_URL,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': DEEPSEEK_MODEL,
            'messages': [{'role': 'user', 'content': prompt}],
            'temperature': 0.2,
            'max_tokens': 1200,
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload['choices'][0]['message']['content']
    if not content:
        raise RuntimeError('DeepSeek returned empty content')
    return _extract_json_payload(content), 'deepseek'


async def _first_provider_response(prompt: str) -> tuple[str, str]:
    tasks = [
        asyncio.create_task(asyncio.to_thread(_call_gemini, prompt)),
        asyncio.create_task(asyncio.to_thread(_call_deepseek, prompt)),
    ]
    errors = []

    try:
        while tasks:
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            tasks = list(pending)

            for finished in done:
                try:
                    return await finished
                except Exception as err:
                    errors.append(str(err))
        raise RuntimeError('All providers failed: ' + ' | '.join(errors))
    finally:
        for task in tasks:
            task.cancel()

@app.list_tools()
async def list_tools():
    return [
        types.Tool(
            name='get_patient_context',
            description='Retrieve complete patient context including demographics, diagnosis, conditions, and allergies',
            inputSchema={
                'type': 'object',
                'properties': {'patient_id': {'type': 'string'}},
                'required': ['patient_id']
            }
        ),
        types.Tool(
            name='get_medications',
            description='Get all active medications for a patient with dosing information',
            inputSchema={
                'type': 'object',
                'properties': {'patient_id': {'type': 'string'}},
                'required': ['patient_id']
            }
        ),
        types.Tool(
            name='check_allergy_conflicts',
            description='Detect medication-allergy conflicts and identify drug-drug interactions',
            inputSchema={
                'type': 'object',
                'properties': {
                    'patient_id': {'type': 'string'},
                    'medications': {'type': 'array'}
                },
                'required': ['patient_id']
            }
        ),
        types.Tool(
            name='get_pending_followups',
            description='Identify missing follow-up appointments based on diagnosis and lab abnormalities',
            inputSchema={
                'type': 'object',
                'properties': {'patient_id': {'type': 'string'}},
                'required': ['patient_id']
            }
        ),
        types.Tool(
            name='generate_discharge_summary',
            description='Generate a complete structured discharge plan with clinical recommendations',
            inputSchema={
                'type': 'object',
                'properties': {'patient_id': {'type': 'string'}},
                'required': ['patient_id']
            }
        ),
        types.Tool(
            name='translate_patient_instructions',
            description='Convert clinical discharge plan to simple, understandable language for patients',
            inputSchema={
                'type': 'object',
                'properties': {'clinical_plan': {'type': 'string'}},
                'required': ['clinical_plan']
            }
        ),
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == 'get_patient_context':
        pid = arguments.get('patient_id', 'demo-001')
        try:
            url = f'{FHIR_BASE}/Patient/{pid}'
            resp = requests.get(url, headers={'Accept': 'application/fhir+json'}, timeout=5)
            if resp.status_code == 200:
                return [types.TextContent(type='text', text=json.dumps(resp.json(), indent=2))]
        except Exception:
            pass
        return [types.TextContent(type='text', text=json.dumps(DEMO_PATIENT, indent=2))]

    if name == 'get_medications':
        return [types.TextContent(type='text', text=json.dumps(DEMO_PATIENT['medications'], indent=2))]

    if name == 'check_allergy_conflicts':
        prompt = f"""Analyze medication safety for this patient and return valid JSON only.
Expected schema:
{{
  "critical_conflicts": [string],
  "warnings": [string],
  "recommendations": [string]
}}

PATIENT:
{json.dumps(DEMO_PATIENT, indent=2)}
"""
        try:
            raw_text, provider = await _first_provider_response(prompt)
            result = json.loads(raw_text)
            result['llm_provider'] = provider
            return [types.TextContent(type='text', text=json.dumps(result, indent=2))]
        except Exception as err:
            fallback = {
                "critical_conflicts": [
                    "Warfarin + Ibuprofen: severe bleeding risk, avoid NSAID."
                ],
                "warnings": [
                    "INR 3.8 above target, needs repeat INR in 48h.",
                    "Hypokalemia (K+ 3.2), monitor potassium."
                ],
                "recommendations": [
                    "Replace ibuprofen with acetaminophen.",
                    "Reduce warfarin and schedule urgent INR control."
                ],
                "llm_provider": "demo-fallback",
                "error": str(err),
            }
            return [types.TextContent(type='text', text=json.dumps(fallback, indent=2))]

    if name == 'get_pending_followups':
        followups = {
            "critical_followups": [
                "Primary care within 7 days",
                "Endocrinology within 14 days",
                "Cardiology within 21 days",
            ],
            "routine_followups": [
                "Medication reconciliation call in 72 hours",
            ],
            "lab_workup": [
                "INR in 48 hours",
                "Basic metabolic panel in 7 days",
            ],
            "timeline": "High-risk discharge plan should be fully scheduled before discharge.",
        }
        return [types.TextContent(type='text', text=json.dumps(followups, indent=2))]

    if name == 'generate_discharge_summary':
        prompt = f"""Generate a clinically safe discharge summary and return valid JSON only.
Expected schema:
{{
  "patient_summary": string,
  "discharge_diagnoses": [string],
  "medications_at_discharge": [string],
  "medication_changes": [string],
  "activity_restrictions": [string],
  "diet_restrictions": [string],
  "follow_up_appointments": [string],
  "warning_signs": [string],
  "discharge_instructions": [string]
}}

PATIENT:
{json.dumps(DEMO_PATIENT, indent=2)}
"""
        try:
            raw_text, provider = await _first_provider_response(prompt)
            result = json.loads(raw_text)
            result['llm_provider'] = provider
            return [types.TextContent(type='text', text=json.dumps(result, indent=2))]
        except Exception as err:
            fallback = {
                "patient_summary": "67M with poorly controlled T2D, AFib, CKD3 at high discharge risk.",
                "discharge_diagnoses": ["Type 2 diabetes, uncontrolled", "Atrial fibrillation", "CKD stage 3"],
                "medications_at_discharge": ["Warfarin 4mg daily", "Metformin 1000mg BID", "Lisinopril 10mg daily", "Furosemide 40mg daily"],
                "medication_changes": ["Stop Ibuprofen", "Reduce warfarin from 5mg to 4mg"],
                "activity_restrictions": ["Avoid high bleeding risk activities"],
                "diet_restrictions": ["Diabetes-friendly diet", "Consistent vitamin K intake"],
                "follow_up_appointments": ["PCP 7 days", "Endocrinology 14 days", "Cardiology 21 days", "INR 48h"],
                "warning_signs": ["Any bleeding", "Severe dyspnea", "Chest pain", "Confusion"],
                "discharge_instructions": ["Schedule all follow-ups before discharge."],
                "llm_provider": "demo-fallback",
                "error": str(err),
            }
            return [types.TextContent(type='text', text=json.dumps(fallback, indent=2))]

    if name == 'translate_patient_instructions':
        clinical_plan = arguments.get('clinical_plan', '')
        prompt = f"""Rewrite this discharge plan in simple patient-friendly language.
Keep it short, clear, and actionable:

{clinical_plan}
"""
        try:
            text, provider = await _first_provider_response(prompt)
            return [types.TextContent(type='text', text=f"[{provider}]\n{text}")]
        except Exception as err:
            return [types.TextContent(type='text', text=f"Take medicines as prescribed, schedule follow-ups, and seek emergency care for bleeding, chest pain, or severe breathing issues. (fallback: {err})")]

    return [types.TextContent(type='text', text=json.dumps({"error": f"Unknown tool: {name}"}))]

async def main():
    async with stdio_server() as (read, write):
        await app.run(read, write, app.create_initialization_options())

if __name__ == '__main__':
    asyncio.run(main())