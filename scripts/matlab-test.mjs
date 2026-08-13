#!/usr/bin/env node
// Runs the MATLAB layer (driver.m + a method script + the helpers) through the
// numbl CLI outside the browser, and checks the numbers against the paper.
//
//   node scripts/matlab-test.mjs            # everything except the slow cases
//   node scripts/matlab-test.mjs --full     # also n = 640 in the convergence study
//
// NUMBL_DIR points at a clone of https://github.com/flatironinstitute/numbl
// (default ~/src/numbl); the CLI is run with npx tsx, no global install.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const NUMBL = process.env.NUMBL_DIR ?? join(process.env.HOME, 'src', 'numbl')
const FULL = process.argv.includes('--full')

const HELPERS = ['nodes_of.m', 'testfun.m', 'evalexpr.m', 'cubic_spline.m', 'classical_rational.m']
const read = (p) => readFileSync(join(root, p), 'utf8')

function run(methodFile, params) {
  const dir = mkdtempSync(join(tmpdir(), 'bary-'))
  try {
    for (const h of HELPERS) writeFileSync(join(dir, h), read(`src/matlab/lib/${h}`))
    writeFileSync(join(dir, 'main.m'), read('src/matlab/driver.m') + '\n' + read(`src/methods/${methodFile}`))
    writeFileSync(join(dir, 'params.json'), JSON.stringify(params))
    execFileSync('npx', ['tsx', join(NUMBL, 'src', 'cli.ts'), 'run', 'main.m'], {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    })
    return JSON.parse(readFileSync(join(dir, 'out.json'), 'utf8'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const explore = (over = {}) => ({
  mode: 'explore',
  f: 'runge',
  fexpr: '',
  a: -5,
  b: 5,
  n: 20,
  d: 3,
  nodes: 'uniform',
  seed: 1,
  ngrid: 801,
  ngridwide: 801,
  rootsMaxN: 40,
  want: { poly: false, spline: false, blend: false, poles: false, classical: false },
  ...over,
})

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? `   ${detail}` : ''}`)
  if (!ok) failures++
}
const close = (a, b, tol) => Math.abs(a - b) <= tol

// ── the integer weight patterns of Section 4 ───────────────────────────────
console.log('\nSection 4: integer weights on a uniform mesh')
const PATTERNS = {
  0: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  1: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  2: [1, 3, 4, 4, 4, 4, 4, 4, 4, 3, 1],
  3: [1, 4, 7, 8, 8, 8, 8, 8, 7, 4, 1],
  4: [1, 5, 11, 15, 16, 16, 16, 15, 11, 5, 1],
}
for (const [d, want] of Object.entries(PATTERNS)) {
  for (const method of ['fh.m', 'uniform-integer.m']) {
    const o = run(method, explore({ n: 10, d: Number(d) }))
    const got = o.wscaled.map((v) => Math.round(v * 1e6) / 1e6)
    check(
      `d = ${d}  ${method.padEnd(18)} delta_k`,
      o.wIsInteger && JSON.stringify(got) === JSON.stringify(want) && o.wAlternates,
      `[${got.join(' ')}]`,
    )
  }
}

// ── Table 1: Runge with d = 3, sine with d = 4, |x| with d = 3 ────────────
console.log('\nTable 1: error in the rational interpolant')
const ns = FULL ? [10, 20, 40, 80, 160, 320, 640] : [10, 20, 40, 80, 160, 320]
const TABLE1 = {
  runge: { d: 3, err: [6.9e-2, 2.8e-3, 4.3e-6, 5.1e-8, 3.0e-9, 1.8e-10, 1.1e-11] },
  // The n = 20 entry is printed as 3.9e-05 in Table 1, but the paper's own
  // order column next to it (5.5) says 1.7e-2 / 2^5.5 = 3.8e-04, and every
  // other entry in the row matches to two figures.  We take it as a misprint.
  sine: { d: 4, err: [1.7e-2, 3.9e-4, 7.1e-6, 1.3e-7, 2.7e-9, 6.0e-11, 1.5e-12] },
  abs: { d: 3, err: [1.9e-1, 9.5e-2, 4.8e-2, 2.4e-2, 1.2e-2, 5.9e-3, 3.0e-3] },
}
for (const [f, spec] of Object.entries(TABLE1)) {
  const o = run('fh.m', {
    mode: 'converge',
    f,
    fexpr: '',
    a: -5,
    b: 5,
    nodes: 'uniform',
    seed: 1,
    ngrid: 4001,
    ns,
    ds: [spec.d],
    want: { poly: false, spline: true },
  })
  const got = o.E[0]
  const ok = got.every((e, i) => close(Math.log10(e), Math.log10(spec.err[i]), 0.05))
  check(
    `${f.padEnd(6)} d = ${spec.d}`,
    ok,
    got.map((e) => e.toExponential(1)).join(' '),
  )
  const ord = o.orders[0].slice(1)
  console.log(`         orders            ${ord.map((v) => v.toFixed(1)).join(' ')}`)
}

// ── Table 3: rational (d = 3) against the clamped cubic spline, Runge ─────
console.log('\nTable 3: rational d = 3 vs clamped cubic spline (Runge)')
{
  const o = run('fh.m', {
    mode: 'converge',
    f: 'runge',
    fexpr: '',
    a: -5,
    b: 5,
    nodes: 'uniform',
    seed: 1,
    ngrid: 4001,
    ns,
    ds: [3],
    want: { poly: false, spline: true },
  })
  const WANT = [2.2e-2, 3.2e-3, 2.8e-4, 1.6e-5, 9.5e-7, 5.9e-8, 3.7e-9]
  const ok = o.splineErr.every((e, i) => close(Math.log10(e), Math.log10(WANT[i]), 0.06))
  check('spline error', ok, o.splineErr.map((e) => e.toExponential(1)).join(' '))
  const last = o.splineErr.length - 1
  check(
    'rational beats spline by >100x at the largest n',
    o.splineErr[last] / o.E[0][last] > 100,
    `ratio ${(o.splineErr[last] / o.E[0][last]).toFixed(0)}x`,
  )
}

// ── Table 4: the sine function, where the spline wins ─────────────────────
console.log('\nTable 4: the sine function, where the spline is the better one')
{
  const o = run('fh.m', {
    mode: 'converge',
    f: 'sine',
    fexpr: '',
    a: -5,
    b: 5,
    nodes: 'uniform',
    seed: 1,
    ngrid: 4001,
    ns,
    ds: [3],
    want: { poly: false, spline: true },
  })
  const RAT = [1.3e-2, 1.2e-3, 8.4e-5, 5.4e-6, 3.4e-7, 2.1e-8, 1.3e-9]
  const SPL = [3.3e-3, 1.7e-4, 1.0e-5, 6.4e-7, 4.0e-8, 2.5e-9, 1.6e-10]
  check('rational d = 3', o.E[0].every((e, i) => close(Math.log10(e), Math.log10(RAT[i]), 0.06)),
    o.E[0].map((e) => e.toExponential(1)).join(' '))
  check('spline', o.splineErr.every((e, i) => close(Math.log10(e), Math.log10(SPL[i]), 0.06)),
    o.splineErr.map((e) => e.toExponential(1)).join(' '))
}

// ── Theorem 1: no real poles, for any d and any node distribution ─────────
console.log('\nTheorem 1: no poles in R')
for (const nodes of ['uniform', 'chebyshev', 'random', 'paired', 'graded']) {
  for (const d of [0, 1, 3, 6]) {
    const n = 16
    const o = run('fh.m', explore({ n, d, nodes, want: { ...explore().want, poles: true } }))
    const p = o.poles
    const minIm = Math.min(...p.rootsIm.map(Math.abs))
    // The denominator s of equation (10) has degree at most n - d.  The
    // leading coefficient of mu_i is (-1)^(n-i-d), so the leading coefficient
    // of s is +-sum_{i=0}^{n-d} (-1)^i, which is 1 when n - d is even and 0
    // when it is odd: the same parity that splits Theorem 2 into two cases.
    // Theorem 1 then puts every one of those roots off the real axis.
    const deg = (n - d) % 2 === 0 ? n - d : n - d - 1
    check(
      `${nodes.padEnd(10)} d = ${d}`,
      p.realPoles.length === 0 && p.rootsShown && p.rootsRe.length === deg && minIm > 1e-8,
      `${p.rootsRe.length} roots (want ${deg}), min |Im| = ${minIm.toExponential(1)}`,
    )
  }
}

// ── the counter-examples: weights that do not alternate ───────────────────
console.log('\nWeights that do not alternate in sign do have poles')
for (const method of ['equal.m', 'random.m']) {
  const o = run(method, explore({ n: 12, d: 3, want: { ...explore().want, poles: true } }))
  check(`${method.padEnd(10)} real poles found`, o.poles.realPoles.length > 0,
    `${o.poles.realPoles.length} poles`)
}
{
  // the Lagrange weights are the degenerate case: the denominator is constant
  const o = run('lagrange.m', explore({ n: 12, d: 3, want: { ...explore().want, poles: true } }))
  check('lagrange.m no roots at all (denominator is 1)',
    o.poles.realPoles.length === 0 && o.poles.rootsRe.length === 0)
}

// ── the blend of equations (4) and (5) reproduces r ───────────────────────
console.log('\nEquations (4) and (5): the blend equals the barycentric form')
for (const d of [0, 1, 3, 5]) {
  const o = run('fh.m', explore({ n: 14, d, want: { ...explore().want, blend: true } }))
  check(`d = ${d} hasBlend`, o.hasBlend === true, o.blendError ?? '')
  if (!o.hasBlend) continue
  let maxDiff = 0
  let maxPU = 0
  for (let j = 0; j < o.t.length; j++) {
    let s = 0
    let pu = 0
    for (let i = 0; i < o.L.length; i++) {
      s += o.L[i][j] * o.P[i][j]
      pu += o.L[i][j]
    }
    maxDiff = Math.max(maxDiff, Math.abs(s - o.r[j]))
    maxPU = Math.max(maxPU, Math.abs(pu - 1))
  }
  check(`d = ${d} sum_i L_i p_i == r`, maxDiff < 1e-9, `max diff ${maxDiff.toExponential(1)}`)
  check(`d = ${d} sum_i L_i == 1`, maxPU < 1e-12, `max dev ${maxPU.toExponential(1)}`)
}

// ── d = n is the polynomial interpolant ───────────────────────────────────
console.log('\nd = n is the polynomial interpolant of equation (2)')
{
  const o = run('fh.m', explore({ n: 12, d: 12, want: { ...explore().want, poly: true } }))
  const m = Math.max(...o.r.map((v, i) => Math.abs(v - o.rpoly[i])))
  check('r (d = n) == barycentric Lagrange', m < 1e-10, `max diff ${m.toExponential(1)}`)
}

// ── Berrut on a badly graded mesh: the point of Theorem 3's beta ──────────
console.log("\nTheorem 3: d = 0 needs a bounded mesh ratio, d >= 1 does not")
{
  const o = run('fh.m', {
    mode: 'converge',
    f: 'runge',
    fexpr: '',
    a: -5,
    b: 5,
    nodes: 'paired',
    seed: 1,
    ngrid: 2001,
    ns: [20, 40, 80, 160],
    ds: [0, 1, 3],
    want: { poly: false, spline: false },
  })
  const ord = (row) => o.orders[row].slice(1)
  console.log(`         d = 0 orders  ${ord(0).map((v) => v.toFixed(1)).join(' ')}`)
  console.log(`         d = 1 orders  ${ord(1).map((v) => v.toFixed(1)).join(' ')}`)
  console.log(`         d = 3 orders  ${ord(2).map((v) => v.toFixed(1)).join(' ')}`)
  const last = o.ns.length - 1
  check('d = 0 does much worse than d = 1 on the paired mesh',
    o.E[0][last] / o.E[1][last] > 10, `ratio ${(o.E[0][last] / o.E[1][last]).toExponential(1)}`)
  check('d = 3 still converges near h^4 on the paired mesh',
    ord(2).slice(-1)[0] > 3.0, `last order ${ord(2).slice(-1)[0].toFixed(1)}`)
}

// ── the classical alternative does put poles in the interval ──────────────
console.log('\nThe classical rational interpolant p_M/q_N')
{
  const o = run('fh.m', explore({ n: 12, d: 3, want: { ...explore().want, poles: true, classical: true } }))
  const inside = o.poles.classicalPoles.filter((p) => p >= -5 && p <= 5)
  check('has real poles', o.poles.classicalPoles.length > 0,
    `${o.poles.classicalPoles.length} real poles, ${inside.length} inside [-5, 5]`)
}

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} FAILURES`}\n`)
process.exit(failures === 0 ? 0 : 1)
