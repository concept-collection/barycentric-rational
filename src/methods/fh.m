% ---------------------------------------------------------------------------
% Floater-Hormann barycentric rational interpolation
%   M. S. Floater and K. Hormann, Numer. Math. 107 (2007) 315-331
%
% This script is the method.  Everything the four tabs draw comes out of the
% functions below, so editing them changes the pictures.
%
%   w = bary_weights(x, d)             weights of equation (18)      [required]
%   r = bary_eval(x, y, w, t)          barycentric form, equation (1)[required]
%   [P, L] = local_blend(x, y, d, t)   the blend of (4) and (5)      [optional]
% ---------------------------------------------------------------------------

function w = bary_weights(x, d)
% Equation (18).  With J_k = { i : k-d <= i <= k } intersected with {0,...,n-d},
%
%   w_k = sum_{i in J_k} (-1)^i prod_{j=i, j~=k}^{i+d} 1 / (x_k - x_j).
%
% Every k lies in the window of at most d+1 of the local polynomials, so this
% costs O(n d^2) however the nodes are placed.
n = numel(x) - 1;
d = min(max(d, 0), n);
w = zeros(1, n + 1);
for k = 0:n
    s = 0;
    for i = max(0, k - d):min(k, n - d)
        p = 1;
        for j = i:(i + d)
            if j ~= k
                p = p / (x(k + 1) - x(j + 1));
            end
        end
        s = s + (-1)^i * p;
    end
    w(k + 1) = s;
end
end

function r = bary_eval(x, y, w, t)
% Equation (1):
%
%   r(t) = sum_k w_k f_k / (t - x_k)  /  sum_k w_k / (t - x_k).
%
% Berrut and Trefethen's advice is followed at the nodes themselves: if t is
% exactly some x_k, return f_k rather than dividing by zero.
sz = size(t);
D = t(:) - x(:).';
Q = w(:).' ./ D;
r = (Q * y(:)) ./ sum(Q, 2);
hit = find(any(D == 0, 2));
for m = 1:numel(hit)
    k = find(D(hit(m), :) == 0, 1);
    r(hit(m)) = y(k);
end
r = reshape(r, sz);
end

function [P, L] = local_blend(x, y, d, t)
% Equations (4) and (5), the construction the barycentric form above is a
% rewriting of.  P(i+1,:) is the polynomial p_i of degree at most d through the
% d+1 points x_i, ..., x_{i+d}, and L(i+1,:) is the blending function lambda_i
% normalised so that the columns of L sum to 1.  Then r = sum_i L_i p_i.
%
% We build the blending functions from mu_i of equation (9),
%
%   mu_i(t) = prod_{j<i} (t - x_j) * prod_{k>i+d} (x_k - t),
%
% rather than from lambda_i of equation (5) directly.  The two differ by a
% factor that does not depend on i, so they normalise to the same thing, but
% mu_i is a polynomial and so has nothing to blow up at the nodes.  Its sum is
% the s(x) that Theorem 1 shows is positive, which is why L is well defined
% everywhere.
n = numel(x) - 1;
d = min(max(d, 0), n);
t = reshape(t, 1, []);
m = n - d + 1;

P = zeros(m, numel(t));
Mu = zeros(m, numel(t));
for i = 0:(n - d)
    idx = (i + 1):(i + d + 1);
    P(i + 1, :) = local_poly(x(idx), y(idx), t);
    pr = ones(1, numel(t));
    for j = 0:(i - 1)
        pr = pr .* (t - x(j + 1));
    end
    for k = (i + d + 1):n
        pr = pr .* (x(k + 1) - t);
    end
    Mu(i + 1, :) = pr;
end
L = Mu ./ sum(Mu, 1);
end

function p = local_poly(xi, yi, t)
% Lagrange form of the polynomial of degree at most numel(xi)-1 through (xi, yi).
p = zeros(1, numel(t));
for k = 1:numel(xi)
    b = ones(1, numel(t));
    for j = 1:numel(xi)
        if j ~= k
            b = b .* (t - xi(j)) / (xi(k) - xi(j));
        end
    end
    p = p + yi(k) * b;
end
end
