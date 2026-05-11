import React, { useState, useEffect } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'

export default function AdminDashboard({ token, user }) {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [alerts, setAlerts] = useState(null)
  const [reports, setReports] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    try {
      setLoading(true)
      const [statsRes, usersRes, auditRes, alertsRes, reportsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers }),
        axios.get(`${API}/admin/users`, { headers }),
        axios.get(`${API}/admin/audit-log`, { headers }),
        axios.get(`${API}/admin/alerts`, { headers }),
        axios.get(`${API}/admin/reports`, { headers })
      ])
      
      setStats(statsRes.data)
      setUsers(usersRes.data)
      setAuditLog(auditRes.data)
      setAlerts(alertsRes.data)
      setReports(reportsRes.data)
    } catch (error) {
      console.error('Failed to fetch admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ title, value, icon, color }) => (
    <div className={`bg-white rounded-2xl p-6 border border-${color}-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-sm font-semibold">{title}</p>
          <p className={`text-3xl font-bold text-${color}-600 mt-2`}>{value}</p>
        </div>
        <div className={`text-4xl text-${color}-100`}>{icon}</div>
      </div>
    </div>
  )

  if (loading) {
    return <div className="text-center py-12">Loading admin dashboard...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-slate-300 mt-1">Welcome back, {user.name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">System Status: <span className="text-emerald-400 font-semibold">Operational</span></p>
            <p className="text-sm text-slate-400">Last updated: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 sticky top-0">
        <div className="max-w-7xl mx-auto flex">
          {['overview', 'users', 'alerts', 'audit', 'reports'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 font-semibold text-sm uppercase tracking-wide border-b-2 transition ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Key Metrics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard title="Total Patients" value={stats.total_patients} icon="👥" color="blue" />
                <StatCard title="Total Users" value={stats.total_users} icon="👨‍💼" color="purple" />
                <StatCard title="Discharges" value={stats.total_discharges} icon="📋" color="emerald" />
                <StatCard title="Uptime" value={stats.system_uptime} icon="⚡" color="amber" />
                <StatCard title="API Calls" value={`${stats.api_calls_today}K`} icon="🔌" color="rose" />
              </div>
            </div>

            {/* Clinical Metrics */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4">Patient Status Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(stats.patients_by_status).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-slate-600 capitalize">{status}</span>
                      <div className="flex-1 mx-4 bg-slate-200 h-2 rounded-full">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${(count / 50) * 100}%` }}
                        />
                      </div>
                      <span className="font-semibold text-slate-900 w-8 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4">Clinical Performance</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-600">Follow-up Compliance</span>
                      <span className="font-semibold">{stats.clinical_metrics.follow_up_compliance}%</span>
                    </div>
                    <div className="bg-slate-200 h-2 rounded-full">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${stats.clinical_metrics.follow_up_compliance}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-600">Patient Satisfaction</span>
                      <span className="font-semibold">{stats.clinical_metrics.patient_satisfaction}%</span>
                    </div>
                    <div className="bg-slate-200 h-2 rounded-full">
                      <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${stats.clinical_metrics.patient_satisfaction}%` }} />
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-600">Medication Drug Interactions Caught</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.clinical_metrics.medication_drug_interactions_caught}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
              <p className="text-slate-600 mt-1">{users.length} total users in system</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Role</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Created</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.email} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 font-semibold text-slate-900">{u.name}</td>
                      <td className="px-6 py-4 text-slate-600">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          u.role === 'admin' ? 'bg-rose-100 text-rose-700' :
                          u.role === 'clinician' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4"><span className="text-emerald-600 font-semibold">Active</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ALERTS TAB */}
        {activeTab === 'alerts' && alerts && (
          <div className="space-y-6">
            {['critical', 'warnings', 'info'].map((severity) => (
              <div key={severity} className="bg-white rounded-2xl border border-slate-200">
                <div className={`p-6 border-b border-slate-200 ${{
                  critical: 'bg-rose-50',
                  warnings: 'bg-amber-50',
                  info: 'bg-blue-50'
                }[severity] || ''}`}>
                  <h3 className={`font-bold text-lg ${{
                    critical: 'text-rose-900',
                    warnings: 'text-amber-900',
                    info: 'text-blue-900'
                  }[severity] || ''}`}>
                    {severity.charAt(0).toUpperCase() + severity.slice(1)} ({alerts[severity].length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-200">
                  {alerts[severity].map((alert, idx) => (
                    <div key={idx} className="p-6">
                      <p className={`font-semibold ${{
                        critical: 'text-rose-600',
                        warnings: 'text-amber-600',
                        info: 'text-blue-600'
                      }[severity] || ''}`}>{alert.message}</p>
                      <p className="text-slate-500 text-sm mt-2">{alert.timestamp}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AUDIT TAB */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">Audit Log</h2>
            </div>
            <div className="divide-y divide-slate-200">
              {auditLog.map((log, idx) => (
                <div key={idx} className="p-6 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{log.action}</p>
                      <p className="text-slate-600 text-sm mt-1">User: {log.user}</p>
                      {log.patient !== 'N/A' && <p className="text-slate-600 text-sm">Patient: {log.patient}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-sm">{log.timestamp}</p>
                      <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${
                        log.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && reports && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Discharge Quality */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-4">Discharge Quality Report</h3>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-slate-600">Total Discharges</span><span className="font-bold">{reports.discharge_quality_report.total_discharges}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Safety Issues Identified</span><span className="font-bold text-rose-600">{reports.discharge_quality_report.with_safety_issues_identified}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Follow-up Scheduled</span><span className="font-bold text-emerald-600">{reports.discharge_quality_report.with_follow_up_scheduled}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Quality Score</span><span className="font-bold text-blue-600">{reports.discharge_quality_report.average_plan_quality_score}/10</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Readmission Rate</span><span className="font-bold text-amber-600">{reports.discharge_quality_report.patient_readmission_rate}%</span></div>
              </div>
            </div>

            {/* System Reliability */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-4">System Reliability</h3>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-slate-600">Uptime</span><span className="font-bold text-emerald-600">{reports.system_reliability.uptime_percentage}%</span></div>
                <div className="flex justify-between"><span className="text-slate-600">API Availability</span><span className="font-bold text-emerald-600">{reports.system_reliability.api_availability}%</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Avg Response Time</span><span className="font-bold">{reports.system_reliability.average_response_time_ms}ms</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Error Rate</span><span className="font-bold text-rose-600">{reports.system_reliability.error_rate_percent}%</span></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
