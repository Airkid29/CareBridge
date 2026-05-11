import React, { useState } from 'react'
import axios from 'axios'
import BrandLogo from './BrandLogo'
import { API_BASE_URL } from '../apiConfig'

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'clinician'
  })

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register'
      const email = formData.email.trim().toLowerCase()
      const payload = isLogin
        ? { email, password: formData.password }
        : {
            email,
            password: formData.password,
            name: formData.name.trim(),
            role: formData.role,
          }

      const response = await axios.post(`${API_BASE_URL}${endpoint}`, payload)

      if (response.data?.success && response.data?.token && response.data?.user) {
        localStorage.setItem('carebridge-token', response.data.token)
        localStorage.setItem('carebridge-user', JSON.stringify(response.data.user))
        onLogin(response.data.user, response.data.token)
      } else {
        setError('Unexpected response from server')
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        setError(
          detail
            .map((item) => (typeof item === 'string' ? item : item.msg || JSON.stringify(item)))
            .join(' · ') || 'Invalid form data',
        )
      } else if (typeof detail === 'string') {
        setError(detail)
      } else if (detail && typeof detail === 'object') {
        setError(detail.message || JSON.stringify(detail))
      } else if (!err.response) {
        setError(
          `Cannot reach the API at ${API_BASE_URL}. Start the backend (uvicorn) and check REACT_APP_API_URL if needed.`,
        )
      } else {
        setError('Authentication failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="rounded-2xl bg-white p-3 shadow-lg ring-1 ring-white/20">
              <BrandLogo className="h-16 w-16 sm:h-20 sm:w-20" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">CareBridge AI</h1>
          <p className="text-slate-300">Hospital-Grade Discharge Orchestration</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>

          {error && (
            <div className="mb-6 rounded-lg bg-rose-50 border border-rose-200 p-4 text-rose-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@hospital.ai"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                required
                minLength={isLogin ? 1 : 6}
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="clinician">Clinician</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-600">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin)
                  setError(null)
                }}
                className="text-blue-600 font-semibold hover:underline"
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>

          {isLogin && (
            <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-600 font-semibold mb-2">Demo Credentials:</p>
              <p className="text-xs text-slate-600">Admin: admin@carebridge.ai / admin123</p>
              <p className="text-xs text-slate-600">Doctor: doctor@carebridge.ai / doctor123</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
