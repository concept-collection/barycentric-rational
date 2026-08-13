// The contract between the app and the MATLAB layer: what goes into
// params.json and what comes back in out.json.  See src/matlab/driver.m.

export type FuncName = 'runge' | 'sine' | 'abs' | 'custom'
export type NodeKind = 'uniform' | 'chebyshev' | 'random' | 'paired' | 'graded'

/** NaN and +-Inf both cross the JSON boundary as null. */
export type Num = number | null

export interface Want {
  poly: boolean
  spline: boolean
  blend: boolean
  poles: boolean
  classical: boolean
}

interface CommonParams {
  f: FuncName
  fexpr: string
  a: number
  b: number
  nodes: NodeKind
  seed: number
  ngrid: number
  want: Want
}

export interface ExploreParams extends CommonParams {
  mode: 'explore'
  n: number
  d: number
  ngridwide: number
  rootsMaxN: number
}

export interface ConvergeParams extends CommonParams {
  mode: 'converge'
  ns: number[]
  ds: number[]
}

export type Params = ExploreParams | ConvergeParams

export interface PolesOut {
  /** the wide grid, running past both ends of [a, b] */
  t: number[]
  /** signed n-th root of the denominator, so that the sign and the zeros survive */
  u: Num[]
  /** real zeros of the denominator, located from sign changes: the poles of r */
  realPoles: number[]
  rootsRe: number[]
  rootsIm: number[]
  rootsShown: boolean
  classical?: Num[]
  classicalPoles?: number[]
}

export interface ExploreOut {
  n: number
  d: number
  x: number[]
  y: number[]
  t: number[]
  ft: number[]
  r: Num[]
  err: Num[]
  maxerr: Num
  w: number[]
  /** |w_k| divided by the smallest of them: the integers of Section 4 on a uniform mesh */
  wscaled: number[]
  wsign: number[]
  wIsInteger: boolean
  wAlternates: boolean
  rpoly?: Num[]
  rspline?: Num[]
  hasBlend?: boolean
  blendError?: string
  /** P[i] is the local polynomial p_i on the grid, L[i] its normalised blending function */
  P?: Num[][]
  L?: Num[][]
  /** the window [wlo[i], whi[i]] = [x_i, x_{i+d}] that p_i interpolates on */
  wlo?: number[]
  whi?: number[]
  poles?: PolesOut
}

export interface ConvergeOut {
  ns: number[]
  ds: number[]
  /** E[i][j] is the max error for d = ds[i] at n = ns[j] */
  E: Num[][]
  orders: Num[][]
  splineErr?: Num[]
  splineOrders?: Num[]
  polyErr?: Num[]
}

export type RunResult<T> =
  | { ok: true; data: T; output: string; ms: number }
  | { ok: false; error: string; output: string; ms: number }
