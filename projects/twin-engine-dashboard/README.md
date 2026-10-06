# Twin-Engine · Command — Dashboard Blueprint

A Next.js (App Router) + TypeScript + Tailwind command center for the Twin-Engine
real-estate platform. Swiss-minimalist, monochromatic slate, bento grid.

## File tree

```
twin-engine-dashboard/
├─ app/
│  ├─ globals.css          # tokens, superellipse squircle, reduced-motion
│  ├─ layout.tsx           # Inter (UI) + JetBrains Mono (figures) via next/font
│  └─ page.tsx             # server component — fetches data, renders layout
├─ components/
│  ├─ DashboardLayout.tsx  # masthead + 4-col bento grid (composition root)
│  ├─ MarketTile.tsx       # US / IN engine tile with stage rail
│  ├─ ROIIndicator.tsx     # minimal stat tile + hairline sparkline (no chart lib)
│  └─ ComplianceWidget.tsx # exit-critical "Clean Books" widget
├─ lib/
│  └─ data.ts              # sample portfolio + Clean-Books checks (swap for your DB)
├─ types/
│  └─ property.ts          # PropertyData interface + pipeline/stage helpers
├─ tailwind.config.ts      # palette, squircle radius, tile shadows, fonts
└─ preview.html            # standalone visual preview (no build needed)
```

## Run it

```bash
npx create-next-app@latest twin-engine --ts --tailwind --app --eslint
# then drop these files in, matching the tree above, and:
npm run dev
```

`@/` path alias assumes the default `tsconfig.json` `"paths": { "@/*": ["./*"] }`
that create-next-app generates. Fonts load via `next/font` (no CDN request).

To see it instantly with zero setup, just open **`preview.html`** in any browser.

---

## Implementation Guide — why this grid reads as "premium" (and helps sell the machine)

**1. The bento grid is an information hierarchy, not decoration.**
The 4-column grid with deliberately uneven spans (`col-span-2 row-span-2` on
Compliance, `col-span-1` on the ROI tiles) does one job: it tells the eye what
matters *before* a single number is read. The Clean Books widget is the largest,
most-raised surface on the screen because it is the metric a Tier-1 acquirer
diligences first. Sizing = priority. A family office scanning this in five seconds
learns your thesis: *books first, engines second, vanity metrics never.*

**2. Negative space signals confidence.**
Cheap dashboards fear empty pixels and fill them with gauges. Institutional tools
leave room. Each tile carries one idea, generous padding, and at most one hairline
sparkline. The restraint reads as "this operator knows which number matters" — the
exact impression that supports a premium exit multiple.

**3. Monochrome + a single functional accent = auditability made visible.**
The slate palette is nearly colorless on purpose. Color is spent only where it
carries meaning: the desaturated US-steel / IN-brass keylines to tell the two
engines apart, and the status ring on Compliance (amber = attention, green =
audit-ready). Because color is never decorative, when something *does* glow amber,
it means *act now*. That discipline is the visual language of a firm with clean books.

**4. Monospace figures = ledger credibility.**
Every number renders in JetBrains Mono with `tabular-nums`, so digits align in
columns and read like an audited statement, not a marketing page. Small cue, large
trust dividend when a diligence analyst is the viewer.

**5. The squircle + micro-shadow is the "engineered object" tell.**
16px superellipse corners (`corner-shape: superellipse(4)`, graceful fallback to
`border-radius`) and the whisper-quiet `0 1px 2px rgba(0,0,0,.4)` shadow make each
tile feel milled rather than drawn. Combined with the faint engraved grid on the
Compliance card, the surface feels like a physical instrument — a command console,
not a web app.

**6. Architecture is part of the pitch.**
`PropertyData` is the single source of truth; `MarketTile`, `ROIIndicator`, and
`ComplianceWidget` are pure, presentational, and reusable; `page.tsx` is the only
place data enters. When you eventually sell the *platform*, this clean separation —
typed domain model, dumb components, one data boundary — is what makes an acquirer's
engineers say "we can run this on day one." The code's tidiness mirrors the books'
tidiness, and both are what you're actually selling.

**Wiring real data:** replace the static import in `app/page.tsx` with your query
(e.g. a Supabase call returning `PropertyRecord[]` + the compliance checks). Nothing
in the components changes — they already speak `PropertyData`. Keep the Clean Books
checks computed server-side from source records so the index can never be faked in
the client; that server-truth is the whole point of the widget.
```
