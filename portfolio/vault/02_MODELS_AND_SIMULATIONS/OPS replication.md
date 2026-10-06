---
tags: [quant, backtest]
---
# OPS replication

Uniform constant rebalancing (UCRP), Exponentiated Gradient (EG), PAMR and OLMAR, with the hindsight-optimal BCRP as an oracle. Parameters are chosen on the selection window and frozen for the holdout.

| Rule | 0 bps CAGR | Weekly turnover | Holdout CAGR at 10 bps |
|---|---|---|---|
| PAMR | 10.5% | 55% | 0.8% |
| OLMAR | 9.3% | 55% | 0.4% |
| EG | — | 0.3% | 6.1% |
| SPY | — | — | 12.1% |

See [[Cost sweep]]. Tests [[Costs kill mean reversion]]. Prior work: [[Li & Hoi survey]].
