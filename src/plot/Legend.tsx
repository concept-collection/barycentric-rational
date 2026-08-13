import { ink } from './palette.ts'

export interface LegendItem {
  label: string
  color: string
  /** stroke-dasharray for a line swatch */
  dash?: string
  shape?: 'line' | 'dot' | 'cross'
  /** e.g. the max error for this series, shown after the label */
  value?: string
}

/**
 * Identity is never carried by colour alone: every series that appears in a
 * plot appears here too, and the ones the reader most needs are also labelled
 * directly on the plot.
 */
export default function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span className="legend-item" key={it.label}>
          <svg width={18} height={10} aria-hidden="true">
            {it.shape === 'dot' ? (
              <circle cx={9} cy={5} r={3.5} fill={it.color} stroke={ink.grid} strokeWidth={1} />
            ) : it.shape === 'cross' ? (
              <path d="M5 1 L13 9 M13 1 L5 9" stroke={it.color} strokeWidth={2} strokeLinecap="round" />
            ) : (
              <line
                x1={1}
                x2={17}
                y1={5}
                y2={5}
                stroke={it.color}
                strokeWidth={2}
                strokeDasharray={it.dash}
                strokeLinecap="round"
              />
            )}
          </svg>
          <span>{it.label}</span>
          {it.value && <span className="legend-value">{it.value}</span>}
        </span>
      ))}
    </div>
  )
}
