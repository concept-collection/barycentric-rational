import { useMemo, useState } from 'react'
import Plot from '../plot/Plot.tsx'
import Legend from '../plot/Legend.tsx'
import { diverging, ink, series } from '../plot/palette.ts'
import { extent, linePath, padDomain, type Frame } from '../plot/scales.ts'
import type { ExploreOut, Num } from '../engine/types.ts'

interface Props {
  out: ExploreOut
}

/** The samples of t lying in [lo, hi], as a slice of both arrays. */
function slice(t: number[], v: readonly Num[], lo: number, hi: number): [number[], Num[]] {
  const ts: number[] = []
  const vs: Num[] = []
  for (let i = 0; i < t.length; i++) {
    if (t[i] >= lo && t[i] <= hi) {
      ts.push(t[i])
      vs.push(v[i])
    }
  }
  return [ts, vs]
}

export default function BlendingPanel({ out }: Props) {
  const [pinned, setPinned] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)

  const P = out.P
  const L = out.L
  const wlo = out.wlo
  const whi = out.whi
  const m = P?.length ?? 0

  // which local polynomial the reader is following: the pinned one, or the one
  // whose window is nearest the pointer
  const hovered = useMemo(() => {
    if (!wlo || !whi || hoverX == null) return null
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < wlo.length; i++) {
      const dd = Math.abs((wlo[i] + whi[i]) / 2 - hoverX)
      if (dd < bestD) {
        bestD = dd
        best = i
      }
    }
    return best
  }, [wlo, whi, hoverX])
  const sel = pinned ?? hovered ?? Math.floor(m / 2)

  const xd: [number, number] = [out.t[0], out.t[out.t.length - 1]]
  const yd = padDomain(extent(out.ft, out.r), 0.12)
  const ld = useMemo(() => {
    if (!L) return [0, 1] as [number, number]
    const e = extent(...L)
    return [Math.max(-1.2, Math.min(-0.15, e[0] * 1.1)), Math.min(1.6, Math.max(1.05, e[1] * 1.05))] as [
      number,
      number,
    ]
  }, [L])

  if (!out.hasBlend || !P || !L || !wlo || !whi) {
    return (
      <div className="panel">
        <p className="panel-lede">
          This script does not define <code>local_blend</code>, so there is nothing to draw here. Equations (4)
          and (5) are optional: a script only has to supply <code>bary_weights</code> and{' '}
          <code>bary_eval</code>. The other three tabs still work.
        </p>
        {out.blendError && <pre className="error-box">{out.blendError}</pre>}
        <WeightsSection out={out} />
      </div>
    )
  }

  const shade = (f: Frame) => (
    <rect
      x={f.sx(wlo[sel])}
      width={Math.max(1, f.sx(whi[sel]) - f.sx(wlo[sel]))}
      y={0}
      height={f.ih}
      fill={ink.familyHi}
      opacity={0.1}
    />
  )

  return (
    <div className="panel">
      <p className="panel-lede">
        Equation (4) reads r = &Sigma;<sub>i</sub> &lambda;<sub>i</sub> p<sub>i</sub> / &Sigma;<sub>i</sub>{' '}
        &lambda;<sub>i</sub>: slide a window of d+1 = {out.d + 1} nodes along the data, fit a polynomial of
        degree {out.d} in each position, and blend the {m} of them together. Hover to follow one; click to pin
        it.
      </p>

      <div className="row-controls">
        <label className="slider-label">
          <span>
            window i = <b>{sel}</b> &nbsp;[x<sub>{sel}</sub>, x<sub>{sel + out.d}</sub>] = [
            {wlo[sel].toFixed(2)}, {whi[sel].toFixed(2)}]
          </span>
          <input
            type="range"
            min={0}
            max={m - 1}
            value={sel}
            onChange={(e) => setPinned(Number(e.target.value))}
          />
        </label>
        {pinned != null && (
          <button className="ghost" onClick={() => setPinned(null)}>
            unpin
          </button>
        )}
      </div>

      <Legend
        items={[
          { label: 'f(x)', color: ink.reference, dash: '5 4' },
          { label: 'rational r(x)', color: series.r },
          { label: `the ${m} local polynomials p_i`, color: ink.family },
          { label: `p_${sel}, on its own window`, color: ink.familyHi },
        ]}
      />

      <Plot
        height={300}
        xDomain={xd}
        yDomain={yd}
        xLabel="x"
        yLabel="f, r, local p_i"
        onHoverX={setHoverX}
        hoverX={hoverX}
        under={shade}
      >
        {(f) => (
          <>
            {P.map((row, i) => {
              // each p_i is only drawn a little beyond the d+1 points it
              // interpolates: a degree-d polynomial extrapolated across the
              // whole interval is a wall of noise
              const pad = Math.max((whi[i] - wlo[i]) * 0.35, (xd[1] - xd[0]) / (out.n * 2))
              const [ts, vs] = slice(out.t, row, wlo[i] - pad, whi[i] + pad)
              return i === sel ? null : (
                <path key={i} d={linePath(ts, vs, f)} fill="none" stroke={ink.family} strokeWidth={1.2} />
              )
            })}
            <path d={linePath(out.t, out.ft, f)} fill="none" stroke={ink.reference} strokeWidth={2} strokeDasharray="5 4" />
            <path d={linePath(out.t, out.r, f)} fill="none" stroke={series.r} strokeWidth={2.5} />
            {(() => {
              const pad = (whi[sel] - wlo[sel]) * 0.9 + (xd[1] - xd[0]) / (out.n * 2)
              const [ts, vs] = slice(out.t, P[sel], wlo[sel] - pad, whi[sel] + pad)
              return <path d={linePath(ts, vs, f)} fill="none" stroke={ink.familyHi} strokeWidth={2.5} />
            })()}
            {out.x.map((xv, i) => {
              const inWin = xv >= wlo[sel] - 1e-12 && xv <= whi[sel] + 1e-12
              return (
                <circle
                  key={i}
                  cx={f.sx(xv)}
                  cy={f.sy(out.y[i])}
                  r={inWin ? 4.2 : 3}
                  fill={inWin ? ink.familyHi : ink.node}
                  stroke="#151a21"
                  strokeWidth={1.5}
                />
              )
            })}
          </>
        )}
      </Plot>

      <h4 className="sub">Blending functions</h4>
      <p className="panel-note">
        The normalised &lambda;<sub>i</sub>, which sum to 1 at every x. Each one is close to 1 across its own
        window and decays away from it, but with a tail that oscillates in sign and never quite reaches zero:
        these functions have no local support, which the paper names as the price of the construction. What
        they do have is that their denominator never vanishes, so they are infinitely smooth.
      </p>
      <Plot
        height={220}
        xDomain={xd}
        yDomain={ld}
        xLabel="x"
        yLabel="normalised lambda_i"
        onHoverX={setHoverX}
        hoverX={hoverX}
        under={(f) => (
          <>
            {shade(f)}
            <line x1={0} x2={f.iw} y1={f.sy(0)} y2={f.sy(0)} stroke={ink.axis} strokeWidth={1} />
            <line
              x1={0}
              x2={f.iw}
              y1={f.sy(1)}
              y2={f.sy(1)}
              stroke={ink.axis}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          </>
        )}
      >
        {(f) => (
          <>
            {L.map((row, i) =>
              i === sel ? null : (
                <path key={i} d={linePath(out.t, row, f)} fill="none" stroke={ink.family} strokeWidth={1.2} />
              ),
            )}
            <path d={linePath(out.t, L[sel], f)} fill="none" stroke={ink.familyHi} strokeWidth={2.5} />
            {out.x.map((xv, i) => (
              <line
                key={i}
                x1={f.sx(xv)}
                x2={f.sx(xv)}
                y1={f.ih}
                y2={f.ih - 5}
                stroke={ink.node}
                strokeWidth={1.5}
              />
            ))}
          </>
        )}
      </Plot>

      <WeightsSection out={out} />
    </div>
  )
}

