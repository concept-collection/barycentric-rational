import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ScriptEditor from './editor/ScriptEditor.tsx'
import Controls, { type Settings } from './panels/Controls.tsx'
import InterpolantPanel from './panels/InterpolantPanel.tsx'
import BlendingPanel from './panels/BlendingPanel.tsx'
import PolesPanel from './panels/PolesPanel.tsx'
import ConvergencePanel from './panels/ConvergencePanel.tsx'
import { Engine } from './engine/runner.ts'
import type { ConvergeOut, ConvergeParams, ExploreOut, ExploreParams, Want } from './engine/types.ts'
import { DEFAULT_METHOD, METHODS, findMethod } from './methods/index.ts'

type TabId = 'interpolant' | 'blending' | 'poles' | 'convergence'

const TABS: { id: TabId; label: string }[] = [
  { id: 'interpolant', label: 'Interpolant' },
  { id: 'blending', label: 'Blending & weights' },
  { id: 'poles', label: 'Poles' },
  { id: 'convergence', label: 'Convergence' },
]

const NGRID = 1200
const NGRID_WIDE = 1400
const ROOTS_MAX_N = 40

function nSeries(maxN: number): number[] {
  const all = [10, 20, 40, 80, 160, 320, 640]
  return all.filter((n) => n <= maxN)
}

