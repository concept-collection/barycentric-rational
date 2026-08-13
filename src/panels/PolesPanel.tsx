import { useState } from 'react'
import Plot from '../plot/Plot.tsx'
import Legend from '../plot/Legend.tsx'
import { ink, series, status } from '../plot/palette.ts'
import { extent, linePath, padDomain, type Frame } from '../plot/scales.ts'
import type { ExploreOut } from '../engine/types.ts'

interface Props {
  out: ExploreOut
  showClassical: boolean
  onToggleClassical: (on: boolean) => void
}

export default function PolesPanel({ out, showClassical, onToggleClassical }: Props) {
  const [hoverRoot, setHoverRoot] = useState<number | null>(null)
  const p = out.poles
  if (!p) return <div className="panel">Loading.</div>

  const xd: [number, number] = [p.t[0], p.t[p.t.length - 1]]
  const clean = p.realPoles.length === 0
  // a root counts as sitting on the real axis if its imaginary part is a
  // rounding error next to the interval it lives on
  const axisTol = (out.x[out.x.length - 1] - out.x[0]) * 1e-7
  const nOnAxis = p.rootsIm.filter((v) => Math.abs(v) <= axisTol).length

  const rootRange = Math.max(
    ...p.rootsRe.map((v) => Math.abs(v - (out.x[0] + out.x[out.x.length - 1]) / 2)),
    ...p.rootsIm.map(Math.abs),
    (out.x[out.x.length - 1] - out.x[0]) / 2,
  )
  const cx0 = (out.x[0] + out.x[out.x.length - 1]) / 2
  const cd: [number, number] = [cx0 - rootRange * 1.12, cx0 + rootRange * 1.12]
  const cyd: [number, number] = [-rootRange * 1.12, rootRange * 1.12]

  return (
    <div className="panel">
      <div className={`verdict ${clean ? 'good' : 'bad'}`}>
        <span className="verdict-mark" aria-hidden="true">
          {clean ? '✓' : '✕'}
        </span>
        <span>
          {clean ? (
            <>
              <b>No real poles.</b> The denominator keeps one sign across the whole real line, which is
              Theorem 1, and every one of its {p.rootsShown ? p.rootsRe.length : 'roots'} roots sits off the
              real axis.
            </>
          ) : (
            <>
              <b>
                {p.realPoles.length} real pole{p.realPoles.length === 1 ? '' : 's'}.
              </b>{' '}
              The denominator changes sign, so r blows up inside the interval. These weights are not the ones
              of equation (18).
            </>
          )}
        </span>
      </div>

      <p className="panel-lede">
        Writing r as a quotient of polynomials (equation 7) puts everything on the denominator s of equation
        (10). Its zeros are exactly the poles of r, so Theorem 1 amounts to the claim that s never crosses
        zero.
      </p>

      <h4 className="sub">The denominator on the real line</h4>
      <p className="panel-note">
        s(x) spans many orders of magnitude, so what is drawn is the signed n-th root of it. That leaves every
        sign and every zero exactly where it was, and brings the rest into a range that fits on a page. The
        range shown runs well past both ends of the interpolation interval, since Theorem 1 is a statement
        about all of <b>R</b>, not just [a, b].
      </p>
      <Plot
        height={200}
        xDomain={xd}
        yDomain={[-1.15, 1.15]}
        xLabel="x"
        yLabel="signed n-th root of s"
        margin={{ l: 74 }}
        under={(f) => (
          <>
            <rect
              x={f.sx(out.x[0])}
              width={f.sx(out.x[out.x.length - 1]) - f.sx(out.x[0])}
              y={0}
              height={f.ih}
              fill={ink.node}
              opacity={0.05}
            />
            <line x1={0} x2={f.iw} y1={f.sy(0)} y2={f.sy(0)} stroke={ink.axis} strokeWidth={1.5} />
          </>
        )}
      >
        {(f) => (
          <>
            <path d={linePath(p.t, p.u, f)} fill="none" stroke={series.r} strokeWidth={2.5} />
            {p.realPoles.map((xv, i) => (
              <g key={i}>
                <line
                  x1={f.sx(xv)}
                  x2={f.sx(xv)}
                  y1={0}
                  y2={f.ih}
                  stroke={status.critical}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                <path
                  d={`M${f.sx(xv) - 4} ${f.sy(0) - 4} L${f.sx(xv) + 4} ${f.sy(0) + 4} M${f.sx(xv) + 4} ${
                    f.sy(0) - 4
                  } L${f.sx(xv) - 4} ${f.sy(0) + 4}`}
                  stroke={status.critical}
                  strokeWidth={2}
                />
              </g>
            ))}
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

      <h4 className="sub">Where the roots actually are</h4>
      {p.rootsShown ? (
        <>
          <p className="panel-note">
            The {p.rootsRe.length} roots of s in the complex plane. Theorem 1 says none of them are real, so
            none of them touch the horizontal axis. The grey band is the interpolation interval; ticks on the
            axis are the nodes.
            {nOnAxis > 0 && ' Roots that have landed on the axis are marked with a cross.'}
          </p>
          <Legend
            items={[
              { label: 'root of s', color: series.r, shape: 'dot' },
              ...(nOnAxis > 0 ? [{ label: 'root on the real axis: a pole', color: status.critical, shape: 'cross' as const }] : []),
            ]}
          />
          <Plot
            height={300}
            xDomain={cd}
            yDomain={cyd}
            xLabel="Re"
            yLabel="Im"
            under={(f: Frame) => (
              <>
                <rect
                  x={f.sx(out.x[0])}
                  width={f.sx(out.x[out.x.length - 1]) - f.sx(out.x[0])}
                  y={0}
                  height={f.ih}
                  fill={ink.node}
                  opacity={0.05}
                />
                <line x1={0} x2={f.iw} y1={f.sy(0)} y2={f.sy(0)} stroke={ink.axis} strokeWidth={1.5} />
                <line x1={f.sx(0)} x2={f.sx(0)} y1={0} y2={f.ih} stroke={ink.grid} strokeWidth={1} />
              </>
            )}
            overlay={
              hoverRoot != null && (
                <div className="tooltip">
                  {p.rootsRe[hoverRoot].toPrecision(4)}
                  {p.rootsIm[hoverRoot] >= 0 ? ' + ' : ' − '}
                  {Math.abs(p.rootsIm[hoverRoot]).toPrecision(4)} i
                </div>
              )
            }
          >
            {(f) => (
              <>
                {out.x.map((xv, i) => (
                  <line
                    key={i}
                    x1={f.sx(xv)}
                    x2={f.sx(xv)}
                    y1={f.sy(0) - 4}
                    y2={f.sy(0) + 4}
                    stroke={ink.node}
                    strokeWidth={1.5}
                  />
                ))}
                {p.rootsRe.map((re, i) => {
                  const onAxis = Math.abs(p.rootsIm[i]) <= axisTol
                  return onAxis ? (
                    <path
                      key={i}
                      d={`M${f.sx(re) - 5} ${f.sy(p.rootsIm[i]) - 5} L${f.sx(re) + 5} ${
                        f.sy(p.rootsIm[i]) + 5
                      } M${f.sx(re) + 5} ${f.sy(p.rootsIm[i]) - 5} L${f.sx(re) - 5} ${f.sy(p.rootsIm[i]) + 5}`}
                      stroke={status.critical}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      onPointerEnter={() => setHoverRoot(i)}
                      onPointerLeave={() => setHoverRoot(null)}
                    />
                  ) : (
                    <circle
                      key={i}
                      cx={f.sx(re)}
                      cy={f.sy(p.rootsIm[i])}
                      r={hoverRoot === i ? 7 : 5}
                      fill={series.r}
                      stroke="#151a21"
                      strokeWidth={2}
                      onPointerEnter={() => setHoverRoot(i)}
                      onPointerLeave={() => setHoverRoot(null)}
                    />
                  )
                })}
              </>
            )}
          </Plot>
        </>
      ) : (
        <p className="panel-note">
          {out.n > 40
            ? 'Not drawn above n = 40: recovering roots from the coefficients of a polynomial of that degree is not reliable enough to be worth showing. The sign test above still holds at any n.'
            : 'The denominator reduces to a constant, so it has no roots at all — which is one way for an interpolant to have no poles. That is what the Lagrange weights of equation (2) do.'}
        </p>
      )}

      <h4 className="sub">The classical alternative</h4>
      <div className="row-controls">
        <label className="check">
          <input
            type="checkbox"
            checked={showClassical}
            onChange={(e) => onToggleClassical(e.target.checked)}
          />
          fit p<sub>M</sub> / q<sub>N</sub> with M + N = n
        </label>
      </div>
      <p className="panel-note">
        The construction the paper's introduction rejects: fit the same data with a quotient of polynomials of
        degrees M and N summing to n. It is a good approximation where it is finite, and there is no way to
        stop it putting poles wherever it likes.
      </p>
      {showClassical && p.classical ? (
        <>
          <Legend
            items={[
              { label: 'f(x)', color: ink.reference, dash: '5 4' },
              { label: 'rational r(x), this page', color: series.r },
              { label: 'classical p_M / q_N', color: series.classical },
              ...(p.classicalPoles && p.classicalPoles.length
                ? [{ label: 'its poles', color: status.critical, shape: 'cross' as const }]
                : []),
            ]}
          />
          <ClassicalPlot out={out} />
        </>
      ) : (
        <p className="panel-note muted">Turn it on to draw it.</p>
      )}
    </div>
  )
}

function ClassicalPlot({ out }: { out: ExploreOut }) {
  const p = out.poles!
  const xd: [number, number] = [p.t[0], p.t[p.t.length - 1]]
  const yd = padDomain(extent(out.ft, out.r), 0.45)
  const inView = (p.classicalPoles ?? []).filter((v) => v >= xd[0] && v <= xd[1])
  return (
    <>
      <Plot
        height={260}
        xDomain={xd}
        yDomain={yd}
        xLabel="x"
        yLabel="f, r, classical"
        under={(f) => (
          <rect
            x={f.sx(out.x[0])}
            width={f.sx(out.x[out.x.length - 1]) - f.sx(out.x[0])}
            y={0}
            height={f.ih}
            fill={ink.node}
            opacity={0.05}
          />
        )}
      >
        {(f) => (
          <>
            {inView.map((xv, i) => (
              <line
                key={i}
                x1={f.sx(xv)}
                x2={f.sx(xv)}
                y1={0}
                y2={f.ih}
                stroke={status.critical}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            ))}
            <path d={linePath(out.t, out.ft, f)} fill="none" stroke={ink.reference} strokeWidth={2} strokeDasharray="5 4" />
            <path d={linePath(p.t, p.classical!, f)} fill="none" stroke={series.classical} strokeWidth={2} />
            <path d={linePath(out.t, out.r, f)} fill="none" stroke={series.r} strokeWidth={2.5} />
            {out.x.map((xv, i) => (
              <circle
                key={i}
                cx={f.sx(xv)}
                cy={f.sy(out.y[i])}
                r={3}
                fill={ink.node}
                stroke="#151a21"
                strokeWidth={1.5}
              />
            ))}
          </>
        )}
      </Plot>
      <p className="panel-note">
        {inView.length === 0
          ? 'On this data it happens to have no poles in the window shown. Change n, or the function, or the nodes, and that is not something you can rely on.'
          : `${inView.length} real pole${inView.length === 1 ? '' : 's'} in the window, at ${inView
              .map((v) => v.toFixed(3))
              .join(', ')}.`}
      </p>
    </>
  )
}
