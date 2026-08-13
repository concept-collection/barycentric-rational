function [r, poles] = classical_rational(x, y, t)
%CLASSICAL_RATIONAL  "Classical" rational interpolation p_M / q_N, M + N = n.
%
%   This is the construction the paper's introduction describes and rejects:
%   fit the values f(x_i) with a quotient of polynomials of degrees M and N
%   with M + N = n, taking M = N = n/2 when n is even.  It is the method with
%   "no control over the occurrence of poles in the interval of interpolation",
%   and this routine returns those poles so that they can be drawn.
%
%   The interpolation conditions p(x_i) - y_i q(x_i) = 0 are linear in the
%   coefficients, so the coefficient vector is a null vector of an
%   (n+1) x (n+2) matrix, which we take from the last right singular vector.
%   Everything is done in a variable rescaled to [-1, 1], since the monomial
%   basis on the original interval is badly conditioned.
%
%   Note that solving the linearised conditions does not guarantee that the
%   quotient actually interpolates: a common root of p and q at some x_i (an
%   "unattainable point") is possible.  That is a further wrinkle of the
%   classical method, not a bug here.

x = x(:).';
y = y(:).';
n = numel(x) - 1;
M = ceil(n / 2);
N = n - M;

a = min(x);
b = max(x);
c0 = (a + b) / 2;
sc = (b - a) / 2;
xs = (x - c0) / sc;

V = zeros(n + 1, M + N + 2);
for i = 1:(n + 1)
    V(i, 1:(M + 1)) = xs(i).^(M:-1:0);
    V(i, (M + 2):end) = -y(i) * xs(i).^(N:-1:0);
end

[~, ~, W] = svd(V);
c = W(:, end).';
pc = c(1:(M + 1));
qc = c((M + 2):end);

ts = (t - c0) / sc;
r = polyval(pc, ts) ./ polyval(qc, ts);
r = reshape(r, size(t));

% real poles = real roots of q, mapped back to the original variable
poles = [];
tol = 1e-13 * max(abs(qc));
k0 = find(abs(qc) > tol, 1);
if ~isempty(k0) && numel(qc) - k0 >= 1
    z = roots(qc(k0:end));
    z = z(:).';
    keep = abs(imag(z)) < 1e-7 * max(1, max(abs(z)));
    poles = sort(real(z(keep)) * sc + c0);
end
end
