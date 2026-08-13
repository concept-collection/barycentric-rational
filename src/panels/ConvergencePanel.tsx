import Plot from '../plot/Plot.tsx'
import Legend, { type LegendItem } from '../plot/Legend.tsx'
import { dColor, ink, series } from '../plot/palette.ts'
import { linePath, type Frame } from '../plot/scales.ts'
import type { ConvergeOut, FuncName, NodeKind, Num } from '../engine/types.ts'

interface Props {
  out: ConvergeOut | null
  running: boolean
  stale: boolean
  f: FuncName
  nodes: NodeKind
  ds: number[]
  maxN: number
  showSpline: boolean
  showPoly: boolean
  onChange: (patch: { ds?: number[]; maxN?: number; showSpline?: boolean; showPoly?: boolean }) => void
  onRun: () => void
}

const D_CHOICES = [0, 1, 2, 3, 4, 5, 6, 8]
const N_CHOICES = [80, 160, 320, 640]

const fmt = (v: Num) => (v == null || !isFinite(v) ? '-' : v.toExponential(1))
const fmtOrd = (v: Num) => (v == null || !isFinite(v) ? '' : v.toFixed(1))

const F_LABEL: Record<FuncName, string> = {
  runge: '1 / (1 + x²)',
  sine: 'sin x',
  abs: '|x|',
  custom: 'the custom function',
}

