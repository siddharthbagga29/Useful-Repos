---
tags: [quant, backtest]
---
# Strategy Lab rules

Six weekly, long-only rules with no leverage and no look-ahead: buy & hold, strategic mix (60/40), trend filter, dual momentum, inverse volatility and volatility target. A signal formed on week t's close earns week t+1's return; a test tampers with future prices and checks that past weights do not move.

Data: [[Weekly ETF bars]]. Stress-tested in [[Block bootstrap Monte Carlo]]. Searched automatically by the [[Brain evolution loop]].
