function x = nodes_of(kind, a, b, n, seed)
%NODES_OF  Build n+1 interpolation nodes a = x_0 < x_1 < ... < x_n = b.
%
%   Floater and Hormann's Theorem 2 gives the rate O(h^(d+1)) for d >= 1
%   regardless of how the nodes are distributed, so it is worth being able to
%   distribute them badly.  The 'paired' family below does exactly that: it
%   pulls every second node close to its left neighbour, which drives the local
%   mesh ratio beta of Theorem 3 up and makes the d = 0 case (Berrut's
%   interpolant) misbehave while d >= 1 carries on unaffected.

k = 0:n;
switch kind
    case 'uniform'
        x = a + (b - a) * k / n;
    case 'chebyshev'
        % Chebyshev-Gauss-Lobatto points, clustered at both ends
        x = (a + b) / 2 - (b - a) / 2 * cos(pi * k / n);
    case 'random'
        rng(seed);
        u = sort(rand(1, max(0, n - 1)));
        x = [a, a + (b - a) * u, b];
    case 'paired'
        x = a + (b - a) * k / n;
        h = (b - a) / n;
        % indices 2,4,... are the nodes x_1, x_3, ... (1-based vs 0-based)
        x(2:2:end) = x(2:2:end) - 0.9 * h;
    case 'graded'
        % quadratically graded, clustered at the left end
        x = a + (b - a) * (k / n).^2;
    otherwise
        error('nodes_of: unknown node distribution ''%s''', kind);
end
x = x(:).';
end
