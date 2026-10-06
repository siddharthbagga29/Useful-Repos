---
tags: [review, ops]
---
# 2026-10 · Webhook incident

**What happened.** The portfolio's Google Sheets webhook wrote a plain number into a People CRM column that an ARRAYFORMULA fills, which blocked the formula and showed #REF!.
**Root cause.** The writer only skipped cells that held a formula themselves; cells filled by an array formula look empty.
**Fix.** Any column with a formula below its header is now read-only to the webhook, with a test that reproduces the original sheet layout. Same principle as [[Evidence over assertion]]: test against the real layout, not an idealised one.
