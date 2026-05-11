import { useState } from 'react'
import axios from 'axios'

function workflowPayload(result) {
  return {
    critical_alerts: result?.critical_alerts || [],
    warnings: result?.warnings || [],
    missing_followups: result?.missing_followups || [],
    summary: typeof result?.summary === 'string' ? result.summary : '',
  }
}

const VOICE_LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'zh', label: '中文 (简体)' },
  { code: 'ar', label: 'العربية' },
  { code: 'ht', label: 'Kreyòl' },
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'English' },
]

function bandColorClass(hint) {
  if (hint === 'rose') return 'from-rose-500 to-orange-600'
  if (hint === 'amber') return 'from-amber-500 to-orange-500'
  return 'from-emerald-500 to-teal-600'
}

export default function InnovationHub({ apiBase, getHeaders, patient, result, onActivity, onError }) {
  const [risk, setRisk] = useState(null)
  const [riskLoading, setRiskLoading] = useState(false)

  const [copilotQ, setCopilotQ] = useState('')
  const [copilotThread, setCopilotThread] = useState([])
  const [copilotLoading, setCopilotLoading] = useState(false)

  const [voiceLang, setVoiceLang] = useState('fr')
  const [voiceOut, setVoiceOut] = useState(null)
  const [voiceLoading, setVoiceLoading] = useState(false)

  const [fhirBundle, setFhirBundle] = useState(null)
  const [fhirLoading, setFhirLoading] = useState(false)

  const [capsule, setCapsule] = useState(null)
  const [capsuleLoading, setCapsuleLoading] = useState(false)

  const [readiness, setReadiness] = useState(null)
  const [readinessLoading, setReadinessLoading] = useState(false)

  const headers = () => getHeaders()

  const guardPatient = () => {
    if (!patient?.id) {
      onError?.('Load a patient to use the Innovation cockpit.')
      return false
    }
    return true
  }

  const runTransitionRisk = async () => {
    if (!guardPatient()) return
    setRiskLoading(true)
    setRisk(null)
    try {
      const res = await axios.post(
        `${apiBase}/innovation/transition-risk-dna`,
        { patient_id: patient.id, workflow: workflowPayload(result) },
        { headers: headers() },
      )
      setRisk(res.data)
      onActivity?.('Transition Risk DNA computed')
    } catch (e) {
      const d = e.response?.data?.detail
      onError?.(typeof d === 'string' ? d : 'Transition Risk DNA failed')
    } finally {
      setRiskLoading(false)
    }
  }

  const askCopilot = async () => {
    if (!guardPatient()) return
    const q = copilotQ.trim()
    if (q.length < 2) {
      onError?.('Enter a question for the copilot.')
      return
    }
    setCopilotLoading(true)
    setCopilotThread((t) => [...t, { role: 'user', text: q }])
    setCopilotQ('')
    try {
      const res = await axios.post(
        `${apiBase}/innovation/clinical-copilot`,
        { patient_id: patient.id, question: q, workflow: workflowPayload(result) },
        { headers: headers() },
      )
      setCopilotThread((t) => [...t, { role: 'assistant', text: res.data.answer, source: res.data.source }])
      onActivity?.('Clinical Copilot answered')
    } catch (e) {
      const d = e.response?.data?.detail
      onError?.(typeof d === 'string' ? d : 'Clinical Copilot request failed')
      setCopilotThread((t) => [...t, { role: 'assistant', text: 'Request failed — try again.', source: 'error' }])
    } finally {
      setCopilotLoading(false)
    }
  }

  const runVoicePack = async () => {
    if (!guardPatient()) return
    setVoiceLoading(true)
    setVoiceOut(null)
    try {
      const res = await axios.post(
        `${apiBase}/innovation/patient-voice-pack`,
        {
          patient_id: patient.id,
          target_language: voiceLang,
          patient_instructions: result?.patient_instructions || null,
          summary: typeof result?.summary === 'string' ? result.summary : null,
        },
        { headers: headers() },
      )
      setVoiceOut(res.data)
      onActivity?.(`Voice Pack (${res.data.language_label || voiceLang})`)
    } catch (e) {
      const d = e.response?.data?.detail
      onError?.(typeof d === 'string' ? d : 'Voice Pack failed')
    } finally {
      setVoiceLoading(false)
    }
  }

  const exportFhir = async () => {
    if (!guardPatient()) return
    setFhirLoading(true)
    setFhirBundle(null)
    try {
      const res = await axios.post(
        `${apiBase}/innovation/fhir-care-bundle`,
        {
          patient_id: patient.id,
          discharge_plan: result?.discharge_plan || [],
          patient_instructions: Array.isArray(result?.patient_instructions)
            ? result.patient_instructions
            : result?.patient_instructions
              ? [String(result.patient_instructions)]
              : [],
          summary: typeof result?.summary === 'string' ? result.summary : '',
          critical_alerts: result?.critical_alerts || [],
        },
        { headers: headers() },
      )
      setFhirBundle(res.data)
      onActivity?.('FHIR care bundle generated')
    } catch (e) {
      const d = e.response?.data?.detail
      onError?.(typeof d === 'string' ? d : 'FHIR export failed')
    } finally {
      setFhirLoading(false)
    }
  }

  const copyFhir = async () => {
    if (!fhirBundle) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(fhirBundle, null, 2))
      onActivity?.('FHIR JSON copied to clipboard')
    } catch {
      onError?.('Clipboard not available')
    }
  }

  const runHandoff = async () => {
    if (!guardPatient()) return
    setCapsuleLoading(true)
    setCapsule(null)
    try {
      const res = await axios.post(
        `${apiBase}/innovation/handoff-capsule`,
        { patient_id: patient.id, workflow: workflowPayload(result) },
        { headers: headers() },
      )
      setCapsule(res.data)
      onActivity?.('Handoff capsule built')
    } catch (e) {
      const d = e.response?.data?.detail
      onError?.(typeof d === 'string' ? d : 'Handoff capsule failed')
    } finally {
      setCapsuleLoading(false)
    }
  }

  const loadReadiness = async () => {
    if (!guardPatient()) return
    setReadinessLoading(true)
    setReadiness(null)
    try {
      const res = await axios.get(`${apiBase}/innovation/readiness-checklist/${patient.id}`, { headers: headers() })
      setReadiness(res.data)
      onActivity?.('Readiness checklist loaded')
    } catch (e) {
      const d = e.response?.data?.detail
      onError?.(typeof d === 'string' ? d : 'Readiness checklist failed')
    } finally {
      setReadinessLoading(false)
    }
  }

  return (
    <section className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-violet-600 font-semibold">Innovation cockpit</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">CareBridge+ layer</h2>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Transition Risk DNA (explainable), Clinical Copilot (grounded Gemini), multilingual Voice Pack,
            FHIR care bundle, 24h Handoff Capsule, and readiness scoring — built for live jury demos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-violet-600/10 px-3 py-1 text-xs font-medium text-violet-800">A2A-ready</span>
          <span className="rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-medium text-indigo-800">Equity · Interop</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Transition Risk DNA */}
        <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Transition Risk DNA</h3>
          <p className="text-xs text-slate-500 mt-1">Rules + live workflow fusion — not a black box.</p>
          <button
            type="button"
            onClick={runTransitionRisk}
            disabled={riskLoading || !patient}
            className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {riskLoading ? 'Computing…' : 'Analyze transition stress'}
          </button>
          {risk && (
            <div className="mt-4 space-y-3">
              <div
                className={`rounded-2xl bg-gradient-to-r ${bandColorClass(risk.band_color_hint)} p-4 text-white`}
              >
                <p className="text-xs uppercase tracking-wider opacity-90">{risk.risk_band} band</p>
                <p className="text-4xl font-bold mt-1">{risk.transition_stress_score}</p>
                <p className="text-sm opacity-90 mt-1">Transition stress score (0–100)</p>
              </div>
              <ul className="text-sm space-y-2 text-slate-700 max-h-40 overflow-y-auto">
                {(risk.drivers || []).map((d) => (
                  <li key={d.code} className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
                    <span className="font-medium">{d.label}</span>
                    <span className="text-slate-400"> · impact +{d.impact}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500">{risk.model}</p>
            </div>
          )}
        </div>

        {/* Clinical Copilot */}
        <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm flex flex-col min-h-[280px]">
          <h3 className="text-lg font-semibold text-slate-900">Clinical Copilot</h3>
          <p className="text-xs text-slate-500 mt-1">Grounded on chart + current workflow panel only.</p>
          <div className="mt-3 flex-1 rounded-xl bg-slate-50 border border-slate-200 p-3 max-h-48 overflow-y-auto text-sm space-y-2">
            {copilotThread.length === 0 ? (
              <p className="text-slate-500">Try: &ldquo;Why is INR concerning here?&rdquo; or &ldquo;Top 3 actions before discharge?&rdquo;</p>
            ) : (
              copilotThread.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-indigo-100 text-indigo-950 ml-4' : 'bg-white border border-slate-200 mr-4'}`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.source && <p className="text-[10px] text-slate-400 mt-1">{m.source}</p>}
                </div>
              ))
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Ask the copilot…"
              value={copilotQ}
              onChange={(e) => setCopilotQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !copilotLoading && askCopilot()}
            />
            <button
              type="button"
              onClick={askCopilot}
              disabled={copilotLoading || !patient}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {copilotLoading ? '…' : 'Ask'}
            </button>
          </div>
        </div>

        {/* Voice Pack */}
        <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Patient Voice Pack</h3>
          <p className="text-xs text-slate-500 mt-1">Discharge education in the patient’s home language.</p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <select
              value={voiceLang}
              onChange={(e) => setVoiceLang(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm flex-1 min-w-[140px]"
            >
              {VOICE_LANGS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={runVoicePack}
              disabled={voiceLoading || !patient}
              className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-50"
            >
              {voiceLoading ? 'Translating…' : 'Translate'}
            </button>
          </div>
          {voiceOut && (
            <div className="mt-4 text-sm space-y-2 max-h-52 overflow-y-auto">
              <p className="text-xs text-fuchsia-700 font-medium">{voiceOut.disclaimer}</p>
              {(voiceOut.patient_instructions_translated || []).map((line, idx) => (
                <p key={idx} className="text-slate-800">
                  {line}
                </p>
              ))}
              <p className="text-slate-600 font-medium border-t border-slate-100 pt-2 mt-2">{voiceOut.summary_translated}</p>
              <p className="text-[10px] text-slate-400">source: {voiceOut.source}</p>
            </div>
          )}
        </div>

        {/* FHIR + Handoff row */}
        <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">FHIR care bundle</h3>
            <p className="text-xs text-slate-500 mt-1">Collection bundle: Patient + CarePlan for PCP pipes.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportFhir}
                disabled={fhirLoading || !patient}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {fhirLoading ? 'Building…' : 'Generate bundle'}
              </button>
              {fhirBundle && (
                <button
                  type="button"
                  onClick={copyFhir}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Copy JSON
                </button>
              )}
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-lg font-semibold text-slate-900">24h Handoff Capsule</h3>
            <p className="text-xs text-slate-500 mt-1">Nursing + family + PCP bridge narrative.</p>
            <button
              type="button"
              onClick={runHandoff}
              disabled={capsuleLoading || !patient}
              className="mt-3 w-full rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {capsuleLoading ? 'Building…' : 'Build capsule'}
            </button>
            {capsule && (
              <div className="mt-4 text-sm text-slate-700 space-y-2">
                <p className="font-semibold text-teal-900">{capsule.headline}</p>
                <p>{capsule.one_liner}</p>
                <p className="text-xs font-semibold text-slate-500 uppercase">Before leaving</p>
                <ul className="list-disc pl-4">
                  {(capsule.must_do_before_leaving || []).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
                <p className="text-xs font-semibold text-slate-500 uppercase">Book</p>
                <ul className="list-disc pl-4">
                  {(capsule.book_these_visits || []).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Readiness */}
        <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Discharge readiness radar</h3>
              <p className="text-xs text-slate-500 mt-1">Weighted checklist — updates as the chart matures.</p>
            </div>
            <button
              type="button"
              onClick={loadReadiness}
              disabled={readinessLoading || !patient}
              className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 shrink-0"
            >
              {readinessLoading ? 'Loading…' : 'Refresh readiness'}
            </button>
          </div>
          {readiness && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4 lg:col-span-1 text-center">
                <p className="text-xs text-sky-700 font-semibold uppercase">Score</p>
                <p className="text-3xl font-bold text-sky-900 mt-1">{readiness.readiness_percent}%</p>
              </div>
              <div className="lg:col-span-5 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {(readiness.items || []).map((it) => (
                  <div
                    key={it.id}
                    className={`rounded-xl border px-3 py-2 text-sm ${it.done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <p className="font-semibold text-slate-900">{it.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{it.hint}</p>
                    <p className="text-[10px] mt-1 font-medium text-slate-400">
                      weight {it.weight} · {it.done ? 'done' : 'open'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