export default function ConvergencePanel(props: Props) {
  const { out, running, stale, f, nodes, ds, maxN, showSpline, showPoly, onChange, onRun } = props

  const toggleD = (d: number) => {
    const next = ds.includes(d) ? ds.filter((v) => v !== d) : [...ds, d].sort((a, b) => a - b)
    if (next.length > 0 && next.length <= 6) onChange({ ds: next })
  }

  return (
    <div className="panel">
      <p className="panel-lede">
        Theorem 2: for d &ge; 1 the error is O(h<sup>d+1</sup>) as h &rarr; 0, whatever the nodes look like,
        provided f is smooth enough. On log-log axes that is a straight line of slope &minus;(d+1), and the
        slopes measured between consecutive n are printed in the table. With uniform nodes and Runge's
        function this reproduces Table 1; turn the spline on for Tables 3 and 4. Currently fitting{' '}
        <b>{F_LABEL[f]}</b> on <b>{nodes}</b> nodes.
      </p>

      <div className="conv-controls">
        <div className="field">
          <span className="field-label">blend degrees d</span>
          <div className="chips">
            {D_CHOICES.map((d) => (
              <button
                key={d}
                className={`chip ${ds.includes(d) ? 'on' : ''}`}
                onClick={() => toggleD(d)}
                disabled={running}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">largest n</span>
          <div className="chips">
            {N_CHOICES.map((n) => (
              <button
                key={n}
                className={`chip ${maxN === n ? 'on' : ''}`}
                onClick={() => onChange({ maxN: n })}
                disabled={running}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">compare with</span>
          <div className="chips">
            <button
              className={`chip ${showSpline ? 'on' : ''}`}
              onClick={() => onChange({ showSpline: !showSpline })}
              disabled={running}
            >
              cubic spline
            </button>
            <button
              className={`chip ${showPoly ? 'on' : ''}`}
              onClick={() => onChange({ showPoly: !showPoly })}
              disabled={running}
            >
              polynomial
            </button>
          </div>
        </div>
        <button className="primary" onClick={onRun} disabled={running}>
          {running ? 'Running…' : out == null ? 'Run study ▶' : 'Re-run ▶'}
        </button>
      </div>

      {!out ? (
        <p className="panel-note muted">
          The study refits the interpolant at every n and every d, so it is the one thing on this page that
          does not run on its own. Press Run.
        </p>
      ) : (
        <ConvergenceChart out={out} showSpline={showSpline} showPoly={showPoly} stale={stale} />
      )}
    </div>
  )
}

function ConvergenceChart({
  out,
  showSpline,
  showPoly,
  stale,
}: {
  out: ConvergeOut
  showSpline: boolean
  showPoly: boolean
  stale: boolean
}) {
  const all: Num[] = [
    ...out.E.flat(),
    ...(showSpline ? (out.splineErr ?? []) : []),
    ...(showPoly ? (out.polyErr ?? []) : []),
  ]
  const finite = all.filter((v): v is number => v != null && isFinite(v) && v > 0)
  const lo = Math.min(...finite)
  const hi = Math.max(...finite)
  const yd: [number, number] = [Math.pow(10, Math.floor(Math.log10(lo)) - 0.3), Math.pow(10, Math.ceil(Math.log10(hi)) + 0.3)]
  const xd: [number, number] = [out.ns[0] * 0.85, out.ns[out.ns.length - 1] * 1.35]

  const legend: LegendItem[] = out.ds.map((d, i) => ({
    label: `d = ${d}`,
    color: dColor(i, out.ds.length),
  }))
  if (showPoly && out.polyErr) legend.push({ label: 'polynomial (d = n)', color: series.poly })
  if (showSpline && out.splineErr) legend.push({ label: 'cubic spline', color: series.spline })

  const dots = (f: Frame, vals: Num[], color: string) =>
    vals.map((v, j) =>
      v == null || !isFinite(v) || v <= 0 ? null : (
        <circle key={j} cx={f.sx(out.ns[j])} cy={f.sy(v)} r={3.5} fill={color} stroke="#151a21" strokeWidth={1.5} />
      ),
    )

  /** the label goes at the right end of the curve, on its last finite point */
  const endLabel = (f: Frame, vals: Num[], color: string, text: string) => {
    for (let j = vals.length - 1; j >= 0; j--) {
      const v = vals[j]
      if (v != null && isFinite(v) && v > 0) {
        return (
          <text x={f.sx(out.ns[j]) + 8} y={f.sy(v) + 4} fill={color} fontSize={11} fontWeight={600}>
            {text}
          </text>
        )
      }
    }
    return null
  }

  return (
    <>
      {stale && <div className="stale-note">Showing the previous study — the settings have changed since.</div>}
      <Legend items={legend} />
      <Plot
        height={360}
        xDomain={xd}
        yDomain={yd}
        xLog
        yLog
        xLabel="n"
        yLabel="max |r - f|"
        margin={{ l: 62, r: 58 }}
        xTicks={out.ns}
        formatX={(v) => String(Math.round(v))}
      >
        {(f) => (
          <>
            {showPoly && out.polyErr && (
              <>
                <path d={linePath(out.ns, out.polyErr, f)} fill="none" stroke={series.poly} strokeWidth={2} />
                {dots(f, out.polyErr, series.poly)}
                {endLabel(f, out.polyErr, series.poly, 'poly')}
              </>
            )}
            {showSpline && out.splineErr && (
              <>
                <path d={linePath(out.ns, out.splineErr, f)} fill="none" stroke={series.spline} strokeWidth={2} />
                {dots(f, out.splineErr, series.spline)}
                {endLabel(f, out.splineErr, series.spline, 'spline')}
              </>
            )}
            {out.E.map((row, i) => {
              const c = dColor(i, out.ds.length)
              return (
                <g key={i}>
                  <path d={linePath(out.ns, row, f)} fill="none" stroke={c} strokeWidth={2.5} />
                  {dots(f, row, c)}
                  {endLabel(f, row, c, `d = ${out.ds[i]}`)}
                </g>
              )
            })}
          </>
        )}
      </Plot>

      <h4 className="sub">The same numbers</h4>
      <div className="table-wrap">
        <table className="conv-table">
          <thead>
            <tr>
              <th>n</th>
              {out.ds.map((d) => (
                <th key={d} colSpan={2}>
                  d = {d}
                </th>
              ))}
              {showSpline && out.splineErr && <th colSpan={2}>cubic spline</th>}
              {showPoly && out.polyErr && <th>polynomial</th>}
            </tr>
            <tr className="sub-head">
              <th />
              {out.ds.map((d) => [
                <th key={`e${d}`}>error</th>,
                <th key={`o${d}`}>order</th>,
              ])}
              {showSpline && out.splineErr && [<th key="se">error</th>, <th key="so">order</th>]}
              {showPoly && out.polyErr && <th>error</th>}
            </tr>
          </thead>
          <tbody>
            {out.ns.map((n, j) => (
              <tr key={n}>
                <td className="n-cell">{n}</td>
                {out.ds.map((d, i) => [
                  <td key={`e${d}`}>{fmt(out.E[i][j])}</td>,
                  <td key={`o${d}`} className="ord">
                    {fmtOrd(out.orders[i][j])}
                  </td>,
                ])}
                {showSpline && out.splineErr && [
                  <td key="se">{fmt(out.splineErr[j])}</td>,
                  <td key="so" className="ord">
                    {fmtOrd(out.splineOrders?.[j] ?? null)}
                  </td>,
                ]}
                {showPoly && out.polyErr && <td>{fmt(out.polyErr[j])}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="panel-note" style={{ color: ink.muted }}>
        The order column is log(e<sub>prev</sub> / e) / log(n / n<sub>prev</sub>), so d + 1 is what Theorem 2
        predicts for d &ge; 1. Where a row of errors stops falling, it has reached the point at which the
        weights themselves, which grow like h<sup>&minus;d</sup>, cost more accuracy than the higher order
        buys.
      </p>
    </>
  )
}
