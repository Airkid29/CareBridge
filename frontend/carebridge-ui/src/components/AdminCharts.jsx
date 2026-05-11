import React from 'react'

function pointsToPath(points) {
  if (!points.length) return ''
  const [x0, y0] = points[0]
  const rest = points.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ')
  return `M ${x0} ${y0} ${rest}`
}

function normalizeSeries(values, innerW, innerH, padX, padY) {
  const n = values.length
  if (n === 0) return []
  if (n === 1) return [[padX, padY + innerH / 2]]
  const vmax = Math.max(...values)
  const vmin = Math.min(...values)
  const span = Math.max(vmax - vmin, 1e-6)
  return values.map((v, i) => {
    const x = padX + (i / (n - 1)) * innerW
    const y = padY + innerH - ((v - vmin) / span) * innerH
    return [x, y]
  })
}

/** Two normalized lines + optional area fill under series A */
export function AdminDualLineChart({ labels, seriesA, seriesB, legendA, legendB }) {
  if (!labels?.length || !seriesA?.length) return null
  const W = 720
  const H = 240
  const padX = 44
  const padY = 28
  const padBottom = 52
  const innerW = W - padX * 2
  const innerH = H - padY - padBottom

  const ptsA = normalizeSeries(seriesA, innerW, innerH, padX, padY)
  const ptsB = normalizeSeries(seriesB, innerW, innerH, padX, padY)
  const pathA = pointsToPath(ptsA)
  const pathB = pointsToPath(ptsB)

  const areaPath =
    ptsA.length > 1
      ? `${pathA} L ${ptsA[ptsA.length - 1][0]} ${padY + innerH} L ${ptsA[0][0]} ${padY + innerH} Z`
      : ''

  const labelXs = labels.map((_, i) => padX + (i / Math.max(labels.length - 1, 1)) * innerW)

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[320px] h-56" role="img" aria-label="Weekly trends chart">
        <defs>
          <linearGradient id="adminAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="#fafafa" rx="12" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={W - padX}
            y1={padY + innerH * t}
            y2={padY + innerH * t}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}
        {areaPath ? <path d={areaPath} fill="url(#adminAreaGrad)" /> : null}
        <path d={pathA} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathB} fill="none" stroke="#0d9488" strokeWidth="3" strokeDasharray="8 6" strokeLinecap="round" />
        {ptsA.map(([x, y], i) => (
          <circle key={`a-${i}`} cx={x} cy={y} r="5" fill="#4f46e5" stroke="#fff" strokeWidth="2" />
        ))}
        {labels.map((lab, i) => (
          <text
            key={lab}
            x={labelXs[i]}
            y={H - 18}
            textAnchor="middle"
            className="fill-slate-500"
            style={{ fontSize: '12px' }}
          >
            {lab}
          </text>
        ))}
        <g transform={`translate(${padX}, 12)`}>
          <rect width="12" height="12" fill="#4f46e5" rx="2" />
          <text x="18" y="11" style={{ fontSize: '12px' }} className="fill-slate-700 font-medium">
            {legendA}
          </text>
          <rect x="200" width="12" height="12" fill="#0d9488" rx="2" />
          <text x="218" y="11" style={{ fontSize: '12px' }} className="fill-slate-700 font-medium">
            {legendB}
          </text>
        </g>
      </svg>
    </div>
  )
}

export function AdminRoleBarChart({ distribution }) {
  if (!distribution) return null
  const entries = Object.entries(distribution).filter(([, v]) => v > 0)
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1
  const colors = {
    admin: 'bg-rose-500',
    clinician: 'bg-indigo-500',
    staff: 'bg-slate-500',
  }
  return (
    <div className="space-y-4">
      {entries.map(([role, count]) => (
        <div key={role}>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-slate-700 capitalize">{role}</span>
            <span className="text-slate-500">
              {count} ({Math.round((count / total) * 100)}%)
            </span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${colors[role] || 'bg-slate-400'}`}
              style={{ width: `${(count / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdminSparkBars({ values, labels, title, colorClass = 'bg-indigo-500' }) {
  if (!values?.length) return null
  const max = Math.max(...values, 1)
  return (
    <div>
      {title ? <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</p> : null}
      <div className="flex items-end gap-1.5 h-24">
        {values.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full max-w-[28px] rounded-t-md ${colorClass} opacity-90 hover:opacity-100 transition-all`}
              style={{ height: `${(v / max) * 100}%`, minHeight: '4px' }}
              title={`${labels?.[i] || i}: ${v}`}
            />
            <span className="text-[10px] text-slate-400 truncate max-w-full">{labels?.[i] || i}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminDonutChart({ segments, size = 160 }) {
  if (!segments?.length) return null
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.36
  const innerR = r * 0.58
  let angle = -Math.PI / 2
  const arcs = []
  segments.forEach((seg, idx) => {
    const sweep = (seg.value / total) * Math.PI * 2
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle)
    const y2 = cy + r * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    arcs.push(
      <path
        key={idx}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
        fill={seg.color}
        opacity={0.92}
      />,
    )
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {arcs}
      <circle cx={cx} cy={cy} r={innerR} fill="#fff" />
      <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-800 text-sm font-bold">
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-slate-500" style={{ fontSize: '10px' }}>
        users
      </text>
    </svg>
  )
}
