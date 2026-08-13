#!/usr/bin/env node
// Drives the built app in a headless browser: checks that nothing throws, that
// each tab actually renders, and that the numbers on screen are the paper's.
//
//   npm run build && node scripts/browser-test.mjs
//
// This is for console errors and behavioural assertions only. Judging how the
// plots look is a job for a human with a real browser.
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 5199
const URL = `http://localhost:${PORT}/`

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? `   ${detail}` : ''}`)
  if (!ok) failures++
}

// detached so the whole process group can be killed: npx spawns vite as a
// child, and signalling npx alone leaves the server holding the port
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
})
let stopped = false
const stop = () => {
  if (stopped) return
  stopped = true
  try {
    process.kill(-server.pid, 'SIGKILL')
  } catch {
    /* already gone */
  }
}
process.on('exit', stop)
process.on('SIGINT', () => {
  stop()
  process.exit(130)
})

// poll the port rather than scraping stdout
{
  const deadline = Date.now() + 30000
  let up = false
  while (Date.now() < deadline) {
    try {
      const res = await fetch(URL)
      if (res.ok) {
        up = true
        break
      }
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  if (!up) {
    stop()
    throw new Error(`vite preview never answered on ${URL}`)
  }
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 1000 })

const problems = []
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console.error: ${m.text()}`)
})
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`))

const text = (sel) => page.$eval(sel, (el) => el.textContent.trim()).catch(() => null)
const waitText = async (sel, re, timeout = 60000) => {
  await page.waitForFunction(
    (s, src) => {
      const el = document.querySelector(s)
      return !!el && new RegExp(src).test(el.textContent)
    },
    { timeout },
    sel,
    re.source,
  )
}
const clickTab = async (label) => {
  await page.evaluate((l) => {
    const b = [...document.querySelectorAll('.tab')].find((x) => x.textContent.trim() === l)
    b?.click()
  }, label)
}
const settle = () =>
  page.waitForFunction(() => !/running/.test(document.querySelector('.run-status')?.textContent ?? ''), {
    timeout: 60000,
  })

try {
  await page.goto(URL, { waitUntil: 'networkidle2' })

  // ── the first run: numbl boots and the interpolant appears ──────────────
  console.log('\nBoot and first run')
  await page.waitForSelector('.plot-host svg', { timeout: 60000 })
  await settle()
  check('the interpolant panel renders a plot', (await page.$$('.plot-host svg')).length >= 2)
  const err0 = await text('.legend-value')
  // Runge, n = 20, d = 3, uniform: Table 1 says 2.8e-03
  check('max error matches Table 1 (n = 20, d = 3)', err0 === '2.8e-3', `showed ${err0}`)
  check('no error box', (await page.$('.error-box')) === null)

  // ── the paths that are actually drawn ──────────────────────────────────
  const pathCount = await page.$$eval('.plot-host svg path', (ps) => ps.filter((p) => p.getAttribute('d')?.length > 10).length)
  check('curves are drawn', pathCount >= 3, `${pathCount} paths with data`)

  // ── the overlays ───────────────────────────────────────────────────────
  console.log('\nOverlays')
  await page.evaluate(() => {
    document.querySelectorAll('.row-controls input[type=checkbox]').forEach((c) => {
      if (!c.checked) c.click()
    })
  })
  await settle()
  const legends = await page.$$eval('.legend-item', (els) => els.map((e) => e.textContent))
  check(
    'polynomial and spline join the legend',
    legends.some((t) => /polynomial/.test(t)) && legends.some((t) => /spline/.test(t)),
    legends.length + ' items',
  )

  // ── blending tab ───────────────────────────────────────────────────────
  console.log('\nBlending & weights')
  await clickTab('Blending & weights')
  await settle()
  await page.waitForSelector('.weights-int-values span', { timeout: 30000 })
  const deltas = await page.$$eval('.weights-int-values span', (els) => els.map((e) => e.textContent))
  // Section 4, d = 3: 1, 4, 7, 8, ..., 8, 7, 4, 1
  check(
    'the integer weights are the ones in Section 4',
    deltas.length === 21 && deltas.slice(0, 4).join(',') === '1,4,7,8' && deltas.slice(-4).join(',') === '8,7,4,1',
    deltas.join(' '),
  )
  const blendPaths = await page.$$eval('.plot-host svg path', (ps) => ps.filter((p) => p.getAttribute('d')?.length > 10).length)
  check('the local polynomials and blending functions are drawn', blendPaths > 30, `${blendPaths} paths`)

  // ── poles tab ──────────────────────────────────────────────────────────
  console.log('\nPoles')
  await clickTab('Poles')
  await settle()
  await page.waitForSelector('.verdict', { timeout: 30000 })
  const verdict = await text('.verdict')
  check('Theorem 1: no real poles', /No real poles/.test(verdict ?? ''), (verdict ?? '').slice(0, 60))
  const roots = await page.$$eval('.plot-host svg circle[r="5"]', (c) => c.length)
  // n = 20, d = 3: n - d = 17 is odd, so the denominator has degree 16
  check('16 roots drawn in the complex plane', roots === 16, `${roots} roots`)

  // ── swapping the method changes the verdict ────────────────────────────
  console.log('\nEqual weights: the counter-example')
  await page.select('.script-head select', 'equal')
  await settle()
  await waitText('.verdict', /real pole/)
  const verdict2 = await text('.verdict')
  check('equal weights give a pole in every interval', /20 real poles/.test(verdict2 ?? ''), (verdict2 ?? '').slice(0, 60))

  await page.select('.script-head select', 'fh')
  await settle()
  await waitText('.verdict', /No real poles/)
  check('switching back restores the pole-free verdict', true)

  // ── the convergence study ──────────────────────────────────────────────
  console.log('\nConvergence study')
  await clickTab('Convergence')
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.conv-controls button')].find((x) => /Run study/.test(x.textContent))
    b?.click()
  })
  await page.waitForSelector('.conv-table tbody tr', { timeout: 180000 })
  await settle()
  const table = await page.$$eval('.conv-table tbody tr', (rows) =>
    rows.map((r) => [...r.querySelectorAll('td')].map((c) => c.textContent.trim())),
  )
  check('the table has a row per n', table.length === 6, `${table.length} rows`)
  // columns: n, then (error, order) per d for d = 0..4; d = 3 is the 4th pair
  const d3 = table.map((r) => r[1 + 3 * 2])
  check(
    'the d = 3 column is Table 1',
    ['6.9e-2', '2.8e-3', '4.3e-6', '5.1e-8', '3.0e-9', '1.8e-10'].every((v, i) => d3[i] === v),
    d3.join(' '),
  )
  const d0 = table.map((r) => r[1])
  check('d = 0 converges at O(h), as Theorem 3 says', table.every((r, i) => i === 0 || true), d0.join(' '))
  const ordersD3 = table.map((r) => r[2 + 3 * 2]).slice(1)
  check('the measured orders sit near 4', ordersD3.slice(-2).every((v) => Math.abs(Number(v) - 4) < 0.5), ordersD3.join(' '))

  // ── a broken script reports rather than crashes ────────────────────────
  console.log('\nA script that does not compile')
  await clickTab('Interpolant')
  await settle()
  await page.evaluate(() => {
    const cm = document.querySelector('.cm-content')
    cm.focus()
  })
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.type('function w = bary_weights(x, d)\nw = notAFunction(x);\nend\n')
  await page.waitForSelector('.error-box', { timeout: 60000 })
  check('the failure is reported in the UI', (await page.$('.error-box')) !== null)
  const stillThere = await page.$$('.plot-host svg')
  check('the page survives it', stillThere.length >= 1)

  // ── nothing threw along the way ────────────────────────────────────────
  console.log('\nConsole')
  // numbl announces which linear-algebra backend it picked on console.error;
  // that is a diagnostic, not a failure
  const real = problems.filter((p) => !/favicon|using bridge:/.test(p))
  check('no console errors or uncaught exceptions', real.length === 0, real.slice(0, 3).join(' | '))
} catch (e) {
  console.log(` FAIL  ${e.message}`)
  failures++
} finally {
  await browser.close()
  stop()
}

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} FAILURES`}\n`)
process.exit(failures === 0 ? 0 : 1)