export default function App() {
  const [methodId, setMethodId] = useState(DEFAULT_METHOD.id)
  const [script, setScript] = useState(() => DEFAULT_METHOD.source)
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState<TabId>('interpolant')
  const [settings, setSettings] = useState<Settings>({
    f: 'runge',
    fexpr: 'exp(-x.^2) .* cos(3*x)',
    a: -5,
    b: 5,
    n: 20,
    d: 3,
    nodes: 'uniform',
    seed: 1,
  })

  const [showPoly, setShowPoly] = useState(false)
  const [showSpline, setShowSpline] = useState(false)
  const [showClassical, setShowClassical] = useState(true)

  const [explore, setExplore] = useState<ExploreOut | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(true)
  const [ms, setMs] = useState<number | null>(null)

  // the convergence study runs only when asked
  const [convDs, setConvDs] = useState([0, 1, 2, 3, 4])
  const [convMaxN, setConvMaxN] = useState(320)
  const [convSpline, setConvSpline] = useState(true)
  const [convPoly, setConvPoly] = useState(false)
  const [conv, setConv] = useState<ConvergeOut | null>(null)
  const [convKey, setConvKey] = useState<string | null>(null)
  const [convRunning, setConvRunning] = useState(false)

  const engineRef = useRef<Engine | null>(null)
  if (!engineRef.current) engineRef.current = new Engine()
  useEffect(() => () => engineRef.current?.dispose(), [])

  const want: Want = useMemo(
    () => ({
      poly: tab === 'interpolant' && showPoly,
      spline: tab === 'interpolant' && showSpline,
      blend: tab === 'blending',
      poles: tab === 'poles',
      classical: tab === 'poles' && showClassical,
    }),
    [tab, showPoly, showSpline, showClassical],
  )

  const exploreParams: ExploreParams = useMemo(
    () => ({
      mode: 'explore',
      f: settings.f,
      fexpr: settings.fexpr,
      a: settings.a,
      b: settings.b,
      n: settings.n,
      d: Math.min(settings.d, settings.n),
      nodes: settings.nodes,
      seed: settings.seed,
      ngrid: NGRID,
      ngridwide: NGRID_WIDE,
      rootsMaxN: ROOTS_MAX_N,
      want,
    }),
    [settings, want],
  )

  // Re-run whenever the script or any parameter changes.  The debounce keeps a
  // dragged slider from queueing a run per pixel; the engine serialises what
  // does get through, so the last one always wins.
  const [runToken, setRunToken] = useState(0)
  const paramsKey = JSON.stringify(exploreParams)
  useEffect(() => {
    if (tab === 'convergence') return
    let cancelled = false
    setBusy(true)
    const timer = setTimeout(async () => {
      const res = await engineRef.current!.run<ExploreOut>(script, exploreParams)
      if (cancelled) return
      setBusy(false)
      setMs(res.ms)
      setOutput(res.output)
      if (res.ok) {
        setExplore(res.data)
        setError(null)
      } else {
        setError(res.error)
      }
    }, 110)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // paramsKey stands in for exploreParams, which is rebuilt every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, paramsKey, tab, runToken])

  const convParams: ConvergeParams = useMemo(
    () => ({
      mode: 'converge',
      f: settings.f,
      fexpr: settings.fexpr,
      a: settings.a,
      b: settings.b,
      nodes: settings.nodes,
      seed: settings.seed,
      ngrid: 4001,
      ns: nSeries(convMaxN),
      ds: convDs,
      want: { poly: convPoly, spline: convSpline, blend: false, poles: false, classical: false },
    }),
    [settings, convMaxN, convDs, convPoly, convSpline],
  )
  const convParamsKey = JSON.stringify(convParams) + script

  const runConvergence = useCallback(async () => {
    setConvRunning(true)
    setError(null)
    const key = convParamsKey
    const res = await engineRef.current!.run<ConvergeOut>(script, convParams)
    setConvRunning(false)
    setMs(res.ms)
    setOutput(res.output)
    if (res.ok) {
      setConv(res.data)
      setConvKey(key)
      setError(null)
    } else {
      setError(res.error)
    }
  }, [convParams, convParamsKey, script])

  const pickMethod = (id: string) => {
    const m = findMethod(id)
    if (!m) return
    setMethodId(id)
    setScript(m.source)
    setDirty(false)
  }

  const patch = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }))
  const method = findMethod(methodId)

  return (
    <div className="app">
      <header className="header">
        <div className="title">
          <h1>Barycentric rational interpolation</h1>
          <p>
            Floater &amp; Hormann,{' '}
            <a href="https://doi.org/10.1007/s00211-007-0093-y" target="_blank" rel="noreferrer">
              Numer. Math. <b>107</b> (2007) 315&ndash;331
            </a>
            . The method is the script on the left; it runs in your browser through{' '}
            <a href="https://numbl.org" target="_blank" rel="noreferrer">
              numbl
            </a>
            .
          </p>
        </div>
        <a
          className="repo-link"
          href="https://github.com/concept-collection/barycentric-rational"
          target="_blank"
          rel="noreferrer"
        >
          source
        </a>
      </header>

      <div className="body">
        <section className="left">
          <div className="script-head">
            <label className="field">
              <span className="field-label">method</span>
              <select value={dirty ? '' : methodId} onChange={(e) => pickMethod(e.target.value)}>
                {dirty && <option value="">(edited)</option>}
                {METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              onClick={() => setRunToken((v) => v + 1)}
              disabled={busy || convRunning}
              title="⌘/Ctrl+Enter"
            >
              {busy || convRunning ? 'Running…' : 'Run ▶'}
            </button>
          </div>
          {method && !dirty && <p className="method-blurb">{method.blurb}</p>}
          {dirty && <p className="method-blurb edited">Edited. Pick a method above to start over.</p>}

          <ScriptEditor
            value={script}
            onChange={(s) => {
              setScript(s)
              setDirty(s !== findMethod(methodId)?.source)
            }}
            onRun={() => setRunToken((v) => v + 1)}
          />

          <div className="contract">
            <div className="contract-head">What the app calls</div>
            <code>w = bary_weights(x, d)</code>
            <code>r = bary_eval(x, y, w, t)</code>
            <code className="opt">[P, L] = local_blend(x, y, d, t)</code>
            <span className="contract-note">the third is optional; without it the second tab is empty</span>
          </div>

          {error && (
            <div className="error-box">
              <div className="error-head">The script failed</div>
              <pre>{error}</pre>
            </div>
          )}
          {output.trim() && !error && (
            <details className="console">
              <summary>console output</summary>
              <pre>{output}</pre>
            </details>
          )}
        </section>

        <section className="right">
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
            <span className="run-status">
              {busy || convRunning ? 'running…' : ms != null ? `${Math.round(ms)} ms` : ''}
            </span>
          </nav>

          <Controls value={settings} onChange={patch} showN={tab !== 'convergence'} busy={false} />

          <div className="panel-scroll">
            {tab === 'convergence' ? (
              <ConvergencePanel
                out={conv}
                running={convRunning}
                stale={conv != null && convKey !== convParamsKey}
                f={settings.f}
                nodes={settings.nodes}
                ds={convDs}
                maxN={convMaxN}
                showSpline={convSpline}
                showPoly={convPoly}
                onChange={(p) => {
                  if (p.ds) setConvDs(p.ds)
                  if (p.maxN) setConvMaxN(p.maxN)
                  if (p.showSpline !== undefined) setConvSpline(p.showSpline)
                  if (p.showPoly !== undefined) setConvPoly(p.showPoly)
                }}
                onRun={runConvergence}
              />
            ) : explore == null ? (
              <div className="panel">
                <p className="panel-note muted">{error ? 'Fix the script to see the plots.' : 'Starting numbl…'}</p>
              </div>
            ) : tab === 'interpolant' ? (
              <InterpolantPanel
                out={explore}
                showPoly={showPoly}
                showSpline={showSpline}
                onToggle={(which, on) => (which === 'poly' ? setShowPoly(on) : setShowSpline(on))}
              />
            ) : tab === 'blending' ? (
              <BlendingPanel out={explore} />
            ) : (
              <PolesPanel out={explore} showClassical={showClassical} onToggleClassical={setShowClassical} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
