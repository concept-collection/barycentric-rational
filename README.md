# barycentric-rational

An interactive illustration of

> M. S. Floater and K. Hormann, **Barycentric rational interpolation with no poles
> and high rates of approximation**, *Numerische Mathematik* **107** (2007) 315–331.
> [doi:10.1007/s00211-007-0093-y](https://doi.org/10.1007/s00211-007-0093-y)

The method itself is a MATLAB-syntax script you can edit in the page. It runs in
your browser through [numbl](https://numbl.org); there is no server and nothing
to install.

## What the paper says

Interpolating a function at a given set of points is easy to do badly. The
degree-*n* polynomial through *n*+1 equally spaced points diverges as *n* grows,
which is Runge's example. Classical rational interpolation, fitting a quotient
p<sub>M</sub>/q<sub>N</sub> with M + N = n, often approximates better but offers
no control over where the poles land, and they land inside the interval.

Floater and Hormann's construction is short. Fix an integer *d* with 0 ≤ *d* ≤ *n*.
For each *i* let p<sub>i</sub> be the polynomial of degree at most *d* through the
*d*+1 points x<sub>i</sub>, …, x<sub>i+d</sub>, and blend those local polynomials
together:

$$r(x) = \frac{\sum_{i=0}^{n-d} \lambda_i(x)\, p_i(x)}{\sum_{i=0}^{n-d} \lambda_i(x)},
\qquad \lambda_i(x) = \frac{(-1)^i}{(x - x_i)\cdots(x - x_{i+d})}.$$

The results are that *r* has **no poles anywhere on the real line** for any *d*
(Theorem 1), that its error is **O(h<sup>d+1</sup>)** for *d* ≥ 1 **whatever the
node distribution**, as long as *f* is smooth enough (Theorem 2), and that *r* can
be rewritten in the barycentric form

$$r(x) = \sum_{k=0}^{n} \frac{w_k}{x - x_k} f(x_k) \Big/ \sum_{k=0}^{n} \frac{w_k}{x - x_k}$$

with explicit weights (equation 18), which is cheap to evaluate. On a uniform mesh
those weights are integers, nearly all equal, differing only near the two ends:
1, 4, 7, 8, …, 8, 7, 4, 1 for *d* = 3. That small change at the ends is what lifts
the approximation order from O(h) to O(h<sup>4</sup>).

The *d* = 0 case is Berrut's earlier interpolant, and *d* = *n* is ordinary
polynomial interpolation, so the family interpolates between the two.

## What the page shows

Four tabs, all driven by the same script:

- **Interpolant** — *f*, the rational interpolant *r*, and the nodes, with the
  degree-*n* polynomial and a clamped C² cubic spline as optional overlays, plus
  the pointwise error underneath.
- **Blending & weights** — the *n*−*d*+1 local polynomials and the normalised
  blending functions λ<sub>i</sub>, which sum to 1 everywhere but have oscillating
  tails and no local support; and a stem plot of the barycentric weights, with the
  integers of Section 4 read off when the mesh is uniform.
- **Poles** — the denominator of *r* on the real line, drawn as a signed *n*-th
  root so that its sign and zeros survive the enormous dynamic range; all of its
  roots plotted in the complex plane, none of them touching the real axis; and the
  classical p<sub>M</sub>/q<sub>N</sub> alongside, with the poles it does put in
  the interval.
- **Convergence** — max error against *n* on log-log axes for a range of *d*, with
  the measured orders tabulated. With Runge's function on uniform nodes this
  reproduces Table 1 of the paper, and with the spline turned on, Tables 3 and 4.

## The script

The editor holds the whole method. The app only asks it for two functions, and
optionally a third:

```matlab
w = bary_weights(x, d)             % the weights, equation (18)
r = bary_eval(x, y, w, t)          % the barycentric form, equation (1)
[P, L] = local_blend(x, y, d, t)   % the blend of (4) and (5)   [optional]
```

Anything that satisfies that contract will drive all four tabs, which is the point
of the alternative scripts in the **method** dropdown:

| script | what it does |
|---|---|
| Floater-Hormann | the paper |
| Berrut (d = 0) | weights (−1)<sup>k</sup>; set the nodes to **paired** to see why Theorem 3 needs a bounded mesh ratio |
| Integer weights | Section 4's closed form; identical to the first script while the mesh stays uniform, and not otherwise |
| Polynomial (d = n) | the Lagrange weights of equation (2); no poles, but Runge divergence |
| Equal weights | drop the alternating signs and a pole appears in every interval |
| Random weights | the generic barycentric rational interpolant: interpolates, has poles |

The last two are the counterpart to Schneider and Werner's theorem, quoted in the
paper, that a pole-free barycentric rational interpolant must have weights that
alternate in sign.

## Running it locally

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check and bundle to dist/
```

Two test suites, neither of which needs a browser to be watched:

```bash
npm run test:matlab    # the .m layer against the paper's tables, via the numbl CLI
npm run test:matlab -- --full   # also n = 640
npm run test:browser   # the built app in headless Chrome
```

`test:matlab` runs the MATLAB layer outside the browser through a clone of
[numbl](https://github.com/flatironinstitute/numbl) (set `NUMBL_DIR`; it defaults
to `~/src/numbl`) and checks it against the published numbers: the integer weight
patterns of Section 4 for *d* = 0…4, the error columns of Tables 1, 3 and 4, the
absence of real roots for every *d* across five node distributions, and the
identity r = Σ L<sub>i</sub> p<sub>i</sub> relating equations (1) and (4).

One entry of the paper's Table 1 does not reproduce: the sine row at *n* = 20 is
printed as 3.9e−05, but the order 5.5 printed beside it implies 1.7e−2 / 2<sup>5.5</sup>
= 3.8e−04, which is what we get, and every other entry in the row matches to two
figures. We take it as a misprint.

## How it is put together

- `src/matlab/driver.m` — reads `params.json`, calls the method script, writes
  `out.json`. It is prepended to whatever is in the editor, so the script's
  functions become its local functions.
- `src/matlab/lib/*.m` — the parts that are not the method: node distributions,
  test functions, the cubic spline, the classical rational interpolant.
- `src/methods/*.m` — the scripts in the dropdown.
- `src/engine/` — the numbl session. One session per script; parameter changes
  only rewrite `params.json` and re-run, which is fast enough to drive a slider.
- `src/plot/` — a small SVG plotting layer. The palette is documented and was
  checked with a colour-vision validator rather than by eye.
- `src/panels/` — one component per tab.

## License

Apache-2.0, matching numbl.
