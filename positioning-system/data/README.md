# Seed data

Import via **File → Import → Upload → Append to current sheet** into the matching
sheet. Column order matches `BuildWorkbook.gs` exactly — do not reorder.

| File | Target sheet |
|---|---|
| `organizations.csv` | Organizations |
| `firms-cincinnati.csv` | Target Companies |
| `path-scoring-model.csv` | reference only — re-weight the ranking in `02-positioning-and-paths.md` |

⚠️ **Every `Verification Status` in these files is `SECONDARY VERIFIED` or
`UNVERIFIED`, and `Revenue Basis` is `UNKNOWN` wherever a figure is absent.**
That is correct and intentional. Promote a row to `VERIFIED` only after you have
confirmed it on the organisation's or firm's own site and set `Date Verified` to
that day. See `../19-verification-protocol.md`.

One row is already `VERIFIED`: Cerity Partners, because you worked there.
