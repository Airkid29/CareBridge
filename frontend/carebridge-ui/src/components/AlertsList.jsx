// components/AlertsList.jsx
import AlertIcon from './AlertIcon'

export default function AlertsList({ alerts, type, title }) {
  const bgColor = type === 'critical' ? 'bg-red-50' : 'bg-yellow-50'
  const borderColor = type === 'critical' ? 'border-red-300' : 'border-yellow-300'
  const textColor = type === 'critical' ? 'text-red-900' : 'text-yellow-900'
  const badgeColor = type === 'critical' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'

  return (
    <div className={`${bgColor} border-l-4 ${borderColor} rounded-lg p-6`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-xl font-bold ${textColor}`}>{title}</h3>
        <span className={`${badgeColor} rounded-full px-3 py-1 text-xs font-semibold`}>{type === 'critical' ? 'CRITICAL' : 'ALERT'}</span>
      </div>
      <ul className="space-y-3">
        {alerts.map((alert, i) => (
          <li key={i} className={`${textColor} text-sm leading-relaxed`}>
            <div className="flex items-start gap-3">
              <AlertIcon type={type} />
              <div>
                <p className="font-semibold">{alert}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
