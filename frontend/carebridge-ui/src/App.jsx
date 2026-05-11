// frontend/src/App.jsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import PatientCard from './components/PatientCard'
import AlertsList from './components/AlertsList'
import DischargePlan from './components/DischargePlan'
import MetricsChart from './components/MetricsChart'
import Auth from './components/Auth'
import AdminDashboard from './components/AdminDashboard'

const API = 'http://localhost:8000'

const initialSteps = [
  { title: 'Load patient', description: 'Fetch FHIR demo record', status: 'ready' },
  { title: 'Medication safety', description: 'Scan for drug interactions', status: 'pending' },
  { title: 'Follow-up review', description: 'Check missing appointments', status: 'pending' },
  { title: 'Discharge assembly', description: 'Create the final plan', status: 'pending' },
]

const onboardingSteps = [
  {
    title: 'Welcome to CareBridge AI',
    description: 'Your AI-powered discharge orchestration platform for safe hospital transitions.',
    icon: '🏥'
  },
  {
    title: 'Load or Create Patient',
    description: 'Start by loading the demo patient or create a new one with custom data.',
    icon: '👤'
  },
  {
    title: 'Run Safety Checks',
    description: 'Automatically scan for medication interactions and clinical risks.',
    icon: '🔍'
  },
  {
    title: 'Review Follow-ups',
    description: 'Check for missing appointments and care coordination gaps.',
    icon: '📅'
  },
  {
    title: 'Assemble Discharge Plan',
    description: 'Generate comprehensive discharge instructions with patient-friendly language.',
    icon: '📋'
  },
  {
    title: 'Clinician Approval',
    description: 'Review and approve the plan before finalizing the discharge.',
    icon: '✅'
  }
]

function statusClass(status) {
  if (status === 'completed') return 'bg-emerald-500 text-white'
  if (status === 'active') return 'bg-blue-500 text-white'
  return 'bg-slate-100 text-slate-700'
}

