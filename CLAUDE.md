# CLAUDE.md

Notes for future agents working in this repo. See [README.md](README.md) first —
it explains the paper and what each tab shows.

## The shape of the thing

A standalone Vite + React app that embeds [numbl](https://numbl.org) as a library
(`numbl/browser`, `createNumblSession`). This is the seqlab / numbl-image-filter
pattern, not the numbl-project.json + site-viewer pattern that
hitandrun-interactive uses: there is no `numbl-project.json` here and the deploy
is a plain `vite build` to GitHub Pages.

The MATLAB layer is the interesting part, and it is worth understanding before
changing anything.

## How a run works

1. The editor holds a **method script**: function definitions only, no statements.
2. `src/engine/files.ts` composes `main.m` = `src/matlab/driver.m` + `"\n"` + that
   script. The script's functions therefore become **local functions of the
   driver**, which is the only way the driver can call them.
3. `src/matlab/lib/*.m` go into the session as ordinary function files.
4. Parameters are written to `params.json` in the session VFS; the driver reads it
   with `jsondecode(fileread(...))` and writes `out.json`, which the app reads back
   with `session.readFile`.

One session per script. Changing a parameter only rewrites `params.json` and
re-runs — a full boot is only needed when the script text changes, because the
script is compiled into `main.m` at boot.

### Gotcha: invoke the script with `run('main.m')`, not `main;`

numbl 0.4.18 mis-binds the arguments of a script's **local functions** when the
script is invoked by name from the REPL, which is what `session.execute` gives us:
the callee sees its parameters as undefined (`Undefined function or variable 'p'`).
Reproduce it outside the browser with

```
npx tsx $NUMBL/src/cli.ts eval "t;"          # fails
npx tsx $NUMBL/src/cli.ts eval "run('t.m');" # works
npx tsx $NUMBL/src/cli.ts run t.m            # works
```

on any script with a local function that takes an argument. `runner.ts` goes
through `run('main.m')` for this reason. If numbl fixes it, the workaround is
harmless either way.

### Gotcha: `jsonencode` flattens single-row matrices

`jsonencode([1 2 3])` is `[1,2,3]`, not `[[1,2,3]]`, so a matrix with one row
arrives on the JavaScript side with the wrong nesting. `drv_rows` in the driver
converts matrices to a cell array of rows before encoding. Use it for anything
matrix-shaped (`E`, `orders`, `P`, `L`).

NaN and ±Inf all cross as `null`, which is why the TypeScript side uses
`Num = number | null` everywhere and every plot helper skips nulls.

## The contract with the method script

```matlab
w = bary_weights(x, d)             % required
r = bary_eval(x, y, w, t)          % required
[P, L] = local_blend(x, y, d, t)   % optional; without it the Blending tab is empty
```

The driver wraps `local_blend` in try/catch and reports the message, so a script
that omits it is not an error. Everything else the tabs show — the denominator,
its roots, the real poles, the polynomial and spline overlays — is derived in the
driver from `x`, `y` and `w`, which is deliberate: it means the Poles tab tells the
truth about *whatever* weights the user supplies, and is why `equal.m` and
`random.m` light it up.

## Numerical points that took some getting right

- **Vectorise `bary_eval`.** The scalar double loop takes 6.8 s for the
  convergence study; `D = t(:) - x(:).'` then a matvec takes 0.19 s, with
  identical results.
- **The denominator's leading coefficients.** `q(t) = Σ_k w_k Π_{j≠k}(t − x_j)`
  has degree n−d for the Floater-Hormann weights: the top *d* coefficients vanish
  identically, because the first *d* moments of the weights are zero (that is what
  "r reproduces polynomials of degree d" means). They come out of the sum as
  roundoff rather than as zero, and left in place they produce spurious roots,
  some of them **real** — which would be a lie in a picture whose whole point is
  that there are none. `drv_denom_coeffs` returns a per-coefficient rounding-error
  floor (`eps · (n+1) · Σ|w| · binomial(n, m)`, in the rescaled variable) and the
  leading coefficients are stripped against it.
- **Parity.** The degree of the denominator is n−d when n−d is **even** and n−d−1
  when it is odd, because the leading coefficient is ±Σ_{i=0}^{n−d} (−1)^i. That
  is the same parity that splits Theorem 2 into two cases. `scripts/matlab-test.mjs`
  asserts the root count, so get this right or the tests fail.
- **Rescale to [−1, 1]** before forming products of n factors, or they over- or
  underflow. It multiplies the denominator by a positive constant, so signs and
  roots are untouched.
- **Drawing the denominator.** It spans many orders of magnitude. The plot shows
  `sign(q)·(|q|/max|q|)^(1/n)`, which preserves every sign and every zero.

## Tests

```
npm run test:matlab     # ~2 min: the .m layer vs the paper, through the numbl CLI
npm run test:browser    # ~1 min: the built app in headless Chrome
```

`test:matlab` needs a numbl clone (`NUMBL_DIR`, default `~/src/numbl`) and runs
`main.m` directly with the CLI, so it does **not** exercise the REPL path — the
browser test is what covers that. Both check real numbers from the paper rather
than snapshots; if you change the MATLAB layer, they will tell you.

`test:browser` builds nothing itself — run `npm run build` first. It spawns
`vite preview` detached and kills the process group, because signalling `npx`
alone leaves the server holding the port.

Visual judgement is not something either suite does. Ask a human to look at the
page; the headless run is for console errors and behavioural assertions only.

## Plotting

`src/plot/` is a small hand-rolled SVG layer, no chart library. `palette.ts`
documents which colour does which job (identity, polarity, ordinal, status) and
records the colour-vision validator results; if you add a series, re-validate
rather than picking a hex that looks nice. Curves that run off to infinity are
clamped to a band just outside the frame and clipped, so a pole leaves the frame
in the right direction instead of producing unusable path data.

## Ideas not done

- Berrut and Trefethen's approach to evaluating derivatives of r via the
  Schneider-Werner formulas, which the paper mentions in Section 4.
- The Lebesgue constant of the interpolation operator, as a function of d.
- Table 2's "best d for each n" as a small search.
