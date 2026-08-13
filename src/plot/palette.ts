// Colours, assigned by the job each one does.  Validated against the dark chart
// surface #151a21 with the data-viz validator:
//
//   categorical, all pairs   r / polynomial / spline      worst CVD dE 9.4
//   categorical, all pairs   r / classical rational       worst CVD dE 27.4
//   ordinal ramp             the six steps of dRamp       monotone L, gaps ok
//   diverging pair           positive / negative weights  worst CVD dE 19.2
//
// Every colour is a documented step from the reference palette; none are
// eyeballed.

export const surface = '#151a21'

/** Identity: which interpolant a curve is.  Fixed slots, never reassigned. */
export const series = {
  /** the Floater-Hormann rational interpolant */
  r: '#3987e5',
  /** the degree-n polynomial interpolant */
  poly: '#d95926',
  /** the clamped C^2 cubic spline */
  spline: '#199e70',
  /** the classical rational interpolant p_M / q_N */
  classical: '#c98500',
} as const

/** Polarity: the sign of a barycentric weight. */
export const diverging = {
  pos: '#3987e5',
  neg: '#e66767',
  mid: '#383835',
} as const

/** State.  A real pole is a failure, and always ships with a label and a
 *  different marker shape, never colour alone. */
export const status = {
  critical: '#d03b3b',
  good: '#0ca30c',
  warning: '#fab219',
} as const

/**
 * Ordinal: position in a sequence.  Used for the blend degree d, where the
 * order is the meaning, so the reader should see it in the colour.  Six steps
 * of the blue ramp, light end kept clear of the surface.
 */
export const dRamp = ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'] as const

export function dColor(index: number, count: number): string {
  if (count <= 1) return dRamp[2]
  const k = Math.round((index / (count - 1)) * (dRamp.length - 1))
  return dRamp[Math.min(dRamp.length - 1, Math.max(0, k))]
}

/** Chart chrome and ink. */
export const ink = {
  primary: '#e6e9ef',
  secondary: '#c3c2b7',
  muted: '#898781',
  grid: '#232833',
  axis: '#38414f',
  /** the exact function f: the reference the interpolants are measured against,
   *  deliberately not given a series slot */
  reference: '#8b95a5',
  /** the interpolation nodes: they belong to the data, not to any one method */
  node: '#e8e6df',
  /** the family of local polynomials and blending functions, drawn as a mass */
  family: '#46536a',
  /** the one member of that family the reader is following */
  familyHi: '#d95926',
} as const
