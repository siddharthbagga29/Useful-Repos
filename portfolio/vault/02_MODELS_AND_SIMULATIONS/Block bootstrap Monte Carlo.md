---
tags: [quant, montecarlo]
---
# Block bootstrap Monte Carlo

1,000 ten-year paths built by resampling whole weeks of all eight assets at once, in blocks of geometric length (mean 8 weeks), seed 20261006. Keeps cross-asset correlation and volatility clustering. Method: [[Politis & Romano 1994]].

Reports, per rule: CAGR, drawdown and Sharpe quantiles, and the probability of beating SPY on return, Sharpe and Calmar, or of a shallower drawdown. Result: [[Defense over offense]].
