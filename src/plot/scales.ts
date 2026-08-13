import type { Num } from '../engine/types.ts'

export interface Frame {
  /** data x to pixel x, within the plotting area */
  sx: (v: number) => number
  /** data y to pixel y */
  sy: (v: number) => number
  /** pixel x back to data x, for hover */
  ix: (px: number) => number
  iw: number
  ih: number
  xDomain: [number, number]
  yDomain: [number, number]
}

export function niceTicks(lo: number, hi: number, target = 6): number[] {
  if (!isFinite(lo) || !isFinite(hi) || hi <= lo) return []
  const raw = (hi - lo) / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v)
  }
  return out
}

/** Decade ticks, thinned so the labels do not collide over a wide range. */
export function decadeTicks(lo: number, hi: number, maxCount = 9): number[] {
  if (!(lo > 0) || !(hi > 0)) return []
  const a = Math.floor(Math.log10(lo))
  const b = Math.ceil(Math.log10(hi))
  const every = Math.max(1, Math.ceil((b - a + 1) / maxCount))
  const out: number[] = []
  for (let e = a; e <= b; e += every) {
    const v = Math.pow(10, e)
    if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v)
  }
  return out
}

export function formatTick(v: number): string {
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e5 || a < 1e-3) {
    const e = Math.round(Math.log10(a))
    if (Math.abs(a - Math.pow(10, e)) < Math.pow(10, e) * 1e-6) return `1e${e}`
    return v.toExponential(0)
  }
  if (Number.isInteger(v)) return String(v)
  return String(Number(v.toPrecision(3)))
}

export function padDomain([lo, hi]: [number, number], frac = 0.06): [number, number] {
  if (!isFinite(lo) || !isFinite(hi)) return [0, 1]
  if (hi === lo) return [lo - 0.5, hi + 0.5]
  const p = (hi - lo) * frac
  return [lo - p, hi + p]
}

/** Range of the finite values in one or more series. */
export function extent(...series: (readonly Num[] | undefined)[]): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (const s of series) {
    if (!s) continue
    for (const v of s) {
      if (v == null || !isFinite(v)) continue
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  return isFinite(lo) ? [lo, hi] : [0, 1]
}

/**
 * A polyline through (xs, ys).  Runs of missing values break the path rather
 * than being bridged, and values far outside the frame are clamped to a band
 * just off-screen so that a curve running off to infinity still leaves the
 * frame in the right direction instead of producing unusable path data.
 */
export function linePath(xs: readonly number[], ys: readonly Num[], f: Frame): string {
  const bound = f.ih * 12
  let out = ''
  let pen = false
  for (let i = 0; i < xs.length && i < ys.length; i++) {
    const y = ys[i]
    if (y == null || !isFinite(y)) {
      pen = false
      continue
    }
    const px = f.sx(xs[i])
    const py = Math.min(bound, Math.max(-bound, f.sy(y)))
    out += `${pen ? 'L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)}`
    pen = true
  }
  return out
}

/** Index of the sample nearest a data-space x. */
export function nearestIndex(xs: readonly number[], v: number): number {
  if (xs.length === 0) return -1
  let lo = 0
  let hi = xs.length - 1
  if (v <= xs[lo]) return lo
  if (v >= xs[hi]) return hi
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid] <= v) lo = mid
    else hi = mid
  }
  return v - xs[lo] <= xs[hi] - v ? lo : hi
}
