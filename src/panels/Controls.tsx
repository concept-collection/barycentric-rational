import type { FuncName, NodeKind } from '../engine/types.ts'

export interface Settings {
  f: FuncName
  fexpr: string
  a: number
  b: number
  n: number
  d: number
  nodes: NodeKind
  seed: number
}

const FUNCS: { id: FuncName; label: string; hint: string }[] = [
  { id: 'runge', label: '1 / (1 + x²)', hint: "Runge's example, the paper's Figure 1" },
  { id: 'sine', label: 'sin x', hint: 'Figure 2, smooth everywhere' },
  { id: 'abs', label: '|x|', hint: 'Figure 3, a corner at 0' },
  { id: 'custom', label: 'custom', hint: 'any MATLAB expression in x' },
]

const NODES: { id: NodeKind; label: string; hint: string }[] = [
  { id: 'uniform', label: 'uniform', hint: 'equally spaced, as in every figure of the paper' },
  { id: 'chebyshev', label: 'Chebyshev', hint: 'clustered at both ends' },
  { id: 'random', label: 'random', hint: 'sorted uniform draws, endpoints kept' },
  { id: 'paired', label: 'paired', hint: 'every second node pulled close to its neighbour' },
  { id: 'graded', label: 'graded', hint: 'quadratically clustered at the left end' },
]

interface Props {
  value: Settings
  onChange: (patch: Partial<Settings>) => void
  /** the convergence tab sets n itself */
  showN: boolean
  busy: boolean
}

export default function Controls({ value: v, onChange, showN, busy }: Props) {
  const dMax = Math.min(v.n, 12)
  return (
    <div className="controls">
      <div className="field">
        <span className="field-label">function f</span>
        <div className="chips">
          {FUNCS.map((fn) => (
            <button
              key={fn.id}
              title={fn.hint}
              className={`chip ${v.f === fn.id ? 'on' : ''}`}
              onClick={() => onChange({ f: fn.id })}
            >
              {fn.label}
            </button>
          ))}
        </div>
      </div>

      {v.f === 'custom' && (
        <div className="field grow">
          <span className="field-label">f(x) =</span>
          <input
            className="expr"
            value={v.fexpr}
            spellCheck={false}
            placeholder="exp(-x.^2) .* cos(3*x)"
            onChange={(e) => onChange({ fexpr: e.target.value })}
          />
        </div>
      )}

      <div className="field">
        <span className="field-label">interval</span>
        <div className="interval">
          <input
            type="number"
            value={v.a}
            step={1}
            onChange={(e) => {
              const a = Number(e.target.value)
              if (isFinite(a) && a < v.b) onChange({ a })
            }}
          />
          <span>to</span>
          <input
            type="number"
            value={v.b}
            step={1}
            onChange={(e) => {
              const b = Number(e.target.value)
              if (isFinite(b) && b > v.a) onChange({ b })
            }}
          />
        </div>
      </div>

      {showN && (
        <div className="field grow">
          <span className="field-label">
            nodes n = <b>{v.n}</b>
          </span>
          <input
            type="range"
            min={2}
            max={80}
            value={v.n}
            disabled={busy}
            onChange={(e) => {
              const n = Number(e.target.value)
              onChange({ n, d: Math.min(v.d, Math.min(n, 12)) })
            }}
          />
        </div>
      )}

      <div className="field grow">
        <span className="field-label">
          blend degree d = <b>{v.d}</b>
        </span>
        <input
          type="range"
          min={0}
          max={dMax}
          value={Math.min(v.d, dMax)}
          disabled={busy}
          onChange={(e) => onChange({ d: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <span className="field-label">node distribution</span>
        <div className="chips">
          {NODES.map((nd) => (
            <button
              key={nd.id}
              title={nd.hint}
              className={`chip ${v.nodes === nd.id ? 'on' : ''}`}
              onClick={() => onChange({ nodes: nd.id })}
            >
              {nd.label}
            </button>
          ))}
          {v.nodes === 'random' && (
            <button className="chip" onClick={() => onChange({ seed: v.seed + 1 })} title="new draw">
              reroll
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
