% ---------------------------------------------------------------------------
% The integer weights of Section 4, for equally spaced nodes
%
% When the nodes are uniform with spacing h, equation (18) collapses to
%
%   w_k = (-1)^(k-d) / h^d * sum_{i in J_k} 1 / ((k-i)! (i+d-k)!),
%
% and since a common positive factor does not change r we may multiply by
% d! h^d and read off integers:
%
%   w_k = (-1)^(k-d) * sum_{i in J_k} binomial(d, k-i).
%
% Writing delta_k = |w_k|, the first few rows are the ones tabulated in the
% paper:
%
%   d = 0:  1, 1, ..., 1, 1
%   d = 1:  1, 2, 2, ..., 2, 2, 1
%   d = 2:  1, 3, 4, ..., 4, 3, 1
%   d = 3:  1, 4, 7, 8, 8, ..., 8, 8, 7, 4, 1
%   d = 4:  1, 5, 11, 15, 16, 16, ..., 16, 16, 15, 11, 5, 1
%
% Almost every weight is the same; the only difference is at the two ends.
% Yet that small change is what raises the approximation order from O(h) to
% O(h^(d+1)).  The "Blending & weights" tab checks these against the general
% formula, so switching between this script and the main one should leave the
% pictures identical -- as long as the nodes stay uniform.  Choose any other
% node distribution and these weights are no longer the right ones, and the
% "Poles" tab may well find real poles.
% ---------------------------------------------------------------------------

function w = bary_weights(x, d)
n = numel(x) - 1;
d = min(max(d, 0), n);
w = zeros(1, n + 1);
for k = 0:n
    s = 0;
    for i = max(0, k - d):min(k, n - d)
        s = s + nchoosek(d, k - i);
    end
    w(k + 1) = (-1)^(k - d) * s;
end
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
