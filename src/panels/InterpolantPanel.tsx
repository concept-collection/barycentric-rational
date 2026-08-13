import { useState } from 'react'
import Plot from '../plot/Plot.tsx'
import Legend, { type LegendItem } from '../plot/Legend.tsx'
import { ink, series } from '../plot/palette.ts'
import { extent, linePath, nearestIndex, padDomain, type Frame } from '../plot/scales.ts'
import type { ExploreOut, Num } from '../engine/types.ts'

interface Props {
  out: ExploreOut
  showPoly: boolean
  showSpline: boolean
  onToggle: (which: 'poly' | 'spline', on: boolean) => void
}

function fmtErr(v: Num): string {
  if (v == null || !isFinite(v)) return 'off scale'
  if (v === 0) return '0'
  return v.toExponential(1)
}

/** Largest |value| of a series, ignoring the parts that ran off to infinity. */
function maxAbs(v: readonly Num[] | undefined, ref: readonly number[]): Num {
  if (!v) return null
  let m = 0
  let any = false
  for (let i = 0; i < v.length; i++) {
    const d = v[i]
    if (d == null || !isFinite(d)) continue
    any = true
    m = Math.max(m, Math.abs(d - ref[i]))
  }
  return any ? m : null
}

export default function InterpolantPanel({ out, showPoly, showSpline, onToggle }: Props) {
  const [hoverX, setHoverX] = useState<number | null>(null)

  // The polynomial interpolant at equispaced nodes is the whole point of the
  // paper's opening paragraph, and at n = 40 it is off scale by a factor of
  // 10^8.  Scale the axis to f and to r, and let the rest leave the frame.
  const yd = padDomain(extent(out.ft, out.r, showSpline ? out.rspline : undefined), 0.1)
  const errOf = (v: readonly Num[] | undefined): Num[] | undefined =>
    v ? v.map((d, i) => (d == null ? null : d - out.ft[i])) : undefined
  const errPoly = showPoly ? errOf(out.rpoly) : undefined
  const errSpline = showSpline ? errOf(out.rspline) : undefined
  const eAll = extent(out.err, errPoly, errSpline)
  const eMax = Math.max(Math.abs(eAll[0]), Math.abs(eAll[1]), 1e-16)
  const ed: [number, number] = [-eMax * 1.1, eMax * 1.1]

  const hi = hoverX == null ? -1 : nearestIndex(out.t, hoverX)
  const at = (v: readonly Num[] | undefined) => (v && hi >= 0 ? v[hi] : null)

  const legend: LegendItem[] = [
    { label: 'f(x)', color: ink.reference, dash: '5 4', value: undefined },
    { label: 'rational r(x)', color: series.r, value: fmtErr(out.maxerr) },
  ]
  if (showPoly) {
    legend.push({
      label: `polynomial (degree ${out.n})`,
      color: series.poly,
      value: fmtErr(maxAbs(out.rpoly, out.ft)),
    })
  }
  if (showSpline) {
    legend.push({ label: 'cubic spline', color: series.spline, value: fmtErr(maxAbs(out.rspline, out.ft)) })
  }
  legend.push({ label: `${out.n + 1} nodes`, color: ink.node, shape: 'dot' })

  const nodes = (f: Frame) =>
    out.x.map((xv, i) => (
      <circle
        key={i}
        cx={f.sx(xv)}
        cy={f.sy(out.y[i])}
        r={3.2}
        fill={ink.node}
        stroke="#151a21"
        strokeWidth={1.5}
      />
    ))

  return (
    <div className="panel">
      <p className="panel-lede">
        The rational interpolant r of equation (1) through {out.n + 1} nodes, with blend degree d = {out.d}.
        Turn on the degree-{out.n} polynomial to see what the paper's first page is about, and the clamped
        C<sup>2</sup> cubic spline for the comparison of Tables 3 and 4.
      </p>

      <div className="row-controls">
        <label className="check">
          <input type="checkbox" checked={showPoly} onChange={(e) => onToggle('poly', e.target.checked)} />
          polynomial interpolant
        </label>
        <label className="check">
          <input type="checkbox" checked={showSpline} onChange={(e) => onToggle('spline', e.target.checked)} />
          cubic spline
        </label>
      </div>

      <Legend items={legend} />

      <Plot
        height={330}
        xDomain={[out.t[0], out.t[out.t.length - 1]]}
        yDomain={yd}
        xLabel="x"
        yLabel="f, r"
        onHoverX={setHoverX}
        hoverX={hoverX}
      >
        {(f) => (
          <>
            <path d={linePath(out.t, out.ft, f)} fill="none" stroke={ink.reference} strokeWidth={2} strokeDasharray="5 4" />
            {showSpline && out.rspline && (
              <path d={linePath(out.t, out.rspline, f)} fill="none" stroke={series.spline} strokeWidth={2} />
            )}
            {showPoly && out.rpoly && (
              <path d={linePath(out.t, out.rpoly, f)} fill="none" stroke={series.poly} strokeWidth={2} />
            )}
            <path d={linePath(out.t, out.r, f)} fill="none" stroke={series.r} strokeWidth={2.5} />
            {nodes(f)}
          </>
        )}
      </Plot>

      {hi >= 0 && (
        <div className="readout">
          <span>
            x = <b>{out.t[hi].toFixed(3)}</b>
          </span>
          <span style={{ color: ink.reference }}>
            f = <b>{out.ft[hi].toFixed(6)}</b>
          </span>
          <span style={{ color: series.r }}>
            r = <b>{at(out.r)?.toFixed(6) ?? '-'}</b>
          </span>
          {showPoly && (
            <span style={{ color: series.poly }}>
              poly = <b>{fmtSigned(at(out.rpoly))}</b>
            </span>
          )}
          {showSpline && (
            <span style={{ color: series.spline }}>
              spline = <b>{at(out.rspline)?.toFixed(6) ?? '-'}</b>
            </span>
          )}
        </div>
      )}

      <h4 className="sub">Error</h4>
      <p className="panel-note">
        r(x) &minus; f(x) on the same grid. It vanishes at every node, by construction, and the largest of
        the bumps between them is the number Tables 1 to 4 tabulate.
      </p>
      <Plot
        height={190}
        xDomain={[out.t[0], out.t[out.t.length - 1]]}
        yDomain={ed}
        xLabel="x"
        yLabel="r - f"
        onHoverX={setHoverX}
        hoverX={hoverX}
        under={(f) => <line x1={0} x2={f.iw} y1={f.sy(0)} y2={f.sy(0)} stroke={ink.axis} strokeWidth={1} />}
      >
        {(f) => (
          <>
            {errSpline && <path d={linePath(out.t, errSpline, f)} fill="none" stroke={series.spline} strokeWidth={1.5} />}
            {errPoly && <path d={linePath(out.t, errPoly, f)} fill="none" stroke={series.poly} strokeWidth={1.5} />}
            <path d={linePath(out.t, out.err, f)} fill="none" stroke={series.r} strokeWidth={2} />
            {out.x.map((xv, i) => (
              <circle key={i} cx={f.sx(xv)} cy={f.sy(0)} r={2.2} fill={ink.node} stroke="#151a21" strokeWidth={1} />
            ))}
          </>
        )}
      </Plot>
    </div>
  )
}

function fmtSigned(v: Num): string {
  if (v == null || !isFinite(v)) return 'off scale'
  if (Math.abs(v) >= 1e5) return v.toExponential(2)
  return v.toFixed(6)
}
