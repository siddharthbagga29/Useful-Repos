---
tags: [quant, method, thesis, llm]
---
# Search needs a locked holdout

**Claim.** An automated search over strategies will always find something that looks good in-sample. The defence is a holdout the search never sees, plus a statistic that charges for every trial.

**Implementation.** The [[Brain evolution loop]] selects on 2016–2021 data only; a test scrambles every post-2021 price and proves nothing it chooses changes. Scores are discounted by the [[Deflated Sharpe ratio]], which grows stricter as the trial count grows.

**Known weakness.** Choosing the eight ETFs in 2026 is itself hindsight. A champion that beats SPY out of sample is evidence, not proof.
