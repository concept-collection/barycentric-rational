function y = evalexpr(expr, x)
%EVALEXPR  Evaluate a user-typed expression in the variable x.

y = eval(expr);
if numel(y) == 1 && numel(x) ~= 1
    y = y * ones(size(x));
end
end