export default function App() {
  // Auth state
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  // Discharge workflow state
  const [patient, setPatient] = useState(null)
  const [patients, setPatients] = useState([
    { id: 'demo-001', name: 'John Martinez', age: 68, conditions: ['Hypertension', 'Diabetes'], medications: ['Lisinopril', 'Metformin'] }
  ])
  const [result, setResult] = useState({})
  const [loading, setLoading] = useState(false)
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState(null)
  const [steps, setSteps] = useState(initialSteps)
  const [activityLog, setActivityLog] = useState([])
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [onboardingIndex, setOnboardingIndex] = useState(0)
  const [showPatientForm, setShowPatientForm] = useState(false)
  const [newPatient, setNewPatient] = useState({
    name: '',
    age: '',
    conditions: '',
    medications: '',
    allergies: '',
    notes: ''
  })

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('carebridge-token')
    const storedUser = localStorage.getItem('carebridge-user')
    if (storedToken && storedUser) {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
      setIsAuthenticated(true)
    }
    
    const hasSeenOnboarding = localStorage.getItem('carebridge-onboarding-seen')
    if (hasSeenOnboarding) {
      setShowOnboarding(false)
    }
  }, [])

  const handleLogin = (userData, authToken) => {
    setToken(authToken)
    setUser(userData)
    setIsAuthenticated(true)
    localStorage.setItem('carebridge-token', authToken)
    localStorage.setItem('carebridge-user', JSON.stringify(userData))
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
    localStorage.removeItem('carebridge-token')
    localStorage.removeItem('carebridge-user')
    setPatient(null)
    setResult({})
    setApproved(false)
    setShowOnboarding(true)
  }

  // Get auth headers for API calls
  const getHeaders = () => ({
    Authorization: `Bearer ${token}`
  })

  const logEvent = (message) => {
    setActivityLog((prev) => [
      { message, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 8),
    ])
  }

  const updateStep = (index, status) => {
    setSteps((prev) => prev.map((step, i) => i === index ? { ...step, status } : step))
  }

  const loadPatient = async (patientId) => {
    try {
      setError(null)
      setLoading(true)
      const res = await axios.get(`${API}/patient/${patientId}`, { headers: getHeaders() })
      setPatient(res.data)
      setResult({})
      setApproved(false)
      updateStep(0, 'completed')
      updateStep(1, 'active')
      logEvent(`Patient ${res.data.name} loaded`)
    } catch (err) {
      setError('Failed to load patient data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const createPatient = async () => {
    if (!newPatient.name || !newPatient.age) {
      setError('Name and age are required')
      return
    }
    try {
      const reqData = {
        name: newPatient.name,
        age: parseInt(newPatient.age),
        conditions: newPatient.conditions.split(',').map(c => c.trim()),
        medications: newPatient.medications.split(',').map(m => m.trim()),
        allergies: newPatient.allergies.split(',').map(a => a.trim()),
        notes: newPatient.notes
      }
      const res = await axios.post(`${API}/patients`, reqData, { headers: getHeaders() })
      setPatients(prev => [...prev, res.data])
      setPatient(res.data)
      setShowPatientForm(false)
      setNewPatient({ name: '', age: '', conditions: '', medications: '', allergies: '', notes: '' })
      logEvent(`New patient ${res.data.name} created`)
    } catch (err) {
      setError('Failed to create patient')
      console.error(err)
    }
  }

  const runSafetyScan = async () => {
    if (!patient) {
      setError('Load patient data first')
      return
    }
    try {
      setError(null)
      setLoading(true)
      const res = await axios.get(`${API}/medication-scan/${patient.id}`, { headers: getHeaders() })
      setResult((prev) => ({ ...prev, ...res.data }))
      updateStep(1, 'completed')
      updateStep(2, 'active')
      logEvent('Medication safety scan completed')
    } catch (err) {
      setError('Failed to run medication safety scan')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const runFollowupReview = async () => {
    if (!patient) {
      setError('Load patient data first')
      return
    }
    try {
      setError(null)
      setLoading(true)
      const res = await axios.get(`${API}/followup-review/${patient.id}`, { headers: getHeaders() })
      setResult((prev) => ({ ...prev, ...res.data }))
      updateStep(2, 'completed')
      updateStep(3, 'active')
      logEvent('Follow-up review completed')
    } catch (err) {
      setError('Failed to check follow-ups')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const generatePlan = async () => {
    if (!patient) {
      setError('Load patient data first')
      return
    }
    try {
      setError(null)
      setLoading(true)
      const res = await axios.post(`${API}/generate-discharge`, { patient_id: patient.id }, { headers: getHeaders() })
      setResult((prev) => ({ ...prev, ...res.data }))
      updateStep(3, 'completed')
      logEvent('Final discharge plan assembled')
    } catch (err) {
      setError('Failed to generate discharge plan')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = () => {
    setApproved(true)
    logEvent('Clinician approved the discharge plan')
  }

  const nextOnboarding = () => {
    if (onboardingIndex < onboardingSteps.length - 1) {
      setOnboardingIndex(onboardingIndex + 1)
    } else {
      setShowOnboarding(false)
      localStorage.setItem('carebridge-onboarding-seen', 'true')
    }
  }

  const skipOnboarding = () => {
    setShowOnboarding(false)
    localStorage.setItem('carebridge-onboarding-seen', 'true')
  }

   // If not authenticated, show auth screen
   if (!isAuthenticated) {
     return <Auth onLogin={handleLogin} />
   }

   // If admin, show admin dashboard
   if (user?.role === 'admin') {
     return (
       <div>
         <AdminDashboard token={token} user={user} />
         <div className="fixed bottom-4 right-4">
           <button
             onClick={handleLogout}
             className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
           >
             Logout
           </button>
         </div>
       </div>
     )
   }

   // Clinician/Staff dashboard
   return (
     <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
       <div className="max-w-2xl w-full bg-white rounded-3xl shadow-lg p-8">
         <div className="text-center mb-8">
           <div className="text-6xl mb-4">{onboardingSteps[onboardingIndex].icon}</div>
           <h1 className="text-3xl font-bold text-slate-900 mb-2">{onboardingSteps[onboardingIndex].title}</h1>
           <p className="text-slate-600">{onboardingSteps[onboardingIndex].description}</p>
         </div>

         <div className="flex justify-between items-center mb-6">
           <div className="flex space-x-2">
             {onboardingSteps.map((_, index) => (
               <div
                 key={index}
                 className={`h-2 w-8 rounded-full ${index <= onboardingIndex ? 'bg-blue-500' : 'bg-slate-200'}`}
               />
             ))}
           </div>
           <span className="text-sm text-slate-500">{onboardingIndex + 1} of {onboardingSteps.length}</span>
         </div>

         <div className="flex justify-between">
           <button
             onClick={skipOnboarding}
             className="px-6 py-2 text-slate-600 hover:text-slate-800"
           >
             Skip
           </button>
           <button
             onClick={nextOnboarding}
             className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
           >
             {onboardingIndex === onboardingSteps.length - 1 ? 'Get Started' : 'Next'}
           </button>
         </div>
       </div>
     </div>
   )
 }

  // If admin, show admin dashboard
  if (user?.role === 'admin') {
    return (
      <div>
        <AdminDashboard token={token} user={user} />
        <div className="fixed bottom-4 right-4">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition shadow-lg"
          >
            Logout
          </button>
        </div>
      </div>
     )
   }
   
   // Clinician/Staff dashboard
   return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{onboardingSteps[onboardingIndex].icon}</div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{onboardingSteps[onboardingIndex].title}</h1>
            <p className="text-slate-600">{onboardingSteps[onboardingIndex].description}</p>
          </div>

          <div className="flex justify-between items-center mb-6">
            <div className="flex space-x-2">
              {onboardingSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-8 rounded-full ${index <= onboardingIndex ? 'bg-blue-500' : 'bg-slate-200'}`}
                />
              ))}
            </div>
            <span className="text-sm text-slate-500">{onboardingIndex + 1} of {onboardingSteps.length}</span>
          </div>

          <div className="flex justify-between">
            <button
              onClick={skipOnboarding}
              className="px-6 py-2 text-slate-600 hover:text-slate-800"
            >
              Skip
            </button>
            <button
              onClick={nextOnboarding}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {onboardingIndex === onboardingSteps.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-slate-900 text-white border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">St. Mary's Health Network</p>
            <h1 className="text-3xl font-semibold tracking-tight">CareBridge AI</h1>
            <p className="mt-1 text-slate-300">Clinical discharge orchestration for safe hospital transitions.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <div className="rounded-2xl bg-slate-800 px-4 py-3">
              <p className="text-slate-400">Case</p>
              <p className="mt-1 font-semibold">{patient?.name || 'None'}</p>
            </div>
            <div className="rounded-2xl bg-slate-800 px-4 py-3">
              <p className="text-slate-400">Unit</p>
              <p className="mt-1 font-semibold">Transitional Care</p>
            </div>
            <div className="rounded-2xl bg-slate-800 px-4 py-3">
              <p className="text-slate-400">Status</p>
              <p className="mt-1 font-semibold text-emerald-400">Ready for review</p>
            </div>
            <div className="rounded-2xl bg-slate-800 px-4 py-3">
              <p className="text-slate-400">Impact</p>
              <p className="mt-1 font-semibold text-blue-400">+23% Safety</p>
            </div>
            <div className="rounded-2xl bg-slate-800 px-4 py-3">
              <p className="text-slate-400">User</p>
              <p className="mt-1 font-semibold">{user?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* System Status Banner */}
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
          <div className="text-sm">
            <span className="font-semibold text-emerald-800">System Online</span>
            <span className="text-emerald-600 ml-2">Connected to Epic EHR • FHIR R4 API • Gemini AI Model</span>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-rose-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Clinical workflow</p>
                  <h2 className="mt-2 text-2xl font-semibold">Hospital-grade discharge orchestration</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Live demo mode
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-950/5 p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">API Source</p>
                  <p className="mt-2 font-semibold">FHIR R4 (hapi.fhir.org)</p>
                </div>
                <div className="rounded-2xl bg-slate-950/5 p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">Platform</p>
                  <p className="mt-2 font-semibold">MCP + A2A</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => loadPatient('demo-001')}
                  disabled={loading}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Load demo patient
                </button>
                <button
                  onClick={() => setShowPatientForm(true)}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
                >
                  Create new patient
                </button>
                <button
                  onClick={runSafetyScan}
                  disabled={!patient || loading}
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Run safety scan
                </button>
                <button
                  onClick={runFollowupReview}
                  disabled={!patient || loading}
                  className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Review follow-ups
                </button>
                <button
                  onClick={generatePlan}
                  disabled={!patient || loading}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Assemble plan
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Workflow status</p>
                <div className="mt-4 space-y-3">
                  {steps.map((step) => (
                    <div key={step.title} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                        <p className="text-sm text-slate-500">{step.description}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(step.status)}`}>
                        {step.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Operational log</p>
                <div className="mt-4 space-y-3">
                  {activityLog.length === 0 ? (
                    <p className="text-slate-500">Actions will appear here as you run the workflow.</p>
                  ) : (
                    activityLog.map((item, index) => (
                      <div key={index} className="rounded-2xl bg-slate-50 p-3 border border-slate-200">
                        <p className="text-sm text-slate-700">{item.message}</p>
                        <p className="mt-2 text-xs text-slate-500">{item.time}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Patient overview</p>
              {patient ? (
                <div className="mt-5">
                  <PatientCard patient={patient} />
                </div>
              ) : (
                <p className="mt-4 text-slate-500">Load the patient record to review the case.</p>
              )}
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Quality metrics</p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl bg-slate-950/5 p-4">
                  <p className="text-sm text-slate-500">Readmission risk</p>
                  <p className="mt-2 text-xl font-semibold text-rose-600">High</p>
                </div>
                <div className="rounded-2xl bg-slate-950/5 p-4">
                  <p className="text-sm text-slate-500">Medication safety</p>
                  <p className="mt-2 text-xl font-semibold text-indigo-700">Priority review</p>
                </div>
                <div className="rounded-2xl bg-slate-950/5 p-4">
                  <p className="text-sm text-slate-500">Care coordination</p>
                  <p className="mt-2 text-xl font-semibold text-amber-600">Needs attention</p>
                </div>
              </div>
              
              <div className="mt-6">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500 mb-4">Performance metrics</p>
                <MetricsChart data={[
                  { label: 'Safety', value: 85 },
                  { label: 'Efficiency', value: 92 },
                  { label: 'Compliance', value: 78 },
                  { label: 'Satisfaction', value: 88 }
                ]} />
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Patient list</p>
              <div className="mt-4 space-y-2">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadPatient(p.id)}
                    className="w-full text-left rounded-2xl bg-slate-50 p-3 border border-slate-200 hover:bg-slate-100 transition"
                  >
                    <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">Age {p.age} • {p.conditions.length} conditions</p>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </section>

        {showPatientForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold mb-4">Create New Patient</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Patient Name"
                  value={newPatient.name}
                  onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-lg"
                />
                <input
                  type="number"
                  placeholder="Age"
                  value={newPatient.age}
                  onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Conditions (comma-separated)"
                  value={newPatient.conditions}
                  onChange={(e) => setNewPatient({ ...newPatient, conditions: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Medications (comma-separated)"
                  value={newPatient.medications}
                  onChange={(e) => setNewPatient({ ...newPatient, medications: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Allergies (comma-separated)"
                  value={newPatient.allergies}
                  onChange={(e) => setNewPatient({ ...newPatient, allergies: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-lg"
                />
                <textarea
                  placeholder="Additional Notes"
                  value={newPatient.notes}
                  onChange={(e) => setNewPatient({ ...newPatient, notes: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-lg h-24"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowPatientForm(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={createPatient}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Patient
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.8fr_1.2fr]">
          <div className="space-y-6">
            {result.critical_alerts && result.critical_alerts.length > 0 && (
              <AlertsList alerts={result.critical_alerts} type="critical" title="🚨 Critical medication alerts" />
            )}

            {result.warnings && result.warnings.length > 0 && (
              <AlertsList alerts={result.warnings} type="warning" title="⚠️ Clinical warnings" />
            )}

            {result.missing_followups && result.missing_followups.length > 0 && (
              <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Missing follow-ups</p>
                <ul className="mt-4 space-y-2 text-slate-700">
                  {result.missing_followups.map((followup, index) => (
                    <li key={index} className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-200">{followup}</li>
                  ))}
                </ul>
                {result.followup_summary && (
                  <p className="mt-4 text-sm text-slate-500">{result.followup_summary}</p>
                )}
              </div>
            )}

            {result.discharge_plan && (
              <DischargePlan plan={result.discharge_plan} />
            )}
          </div>

          <div className="space-y-6">
            {result.patient_instructions && (
              <div className="rounded-3xl bg-emerald-50 p-6 shadow-sm border border-emerald-200">
                <p className="text-sm uppercase tracking-[0.3em] text-emerald-700">Patient instructions</p>
                <div className="mt-4 whitespace-pre-wrap text-slate-800">{Array.isArray(result.patient_instructions) ? result.patient_instructions.join('\n') : result.patient_instructions}</div>
              </div>
            )}

            {result.summary && (
              <div className="rounded-3xl bg-slate-950 p-6 shadow-sm text-white border border-slate-800">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Clinical summary</p>
                <p className="mt-4 text-lg font-semibold">{result.summary}</p>
              </div>
            )}

            {!approved && result.summary && (
              <button
                onClick={handleApprove}
                className="w-full rounded-3xl bg-green-600 px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500"
              >
                Approve discharge plan
              </button>
            )}

            {approved && (
              <div className="rounded-3xl bg-emerald-50 p-6 shadow-sm border border-emerald-200">
                <p className="font-semibold text-emerald-800">Plan approved</p>
                <p className="mt-2 text-sm text-slate-600">Approval timestamp: {new Date().toLocaleTimeString()}</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 text-slate-400 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="text-sm">CareBridge AI — FHIR R4 + MCP + A2A · Hackathon 2026 demo</div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
          >
            Logout ({user?.name})
          </button>
        </div>
      </footer>
    </div>
  )
}
