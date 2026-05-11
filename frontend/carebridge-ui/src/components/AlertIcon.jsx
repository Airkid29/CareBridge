// components/AlertIcon.jsx
export default function AlertIcon({ type }) {
  if (type === 'critical') {
    return <span className="text-red-600 font-bold">🚨</span>
  }
  if (type === 'warning') {
    return <span className="text-yellow-600 font-bold">⚠️</span>
  }
  return <span className="text-blue-600 font-bold">ℹ️</span>
}
