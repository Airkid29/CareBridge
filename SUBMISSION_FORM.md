# CareBridge AI - Hackathon Submission Form

## Project Overview

### General Info

**Project name:**
CareBridge AI: Clinical Discharge Orchestration Platform

**Elevator pitch (200 chars):**
AI-powered discharge orchestration platform leveraging FHIR R4, MCP, and Google Gemini to generate safe, personalized hospital discharge plans with medication safety verification and care coordination.

---

## Project Story

### About the project

**Project Description (with Markdown + LaTeX support):**

CareBridge AI is an intelligent clinical discharge orchestration system designed to enhance patient safety during hospital transitions. The platform addresses a critical gap in healthcare: discharge planning complexity and patient safety risks.

#### Inspiration & Problem
Hospital discharge is a high-risk transition point where medication errors, missed follow-ups, and poor care coordination lead to preventable readmissions and adverse events. Clinical teams often lack decision support for:
- Drug interaction detection across medication lists
- Coordination of specialist follow-ups
- Patient-friendly discharge instruction generation

#### Solution Architecture
CareBridge AI integrates three key technologies:

1. **MCP Server (Model Context Protocol)** - Provides intelligent context management for clinical reasoning
2. **FastAPI Backend** - Exposes FHIR R4 compliant APIs for patient data and discharge workflows
3. **React Frontend** - User-friendly dashboard for clinicians to review and approve discharge plans

#### Technical Highlights
- **FHIR R4 Standard Integration**: Fetch patient records from FHIR-compliant servers (tested with HAPI FHIR)
- **Google Gemini 2.0 Flash Integration**: Single, unified AI model for:
  - Medication safety analysis
  - Follow-up care gap identification
  - Patient-friendly instruction generation
- **Double-Track Submission**: Dual MCP + A2A (Agent-to-Agent) architecture powered by Gemini
- **No External AI Dependencies**: Purely Gemini-based reasoning (no Claude, no multi-provider logic)
- **JWT-Protected APIs**: Secure clinician authentication and patient data access
- **Demo Patient**: Realistic John Martinez case (67M, Type 2 Diabetes, complex medication profile with known Warfarin-Ibuprofen interaction)

#### Key Features Demonstrated
✅ Load FHIR patient records  
✅ Medication safety scanning  
✅ Follow-up care review  
✅ AI-generated discharge plans  
✅ Clinician approval workflow  
✅ Admin dashboard for user management  

#### Challenges Overcome
1. **FHIR Complexity** - Navigated R4 schema for medication/condition mapping
2. **AI Context Management** - Designed MCP protocols for stateful clinical reasoning across service boundaries
3. **Safety-Critical System** - Implemented multi-layer verification for medication interactions
4. **React Component Architecture** - Built reusable components for real-world healthcare workflows

#### What We Learned
- Healthcare interoperability requires careful standard adherence (FHIR R4 conventions)
- MCP enables flexible AI context management without tight coupling
- Clinical AI systems demand transparent reasoning and multi-step verification
- User experience for hospital staff requires minimal cognitive load

---

### Built with

**Technologies used:**

**Backend & APIs:**
- FastAPI (Python web framework)
- Google Generative AI (Gemini 2.0 Flash)
- Python FHIR Library (hl7.fhir.r4)
- HAPI FHIR Server (external reference implementation)
- JWT Authentication

**MCP Server:**
- Model Context Protocol (mcp-sdk)
- Google Generative AI SDK
- Python AsyncIO

**Frontend:**
- React 19.2.5 (Component library)
- Axios (HTTP client)
- Tailwind CSS (Styling)
- React Testing Library

**Infrastructure:**
- Docker support ready
- Environment-based configuration (.env)
- CORS-enabled for cross-origin requests

---

## "Try It Out" Links

**Live Application:**
- Demo URL: http://localhost:3000 (after npm start)

**Source Code Repository:**
- GitHub: [GitHub Link to CareBridge AI]

**API Documentation:**
- Backend Swagger: http://localhost:8000/docs (FastAPI auto-docs)
- MCP Server: Stdio-based protocol runner

---

## Project Media

### Image Gallery
[Screenshots to add - min 3:2 ratio, max 5MB each]
- Dashboard overview
- Patient discharge plan
- Medication safety alerts

### Video Demo
[5-10 minute demo showing:]
- Login workflow
- Load demo patient (John Martinez)
- Run medication safety scan
- Generate discharge plan
- Approve and finalize

---

## Additional Info

### For Judges & Organizers

**Upload File:**
[carebridge-ai-source.zip - includes:]
- Full source code
- .env configuration template
- PostgreSQL schema (future)
- Deployment guides

**Submitter Country of Residence:**
[Your country]

**Published App Name:**
CareBridge AI v1.0 - FHIR R4 Clinical Discharge Orchestration

**Published URL from Prompt Opinion Marketplace:**
[Marketplace URL - to be provided after approval]

**Submission Type:**
✅ Dual Track: MCP Server + External A2A Agent

**Understanding of Requirements:**
✅ I confirm that my submission satisfies ALL hackathon requirements:
- Uses Model Context Protocol (MCP) for intelligent context management
- Implements A2A (Agent-to-Agent) communication for clinical reasoning
- Integrates with FHIR R4 standard for healthcare data
- Provides working frontend interface for clinician interaction
- Includes demo patient for validation
- Open source ready

**Project Status:**
✅ New Project - Built specifically for this hackathon (started March 2026)

**Prompt Opinion Integration:**
The project leverages Prompt Opinion's MCP framework to:
- Route clinical workflows through intelligent agentsa
- Manage multi-step clinical reasoning
- Enable transparent decision audit trails
- Support future marketplace extension

**Feedback for Prompt Opinion Platform:**
1. **Request**: OpenAPI/Swagger integration for MCP servers to ease API discovery
2. **Request**: GitHub Actions templates for hackathon submissions
3. **Request**: FHIR profile repository for healthcare-focused agents
4. **Suggestion**: Pre-built MCP adapters for common healthcare standards

---

## Submission Checklist
- [ ] All fields completed
- [ ] Source code zip prepared
- [ ] Screenshots added to media gallery
- [ ] Video demo recorded and uploaded
- [ ] Built application tested locally
- [ ] All dependencies documented
- [ ] Team contact information provided
- [ ] License specified (suggest: Apache 2.0 or MIT)

---

**Submission Date:** 11 May 2026
**Team Name:** [Team name]
**Contact Email:** [contact email]
