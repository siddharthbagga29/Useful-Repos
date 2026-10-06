---
tags: [review, underwriting]
---
# Deal Analyzer v1 audit

**Bugs found.**
1. Rehab contingency recommended but never applied.
2. End buyer's selling, closing and holding costs missing from their margin.
3. Two minimum margins (15% in the signal, 20% in the guidance).
4. Return on cash ignored marketing spend.
5. Expected profit ignored the close rate.

**Effect.** The example deal flipped from GO to NO-GO. **Fixed in** [[Deal Analyzer v2]].
