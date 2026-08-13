function s = cubic_spline(x, y, dya, dyb, t)
%CUBIC_SPLINE  Clamped C^2 cubic spline interpolant, evaluated at t.
%
%   This is the competitor in Tables 3 and 4 of the paper: a C^2 cubic spline
%   with clamped end conditions, i.e. with the first derivative at the two
%   end-points set to the corresponding derivative of f.  Its error is O(h^4)
%   for f in C^4, the same order as the rational interpolant with d = 3.
%
%   The moments M_i = s''(x_i) solve a tridiagonal system, which we solve with
%   the Thomas algorithm so that the cost stays O(n) even for the largest n in
%   the convergence study.

x = x(:).';
y = y(:).';
n = numel(x) - 1;
h = diff(x);

lo = zeros(1, n + 1);   % sub-diagonal
di = zeros(1, n + 1);   % diagonal
up = zeros(1, n + 1);   % super-diagonal
rh = zeros(1, n + 1);   % right-hand side

% clamped end conditions
di(1) = 2;
up(1) = 1;
rh(1) = 6 / h(1) * ((y(2) - y(1)) / h(1) - dya);

for i = 2:n
    hl = h(i - 1);
    hr = h(i);
    lo(i) = hl / (hl + hr);
    di(i) = 2;
    up(i) = hr / (hl + hr);
    rh(i) = 6 * ((y(i + 1) - y(i)) / hr - (y(i) - y(i - 1)) / hl) / (hl + hr);
end

lo(n + 1) = 1;
di(n + 1) = 2;
rh(n + 1) = 6 / h(n) * (dyb - (y(n + 1) - y(n)) / h(n));

% Thomas algorithm
cp = zeros(1, n + 1);
dp = zeros(1, n + 1);
cp(1) = up(1) / di(1);
dp(1) = rh(1) / di(1);
for i = 2:n + 1
    den = di(i) - lo(i) * cp(i - 1);
    cp(i) = up(i) / den;
    dp(i) = (rh(i) - lo(i) * dp(i - 1)) / den;
end
M = zeros(1, n + 1);
M(n + 1) = dp(n + 1);
for i = n:-1:1
    M(i) = dp(i) - cp(i) * M(i + 1);
end

% evaluate: on [x_i, x_{i+1}] the spline is the usual cubic in the moments
sz = size(t);
t = t(:).';
s = zeros(1, numel(t));
for i = 1:n
    if i == 1
        m = t < x(2);                       % also catches t < x(1)
    elseif i == n
        m = t >= x(n);                      % also catches t > x(n+1)
    else
        m = (t >= x(i)) & (t < x(i + 1));
    end
    if ~any(m)
        continue
    end
    tt = t(m);
    hi = h(i);
    ra = x(i + 1) - tt;
    rb = tt - x(i);
    s(m) = M(i) * ra.^3 / (6 * hi) + M(i + 1) * rb.^3 / (6 * hi) ...
        + (y(i) - M(i) * hi^2 / 6) .* ra / hi ...
        + (y(i + 1) - M(i + 1) * hi^2 / 6) .* rb / hi;
end
s = reshape(s, sz);
end
