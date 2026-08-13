import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ink } from './palette.ts'
import { decadeTicks, formatTick, niceTicks, type Frame } from './scales.ts'

export interface PlotProps {
  height: number
  xDomain: [number, number]
  yDomain: [number, number]
  xLog?: boolean
  yLog?: boolean
  xLabel?: string
  yLabel?: string
  xTicks?: number[]
  yTicks?: number[]
  formatX?: (v: number) => string
  formatY?: (v: number) => string
  margin?: Partial<{ l: number; r: number; t: number; b: number }>
  /** drawn under the data, inside the frame but outside the clip */
  under?: (f: Frame) => ReactNode
  children: (f: Frame) => ReactNode
  /** enables the crosshair; called with the data x under the pointer, or null */
  onHoverX?: (x: number | null) => void
  /** data x at which to draw the crosshair (usually what onHoverX last gave) */
  hoverX?: number | null
  /** rendered as an absolutely positioned box over the plot */
  overlay?: ReactNode
}

const DEFAULT_MARGIN = { l: 54, r: 14, t: 10, b: 30 }

/** Measures its own width so plots reflow with the panel. */
function useWidth(): [(el: HTMLDivElement | null) => void, number] {
  const [width, setWidth] = useState(640)
  const obs = useRef<ResizeObserver | null>(null)
  const ref = useCallback((el: HTMLDivElement | null) => {
    obs.current?.disconnect()
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setWidth(w)
    })
    ro.observe(el)
    obs.current = ro
    setWidth(el.clientWidth || 640)
  }, [])
  useEffect(() => () => obs.current?.disconnect(), [])
  return [ref, width]
}

export default function Plot(props: PlotProps) {
  const {
    height,
    xDomain,
    yDomain,
    xLog = false,
    yLog = false,
    xLabel,
    yLabel,
    formatX = formatTick,
    formatY = formatTick,
    under,
    children,
    onHoverX,
    hoverX,
    overlay,
  } = props
  const m = { ...DEFAULT_MARGIN, ...props.margin }
  const [hostRef, width] = useWidth()
  const clipId = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)

  const iw = Math.max(10, width - m.l - m.r)
  const ih = Math.max(10, height - m.t - m.b)

  const fwd = (v: number, [lo, hi]: [number, number], log: boolean, span: number, flip: boolean) => {
    const t = log
      ? (Math.log10(Math.max(v, Number.MIN_VALUE)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))
      : (v - lo) / (hi - lo)
    return flip ? span * (1 - t) : span * t
  }

  const f: Frame = {
    sx: (v) => fwd(v, xDomain, xLog, iw, false),
    sy: (v) => fwd(v, yDomain, yLog, ih, true),
    ix: (px) => {
      const t = px / iw
      return xLog
        ? Math.pow(10, Math.log10(xDomain[0]) + t * (Math.log10(xDomain[1]) - Math.log10(xDomain[0])))
        : xDomain[0] + t * (xDomain[1] - xDomain[0])
    },
    iw,
    ih,
    xDomain,
    yDomain,
  }

  const xt = props.xTicks ?? (xLog ? decadeTicks(xDomain[0], xDomain[1]) : niceTicks(xDomain[0], xDomain[1], 7))
  const yt = props.yTicks ?? (yLog ? decadeTicks(yDomain[0], yDomain[1]) : niceTicks(yDomain[0], yDomain[1], 5))

  const pointer = (e: React.PointerEvent) => {
    if (!onHoverX) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = e.clientX - rect.left - m.l
    onHoverX(px < -4 || px > iw + 4 ? null : f.ix(Math.min(iw, Math.max(0, px))))
  }

  return (
    <div className="plot-host" ref={hostRef}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        onPointerMove={pointer}
        onPointerLeave={() => onHoverX?.(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={iw} height={ih} />
          </clipPath>
        </defs>
        <g transform={`translate(${m.l},${m.t})`}>
          {/* gridlines, recessive */}
          {xt.map((v) => (
            <line key={`gx${v}`} x1={f.sx(v)} x2={f.sx(v)} y1={0} y2={ih} stroke={ink.grid} strokeWidth={1} />
          ))}
          {yt.map((v) => (
            <line key={`gy${v}`} x1={0} x2={iw} y1={f.sy(v)} y2={f.sy(v)} stroke={ink.grid} strokeWidth={1} />
          ))}

          {under?.(f)}

          <g clipPath={`url(#${clipId})`}>{children(f)}</g>

          {hoverX != null && hoverX >= Math.min(...xDomain) && hoverX <= Math.max(...xDomain) && (
            <line
              x1={f.sx(hoverX)}
              x2={f.sx(hoverX)}
              y1={0}
              y2={ih}
              stroke={ink.secondary}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.7}
              pointerEvents="none"
            />
          )}

          {/* axes */}
          <line x1={0} x2={iw} y1={ih} y2={ih} stroke={ink.axis} strokeWidth={1} />
          <line x1={0} x2={0} y1={0} y2={ih} stroke={ink.axis} strokeWidth={1} />
          {xt.map((v) => (
            <text
              key={`tx${v}`}
              x={f.sx(v)}
              y={ih + 15}
              fill={ink.muted}
              fontSize={11}
              textAnchor="middle"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatX(v)}
            </text>
          ))}
          {yt.map((v) => (
            <text
              key={`ty${v}`}
              x={-7}
              y={f.sy(v) + 4}
              fill={ink.muted}
              fontSize={11}
              textAnchor="end"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatY(v)}
            </text>
          ))}
          {xLabel && (
            <text x={iw} y={ih + 27} fill={ink.muted} fontSize={11} textAnchor="end">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text x={-m.l + 4} y={-1} fill={ink.muted} fontSize={11} textAnchor="start">
              {yLabel}
            </text>
          )}
        </g>
      </svg>
      {overlay}
    </div>
  )
}
