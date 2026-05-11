/** Backend API base (no trailing slash). Set REACT_APP_API_URL when deploying. */
const raw = process.env.REACT_APP_API_URL || 'http://localhost:8000'
export const API_BASE_URL = String(raw).replace(/\/$/, '')
