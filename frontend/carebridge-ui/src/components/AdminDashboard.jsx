import React, { useState, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'
import { AdminDualLineChart, AdminRoleBarChart, AdminSparkBars, AdminDonutChart } from './AdminCharts'
import BrandLogo from './BrandLogo'
import { API_BASE_URL } from '../apiConfig'

const API = API_BASE_URL

const STAT_STYLES = {
  blue: { border: 'border-blue-200', value: 'text-blue-600', iconWrap: 'text-blue-100' },
  purple: { border: 'border-purple-200', value: 'text-purple-600', iconWrap: 'text-purple-100' },
  emerald: { border: 'border-emerald-200', value: 'text-emerald-600', iconWrap: 'text-emerald-100' },
  amber: { border: 'border-amber-200', value: 'text-amber-600', iconWrap: 'text-amber-100' },
  rose: { border: 'border-rose-200', value: 'text-rose-600', iconWrap: 'text-rose-100' },
}

function StatCard({ title, value, icon, colorKey }) {
  const s = STAT_STYLES[colorKey] || STAT_STYLES.blue
  return (
    <div className={`bg-white rounded-2xl p-6 border ${s.border} shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-sm font-semibold">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${s.value}`}>{value}</p>
        </div>
        <div className={`text-4xl ${s.iconWrap}`}>{icon}</div>
      </div>
    </div>
  )
}

export default function AdminDashboard({ token, user }) {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [alerts, setAlerts] = useState(null)
  const [reports, setReports] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userQuery, setUserQuery] = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const fetchAllData = useCallback(async () => {
    setError(null)
    try {
      setLoading(true)
      const [statsRes, usersRes, auditRes, alertsRes, reportsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers }),
        axios.get(`${API}/admin/users`, { headers }),
        axios.get(`${API}/admin/audit-log`, { headers }),
        axios.get(`${API}/admin/alerts`, { headers }),
        axios.get(`${API}/admin/reports`, { headers }),
      ])

      setStats(statsRes.data)
      setUsers(usersRes.data)
      setAuditLog(auditRes.data)
      setAlerts(alertsRes.data)
      setReports(reportsRes.data)
      setLastRefresh(new Date())
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Unable to load admin data. Check your session.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q)),
    )
  }, [users, userQuery])

  const exportUsersCsv = () => {
    const rows = [['Name', 'Email', 'Role', 'Created', 'Status']]
    users.forEach((u) => {
      rows.push([u.name, u.email, u.role, u.created_at, u.status || 'active'])
    })
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `carebridge-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const donutSegments = useMemo(() => {
    const rd = stats?.role_distribution
    if (!rd) return []
    return [
      { label: 'Admin', value: rd.admin || 0, color: '#e11d48' },
      { label: 'Clinician', value: rd.clinician || 0, color: '#4f46e5' },
      { label: 'Staff', value: rd.staff || 0, color: '#64748b' },
    ].filter((s) => s.value > 0)
  }, [stats])

  const tabs = ['overview', 'analytics', 'users', 'alerts', 'audit', 'reports']

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="mt-4 text-slate-600 font-medium">Loading admin console…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-xl bg-white/10 p-2 ring-1 ring-white/20">
              <BrandLogo className="h-11 w-11 sm:h-12 sm:w-12" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-indigo-300 font-semibold">CareBridge Control Tower</p>
              <h1 className="text-3xl font-bold mt-1">Administration</h1>
              <p className="text-slate-300 mt-1">Signed in as {user.name}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="text-right text-sm text-slate-400">
              <p>
                Status: <span className="text-emerald-400 font-semibold">Operational</span>
              </p>
              {lastRefresh && <p>Synced {lastRefresh.toLocaleTimeString()}</p>}
            </div>
            <button
              type="button"
              onClick={() => fetchAllData()}
              disabled={loading}
              className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh data'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3.5 font-semibold text-sm border-b-2 transition ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 text-sm">
            {error}
          </div>
        )}

        {activeTab === 'overview' && stats && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Operational snapshot</h2>
              <p className="text-slate-600 text-sm mb-6">Live counts merge demo telemetry with your registered users.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard title="Total patients" value={stats.total_patients} icon="👥" colorKey="blue" />
                <StatCard title="Total users" value={stats.total_users} icon="👨‍💼" colorKey="purple" />
                <StatCard title="Discharges (period)" value={stats.total_discharges} icon="📋" colorKey="emerald" />
                <StatCard title="Uptime" value={stats.system_uptime} icon="⚡" colorKey="amber" />
                <StatCard title="API calls today" value={stats.api_calls_today} icon="🔌" colorKey="rose" />
              </div>
            </div>

            {stats.chart_series && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 text-lg">Discharge safety vs. Innovation API load</h3>
                <p className="text-sm text-slate-500 mt-1">Seven-day blended view — same series powers the Analytics tab.</p>
                <div className="mt-4">
                  <AdminDualLineChart
                    labels={stats.chart_series.day_labels}
                    seriesA={stats.chart_series.discharge_safety_index}
                    seriesB={stats.chart_series.innovation_api_hits}
                    legendA="Discharge safety index"
                    legendB="Innovation API hits (indexed)"
                  />
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm lg:col-span-2">
                <h3 className="font-bold text-slate-900 mb-4">Patient status pipeline</h3>
                <div className="space-y-3">
                  {Object.entries(stats.patients_by_status).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-3">
                      <span className="text-slate-600 capitalize w-36 text-sm shrink-0">{status.replace('_', ' ')}</span>
                      <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-2.5 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, (count / 50) * 100)}%` }}
                        />
                      </div>
                      <span className="font-semibold text-slate-900 w-10 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col items-center">
                <h3 className="font-bold text-slate-900 mb-2 w-full text-left">User roles</h3>
                <p className="text-xs text-slate-500 w-full text-left mb-2">From live user store</p>
                {donutSegments.length > 0 ? <AdminDonutChart segments={donutSegments} size={176} /> : null}
                <div className="w-full mt-4">
                  <AdminRoleBarChart distribution={stats.role_distribution} />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Clinical quality levers</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1 text-sm">
                      <span className="text-slate-600">Follow-up compliance</span>
                      <span className="font-semibold text-slate-900">{stats.clinical_metrics.follow_up_compliance}%</span>
                    </div>
                    <div className="bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2.5 rounded-full"
                        style={{ width: `${stats.clinical_metrics.follow_up_compliance}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1 text-sm">
                      <span className="text-slate-600">Patient satisfaction</span>
                      <span className="font-semibold text-slate-900">{stats.clinical_metrics.patient_satisfaction}%</span>
                    </div>
                    <div className="bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-2.5 rounded-full"
                        style={{ width: `${stats.clinical_metrics.patient_satisfaction}%` }}
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-slate-600 text-sm">Interactions flagged by safety engine</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">
                      {stats.clinical_metrics.medication_drug_interactions_caught}
                    </p>
                  </div>
                </div>
              </div>

              {stats.innovation_pulse && (
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-lg">
                  <h3 className="font-bold text-lg mb-1">CareBridge+ innovation pulse</h3>
                  <p className="text-indigo-100 text-sm mb-4">Rolling 24h — Copilot, Voice Pack, Risk DNA, FHIR, Handoff</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(stats.innovation_pulse).map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
                        <p className="text-2xl font-bold">{v}</p>
                        <p className="text-[11px] text-indigo-100 uppercase tracking-wide leading-tight mt-1">
                          {k.replace(/_/g, ' ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && stats && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Analytics and capacity</h2>
              <p className="text-slate-600 text-sm mt-1">Charts use admin API series — extend with your warehouse later.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 text-lg">Weekly performance trend</h3>
              <p className="text-sm text-slate-500 mt-1">Quality index tracked alongside platform load.</p>
              <div className="mt-4">
                <AdminDualLineChart
                  labels={stats.chart_series?.day_labels}
                  seriesA={stats.performance_trends?.week || []}
                  seriesB={stats.chart_series?.innovation_api_hits || []}
                  legendA="Quality index (7d)"
                  legendB="Innovation hits (indexed)"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">API latency p50 (ms)</h3>
                <AdminSparkBars
                  values={stats.chart_series?.latency_ms_p50 || []}
                  labels={stats.chart_series?.day_labels}
                  colorClass="bg-sky-500"
                />
              </div>
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Discharge safety index (bars)</h3>
                <AdminSparkBars
                  values={stats.chart_series?.discharge_safety_index || []}
                  labels={stats.chart_series?.day_labels}
                  colorClass="bg-emerald-500"
                />
              </div>
            </div>

            {reports && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Clinical throughput (reporting period)</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Interactions caught',
                      value: reports.clinical_performance.medication_drug_interactions_caught,
                      sub: 'Safety engine',
                      box: 'from-indigo-50 to-white border-indigo-100 text-indigo-900',
                    },
                    {
                      label: 'Critical alerts',
                      value: reports.clinical_performance.critical_alerts_generated,
                      sub: 'Generated',
                      box: 'from-rose-50 to-white border-rose-100 text-rose-900',
                    },
                    {
                      label: 'Follow-up compliance',
                      value: `${reports.clinical_performance.follow_up_compliance_rate}%`,
                      sub: 'Network coverage',
                      box: 'from-teal-50 to-white border-teal-100 text-teal-900',
                    },
                    {
                      label: 'Avg discharge time',
                      value: reports.clinical_performance.average_discharge_time,
                      sub: 'Door-to-doc',
                      box: 'from-amber-50 to-white border-amber-100 text-amber-950',
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className={`rounded-2xl border bg-gradient-to-br p-4 ${row.box}`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{row.label}</p>
                      <p className="text-2xl font-bold mt-2">{row.value}</p>
                      <p className="text-xs opacity-70 mt-1">{row.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">User directory</h2>
                <p className="text-slate-600 mt-1">{users.length} accounts · showing {filteredUsers.length}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <input
                  type="search"
                  placeholder="Search name, email, role…"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm flex-1 min-w-[200px]"
                />
                <button
                  type="button"
                  onClick={exportUsersCsv}
                  className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 whitespace-nowrap"
                >
                  Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.email} className="border-b border-slate-100 hover:bg-indigo-50/40 transition">
                      <td className="px-6 py-4 font-semibold text-slate-900">{u.name}</td>
                      <td className="px-6 py-4 text-slate-600 text-sm">{u.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            u.role === 'admin'
                              ? 'bg-rose-100 text-rose-800'
                              : u.role === 'clinician'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className="text-emerald-700 font-semibold text-sm">● Active</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <p className="p-8 text-center text-slate-500 text-sm">No users match your search.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'alerts' && alerts && (
          <div className="space-y-6">
            {['critical', 'warnings', 'info'].map((severity) => (
              <div key={severity} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div
                  className={`px-6 py-4 border-b ${
                    severity === 'critical'
                      ? 'bg-rose-50 border-rose-100'
                      : severity === 'warnings'
                        ? 'bg-amber-50 border-amber-100'
                        : 'bg-sky-50 border-sky-100'
                  }`}
                >
                  <h3
                    className={`font-bold ${
                      severity === 'critical' ? 'text-rose-900' : severity === 'warnings' ? 'text-amber-900' : 'text-sky-900'
                    }`}
                  >
                    {severity.charAt(0).toUpperCase() + severity.slice(1)} · {alerts[severity].length}
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {alerts[severity].map((alert, idx) => (
                    <div key={idx} className="p-6 hover:bg-slate-50/80 transition">
                      <p
                        className={`font-semibold ${
                          severity === 'critical' ? 'text-rose-700' : severity === 'warnings' ? 'text-amber-700' : 'text-sky-800'
                        }`}
                      >
                        {alert.message}
                      </p>
                      <p className="text-slate-500 text-sm mt-2">{alert.timestamp}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">Audit trail</h2>
              <p className="text-sm text-slate-500 mt-1">Immutable log slice (demo dataset)</p>
            </div>
            <div className="divide-y divide-slate-100">
              {auditLog.map((log, idx) => (
                <div key={idx} className="p-6 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{log.action}</p>
                    <p className="text-slate-600 text-sm mt-1">User: {log.user}</p>
                    {log.patient !== 'N/A' && <p className="text-slate-600 text-sm">Patient: {log.patient}</p>}
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-slate-500 text-sm">{log.timestamp}</p>
                    <span
                      className={`inline-block mt-2 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        log.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reports' && reports && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Discharge quality</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-600">Total discharges</span>
                    <span className="font-bold text-slate-900">{reports.discharge_quality_report.total_discharges}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-600">Safety issues surfaced</span>
                    <span className="font-bold text-rose-600">{reports.discharge_quality_report.with_safety_issues_identified}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-600">Follow-up scheduled</span>
                    <span className="font-bold text-emerald-600">{reports.discharge_quality_report.with_follow_up_scheduled}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-600">Plan quality (0–10)</span>
                    <span className="font-bold text-indigo-600">{reports.discharge_quality_report.average_plan_quality_score}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Readmission rate</span>
                    <span className="font-bold text-amber-600">{reports.discharge_quality_report.patient_readmission_rate}%</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">System reliability</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Uptime</span>
                    <span className="font-bold text-emerald-600">{reports.system_reliability.uptime_percentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">API availability</span>
                    <span className="font-bold text-emerald-600">{reports.system_reliability.api_availability}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Avg response</span>
                    <span className="font-bold text-slate-900">{reports.system_reliability.average_response_time_ms} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Error rate</span>
                    <span className="font-bold text-rose-600">{reports.system_reliability.error_rate_percent}%</span>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">User activity</h4>
                  <p className="text-sm text-slate-700">
                    Active clinicians: <strong>{reports.user_activity.active_clinicians}</strong> · Staff:{' '}
                    <strong>{reports.user_activity.active_staff}</strong>
                  </p>
                  <p className="text-sm text-slate-700 mt-1">
                    Logins today: <strong>{reports.user_activity.login_attempts_today}</strong> · Failed:{' '}
                    <strong className="text-rose-600">{reports.user_activity.failed_logins}</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
