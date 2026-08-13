function [y, dy] = testfun(name, x, expr)
%TESTFUN  The functions interpolated in Section 5 of the paper, plus a custom one.
%
%   [y, dy] = testfun(name, x, expr) returns f(x) and f'(x).  The derivative is
%   only used for the clamped end conditions of the C^2 cubic spline that the
%   paper compares against in Tables 3 and 4.

switch name
    case 'runge'
        y = 1 ./ (1 + x.^2);
        dy = -2 * x ./ (1 + x.^2).^2;
    case 'sine'
        y = sin(x);
        dy = cos(x);
    case 'abs'
        y = abs(x);
        dy = sign(x);
    case 'custom'
        y = evalexpr(expr, x);
        h = 1e-6 * max(1, max(abs(x(:))));
        dy = (evalexpr(expr, x + h) - evalexpr(expr, x - h)) / (2 * h);
    otherwise
        error('testfun: unknown function ''%s''', name);
end
y = reshape(y, size(x));
dy = reshape(dy, size(x));
end
