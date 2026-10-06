---
tags: [quant, llm, backtest, agents]
---
# Brain evolution loop

Runs every 6 hours on GitHub Actions at no cost.

1. **Mutate.** Pick a hypothesis family by UCB1 and mutate its best genome (windows, assets, rebalance interval, target volatility, weights). 12% of children are random restarts.
2. **Execute.** Backtest on the selection window only: the code passes a sliced copy of [[Weekly ETF bars]].
3. **Evaluate.** Rubric out of 100: risk-adjusted return 30, fold consistency 20, drawdown 20, costs 10, robustness 20 ([[Deflated Sharpe ratio]]).
4. **Rate.** Play the challenger against the champion on four folds with Elo updates. Promotion needs more fold wins than losses, a higher score, a drawdown above −35% and cost drag under 1.5% a year.
5. **Remember.** Log why each loser lost; turnover or drawdown failures bias the next mutations (slower rebalancing, more defensive settings). Step sizes follow Rechenberg's 1/5 success rule.

Holdout results are reported for the champion only. Thesis: [[Search needs a locked holdout]]. Inspired by autonomous research loops: [[Autonomous research loops]].
