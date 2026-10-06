---
tags: [review, quant]
---
# 2026-10 · OPS review

**Attempted.** Replicate the paper's ranking of online portfolio selection rules.
**What went wrong.** At zero cost the replication agreed with the paper, and that agreement was the trap: the ranking reverses once trades cost money.
**Fix.** Report every rule across a [[Cost sweep]], freeze parameters before the holdout, and lead with the cost-adjusted result. See [[OPS replication]].
