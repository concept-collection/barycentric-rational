% ---------------------------------------------------------------------------
% Berrut's interpolant: the d = 0 member of the family
%   J.-P. Berrut, Comput. Math. Appl. 15 (1988) 1-16
%
% Equation (3) of the paper.  The weights are simply the alternating signs,
%
%   w_k = (-1)^k,
%
% which is what equation (18) reduces to when d = 0 (up to a common positive
% factor, which does not change r).  Berrut showed this has no real poles;
% Floater and Hormann's Theorem 3 gives it the rate O(h), but only under a
% bound on the local mesh ratio beta.  Set the nodes to "paired" and watch what
% happens: the interpolant develops kinks and the error stops falling, while
% the d >= 1 members of the family are untroubled.
%
% The d slider is ignored by this script.
% ---------------------------------------------------------------------------

function w = bary_weights(x, d)
n = numel(x) - 1;
w = (-1).^(0:n);
end

function r = bary_eval(x, y, w, t)
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
% With d = 0 the "local polynomials" are the constants p_i = f_i, and the
% blending functions are mu_i(t) = prod_{j<i} (t - x_j) * prod_{k>i} (x_k - t)
% normalised to sum to 1.
n = numel(x) - 1;
t = reshape(t, 1, []);
P = repmat(y(:), 1, numel(t));
Mu = zeros(n + 1, numel(t));
for i = 0:n
    pr = ones(1, numel(t));
    for j = 0:(i - 1)
        pr = pr .* (t - x(j + 1));
    end
    for k = (i + 1):n
        pr = pr .* (x(k + 1) - t);
    end
    Mu(i + 1, :) = pr;
end
L = Mu ./ sum(Mu, 1);
end
