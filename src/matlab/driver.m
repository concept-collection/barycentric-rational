% ---------------------------------------------------------------------------
% Driver (owned by the app, not editable in the browser).
%
% It reads params.json, calls into the method script, and writes out.json.
% The editable method script is appended to the end of this file before the
% run, so the functions it defines -- bary_weights, bary_eval, and optionally
% local_blend -- are local functions of this script and are visible here.
% Every driver-owned helper is prefixed drv_ so that it cannot collide with
% anything the method script defines.
% ---------------------------------------------------------------------------

drv_p = jsondecode(fileread('params.json'));
switch drv_p.mode
    case 'explore'
        drv_out = drv_explore(drv_p);
    case 'converge'
        drv_out = drv_converge(drv_p);
    otherwise
        error('driver: unknown mode ''%s''', drv_p.mode);
end
drv_fid = fopen('out.json', 'w');
fprintf(drv_fid, '%s', jsonencode(drv_out));
fclose(drv_fid);

% ── one set of nodes, one degree d: everything the first three tabs draw ────
function out = drv_explore(p)
x = nodes_of(p.nodes, p.a, p.b, p.n, p.seed);
n = numel(x) - 1;
d = min(max(round(p.d), 0), n);
y = testfun(p.f, x, p.fexpr);
t = linspace(p.a, p.b, p.ngrid);
ft = testfun(p.f, t, p.fexpr);

w = bary_weights(x, d);
w = reshape(w, 1, []);
r = bary_eval(x, y, w, t);
r = reshape(r, 1, []);

out = struct();
out.n = n;
out.d = d;
out.x = x;
out.y = y;
out.t = t;
out.ft = ft;
out.r = r;
out.err = r - ft;
out.maxerr = drv_maxabs(r - ft);

% Barycentric weights, and the integer form they take on a uniform mesh.
% Section 4 lists these: 1,1,...,1,1 for d = 0, then 1,2,2,...,2,2,1 for
% d = 1, 1,3,4,...,4,3,1 for d = 2, and so on.
out.w = w;
aw = abs(w);
pos = aw(aw > 0);
if isempty(pos)
    base = 1;
else
    base = min(pos);
end
out.wscaled = aw / base;
out.wsign = sign(w);
out.wIsInteger = all(abs(out.wscaled - round(out.wscaled)) < 1e-7);
out.wAlternates = all(w(1:end - 1) .* w(2:end) < 0);

% the degree-n polynomial interpolant, in barycentric form (equation 2)
if p.want.poly
    out.rpoly = reshape(bary_eval(x, y, drv_lagrange_weights(x), t), 1, []);
end

% the clamped C^2 cubic spline of Tables 3 and 4
if p.want.spline
    [~, dya] = testfun(p.f, p.a, p.fexpr);
    [~, dyb] = testfun(p.f, p.b, p.fexpr);
    out.rspline = reshape(cubic_spline(x, y, dya, dyb, t), 1, []);
end

% the blend of local polynomials, equations (4) and (5)
if p.want.blend
    out.hasBlend = false;
    try
        [P, L] = local_blend(x, y, d, t);
        out.P = drv_rows(P);
        out.L = drv_rows(L);
        out.wlo = x(1:(n - d + 1));
        out.whi = x((d + 1):(n + 1));
        out.hasBlend = true;
    catch blenderr
        out.blendError = blenderr.message;
    end
end

if p.want.poles
    out.poles = drv_poles(x, y, w, p);
end
end

% ── denominator of r, its sign on the real line, and its roots ─────────────
function s = drv_poles(x, y, w, p)
n = numel(x) - 1;
mg = 0.35 * (p.b - p.a);
tw = linspace(p.a - mg, p.b + mg, p.ngridwide);

% Work in a variable rescaled to [-1, 1].  This only multiplies the
% denominator by a positive constant, so signs and roots are untouched, but it
% keeps the products of n factors from over- or underflowing.
c0 = (p.a + p.b) / 2;
sc = (p.b - p.a) / 2;
xs = (x - c0) / sc;
ts = (tw - c0) / sc;

q = drv_denom_eval(xs, w, ts);

s = struct();
s.t = tw;
% A plain plot of q is useless: it spans many orders of magnitude.  The signed
% n-th root keeps every sign and every zero exactly where it was and brings the
% magnitudes into a range that can be drawn.
qmax = max(abs(q));
if qmax == 0
    qmax = 1;
end
s.u = sign(q) .* (abs(q) / qmax).^(1 / max(1, n));

% Real poles: sign changes of the denominator, located by linear interpolation
% of the crossing.  This works for any n, which the root-finding below does not.
sg = sign(q);
idx = find(sg(1:end - 1) .* sg(2:end) < 0);
rp = zeros(1, numel(idx));
for m = 1:numel(idx)
    j = idx(m);
    rp(m) = tw(j) + (tw(j + 1) - tw(j)) * abs(q(j)) / (abs(q(j)) + abs(q(j + 1)));
end
s.realPoles = rp;

