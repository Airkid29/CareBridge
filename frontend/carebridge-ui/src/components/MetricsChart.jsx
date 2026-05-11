import React from 'react'

export default function MetricsChart({ data }) {
  const maxValue = Math.max(...data.map(d => d.value))
  
  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="w-20 text-sm text-slate-600">{item.label}</div>
          <div className="flex-1 bg-slate-200 rounded-full h-3">
            <div 
              className="bg-blue-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
          <div className="w-12 text-sm font-semibold text-slate-900">{item.value}%</div>
        </div>
      ))}
    </div>
  )
}