function WeightsSection({ out }: { out: ExploreOut }) {
  const wmax = Math.max(...out.w.map(Math.abs), Number.MIN_VALUE)
  const norm = out.w.map((v) => v / wmax)
  const spread = Math.max(...out.wscaled) / Math.min(...out.wscaled.filter((v) => v > 0))

  return (
    <>
      <h4 className="sub">Barycentric weights</h4>
      <p className="panel-note">
        The same interpolant, written in the form of equation (1) with the weights of equation (18). Schneider
        and Werner proved that a pole-free barycentric rational interpolant must have weights that alternate
        in sign; these {out.wAlternates ? 'do' : 'do not'}.
      </p>
      <Legend
        items={[
          { label: 'w_k > 0', color: diverging.pos },
          { label: 'w_k < 0', color: diverging.neg },
        ]}
      />
      <Plot
        height={170}
        xDomain={[out.x[0], out.x[out.x.length - 1]]}
        yDomain={[-1.15, 1.15]}
        xLabel="x_k"
        yLabel="w_k / max |w|"
        margin={{ l: 62 }}
        under={(f) => <line x1={0} x2={f.iw} y1={f.sy(0)} y2={f.sy(0)} stroke={ink.axis} strokeWidth={1} />}
      >
        {(f) =>
          norm.map((v, k) => (
            <g key={k}>
              <line
                x1={f.sx(out.x[k])}
                x2={f.sx(out.x[k])}
                y1={f.sy(0)}
                y2={f.sy(v)}
                stroke={v >= 0 ? diverging.pos : diverging.neg}
                strokeWidth={2}
              />
              <circle
                cx={f.sx(out.x[k])}
                cy={f.sy(v)}
                r={3}
                fill={v >= 0 ? diverging.pos : diverging.neg}
                stroke="#151a21"
                strokeWidth={1}
              />
            </g>
          ))
        }
      </Plot>

      {out.wIsInteger ? (
        <div className="weights-int">
          <div className="weights-int-head">
            &delta;<sub>k</sub> = |w<sub>k</sub>| / min |w|, which Section 4 predicts are integers on a uniform
            mesh:
          </div>
          <div className="weights-int-values">
            {out.wscaled.map((v, k) => (
              <span key={k}>{Math.round(v)}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="weights-int">
          <div className="weights-int-head">
            The weights are not integer multiples of the smallest one, so this is not a uniform mesh. Their
            magnitudes span a factor of {spread < 1e5 ? spread.toFixed(0) : spread.toExponential(1)}.
          </div>
        </div>
      )}
    </>
  )
}