% All roots in the complex plane.  Theorem 1 says none of them are real, and
% that is the picture: every root sits off the real axis.  We only do this for
% moderate n, since finding roots from monomial coefficients is not reliable
% for large degree.
s.rootsRe = [];
s.rootsIm = [];
s.rootsShown = false;
if n <= p.rootsMaxN
    [cc, floorc] = drv_denom_coeffs(xs, w);
    % The top d coefficients of q vanish identically -- that is exactly the
    % statement that r reproduces polynomials of degree d, i.e. that the first
    % d moments of the weights are zero -- but they come out of the sum as
    % roundoff rather than as zero.  Left in place they contribute spurious
    % roots, some of them real, which would be a lie in a picture whose whole
    % point is that there are no real roots.  So drop every leading
    % coefficient that is below the rounding-error floor of its own sum.
    k0 = find(abs(cc) > floorc, 1);
    if ~isempty(k0) && numel(cc) - k0 >= 1
        z = reshape(roots(cc(k0:end)), 1, []);
        s.rootsRe = real(z) * sc + c0;
        s.rootsIm = imag(z) * sc;
        s.rootsShown = true;
    end
end

% the classical alternative, with the poles it puts in the interval
if p.want.classical
    [rc, cp] = classical_rational(x, y, tw);
    s.classical = reshape(rc, 1, []);
    s.classicalPoles = cp;
end
end

% q(t) = sum_k w_k prod_{j ~= k} (t - x_j), the denominator of r written as a
% polynomial.  Its zeros are exactly the poles of r.
function q = drv_denom_eval(xs, w, ts)
D = ts(:) - xs(:).';
n1 = numel(xs);
q = zeros(numel(ts), 1);
for k = 1:n1
    pr = ones(numel(ts), 1);
    for j = 1:n1
        if j ~= k
            pr = pr .* D(:, j);
        end
    end
    q = q + w(k) * pr;
end
q = q.';
end

function [c, floorc] = drv_denom_coeffs(xs, w)
n1 = numel(xs);
n = n1 - 1;
c = zeros(1, n1);
for k = 1:n1
    ck = 1;
    for j = 1:n1
        if j ~= k
            ck = conv(ck, [1, -xs(j)]);
        end
    end
    c = c + w(k) * ck;
end
% Rounding-error floor, coefficient by coefficient.  The nodes have been
% rescaled so that every |x_j| <= 1, so the coefficient of t^(n-m) in each of
% the n+1 products is at most binomial(n, m); summing them accumulates at most
% n+1 roundings of terms of size |w_k| times that bound.
floorc = zeros(1, n1);
sw = sum(abs(w));
for m = 0:n
    floorc(m + 1) = 8 * eps * n1 * sw * nchoosek(n, m);
end
end

% the weights of equation (2), which put the degree-n polynomial interpolant
% into barycentric form
function w = drv_lagrange_weights(x)
n1 = numel(x);
w = zeros(1, n1);
for k = 1:n1
    pr = 1;
    for j = 1:n1
        if j ~= k
            pr = pr / (x(k) - x(j));
        end
    end
    w(k) = pr;
end
end

% ── error against n, for a range of d: Tables 1 to 4 ───────────────────────
function out = drv_converge(p)
ns = reshape(p.ns, 1, []);
ds = reshape(p.ds, 1, []);
t = linspace(p.a, p.b, p.ngrid);
ft = testfun(p.f, t, p.fexpr);
[~, dya] = testfun(p.f, p.a, p.fexpr);
[~, dyb] = testfun(p.f, p.b, p.fexpr);

E = zeros(numel(ds), numel(ns));
esp = zeros(1, numel(ns));
epo = zeros(1, numel(ns));

for ib = 1:numel(ns)
    n = ns(ib);
    x = nodes_of(p.nodes, p.a, p.b, n, p.seed);
    y = testfun(p.f, x, p.fexpr);
    for ia = 1:numel(ds)
        d = min(ds(ia), n);
        w = reshape(bary_weights(x, d), 1, []);
        E(ia, ib) = drv_maxabs(reshape(bary_eval(x, y, w, t), 1, []) - ft);
    end
    if p.want.spline
        esp(ib) = drv_maxabs(reshape(cubic_spline(x, y, dya, dyb, t), 1, []) - ft);
    end
    if p.want.poly
        wl = drv_lagrange_weights(x);
        epo(ib) = drv_maxabs(reshape(bary_eval(x, y, wl, t), 1, []) - ft);
    end
end

out = struct();
out.ns = ns;
out.ds = ds;
out.E = drv_rows(E);
out.orders = drv_rows(drv_orders(ns, E));
if p.want.spline
    out.splineErr = esp;
    out.splineOrders = drv_orders(ns, esp);
end
if p.want.poly
    out.polyErr = epo;
end
end

function o = drv_orders(ns, E)
o = zeros(size(E));
o(:, 1) = NaN;
for j = 2:numel(ns)
    o(:, j) = log(E(:, j - 1) ./ E(:, j)) / log(ns(j) / ns(j - 1));
end
end

% jsonencode flattens a matrix with a single row, so hand matrices over as a
% cell array of rows to keep the shape on the JavaScript side predictable.
function c = drv_rows(A)
c = cell(1, size(A, 1));
for i = 1:size(A, 1)
    c{i} = A(i, :);
end
end

function m = drv_maxabs(v)
v = abs(v(:));
v = v(isfinite(v));
if isempty(v)
    m = Inf;
else
    m = max(v);
end
end
