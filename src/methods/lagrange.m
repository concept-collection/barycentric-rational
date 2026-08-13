% ---------------------------------------------------------------------------
% The polynomial interpolant, in barycentric form: the d = n member
%
% Equation (2), first written down by Taylor and by Dupuy:
%
%   w_k = prod_{j ~= k} 1 / (x_k - x_j).
%
% These are what equation (18) gives when d = n, since then there is a single
% local polynomial and it is the interpolating polynomial p_n itself.  The
% paper's remark that the weights of (2) "prevent poles" is visible on the
% Poles tab in a degenerate way: the denominator of r reduces to the constant 1,
% because the Lagrange basis functions sum to 1, so there is nothing to vanish
% and no roots at all.
%
% Having no poles is not the same as approximating well.  Leave the function at
% Runge's 1/(1+x^2), the nodes uniform, and push n up: this is the divergence
% the paper opens with.  Switch the nodes to Chebyshev and it behaves.
%
% The d slider is ignored by this script.
% ---------------------------------------------------------------------------

function w = bary_weights(x, d)
n1 = numel(x);
w = zeros(1, n1);
for k = 1:n1
    p = 1;
    for j = 1:n1
        if j ~= k
            p = p / (x(k) - x(j));
        end
    end
    w(k) = p;
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
