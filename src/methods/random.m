% ---------------------------------------------------------------------------
% Random weights: the generic barycentric rational interpolant
%
% Berrut and Mittelmann's observation, quoted in the paper's introduction, is
% that *every* rational interpolant whose numerator and denominator have degree
% at most n can be written in the barycentric form (1) for some real weights
% w_0, ..., w_n.  So the whole difficulty of the subject is choosing them.  This
% script chooses them at random.
%
% The result still interpolates -- that is free -- but the denominator now
% changes sign wherever it pleases, and the Poles tab finds real poles inside
% the interval.  Reroll with the d slider, which is used here only to reseed.
%
% This is the situation the paper's construction is a way out of: weights that
% are known in advance to give a pole-free interpolant, and one whose
% approximation order can be raised at will.
% ---------------------------------------------------------------------------

function w = bary_weights(x, d)
rng(1 + d);
w = randn(1, numel(x));
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
