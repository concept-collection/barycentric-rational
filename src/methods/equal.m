% ---------------------------------------------------------------------------
% All weights equal: what the alternating signs are for
%
%   w_k = 1 for every k.
%
% This is a perfectly good barycentric formula and it does interpolate: at each
% node the k-th term dominates and r(x_k) = f_k.  Between two consecutive nodes,
% though, the denominator
%
%   sum_k 1 / (t - x_k)
%
% runs from +infinity at the left node down to -infinity at the right one, so it
% crosses zero somewhere in every interval.  Each of those crossings is a pole.
% Open the Poles tab: n real poles, one per interval, and the roots that
% Theorem 1 keeps off the real axis are sitting right on it.
%
% Schneider and Werner proved that the weights of a pole-free barycentric
% rational interpolant must alternate in sign, and the paper checks that the
% weights of equation (18) do.  This script is the other side of that statement.
% Put a (-1)^k back in and the poles disappear -- that is Berrut's interpolant.
%
% The d slider is ignored by this script.
% ---------------------------------------------------------------------------

function w = bary_weights(x, d)
w = ones(1, numel(x));
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
