---
name: instagram-autopilot
description: >-
  Run Siddharth's Instagram as a weekly loop: research what's moving in his niche (last30days +
  ig-viral), plan the week (ig-plan), draft reels, carousels, captions and stories (ig-reel,
  ig-carousel, ig-caption, ig-story), humanize everything (ig-human), queue it for his approval,
  optionally publish approved posts through Instagram's official API, then learn from the results
  (ig-audit). Use when he says "run my Instagram", "instagram autopilot", "plan and draft my week
  on Instagram", "what should I post this week", or "publish the approved posts".
---

# instagram-autopilot

The conductor. The `ig-*` skills and `last30days` do the work; this skill decides the order, keeps
the state, and holds the one rule that matters: **nothing is posted, commented or sent without
Siddharth's explicit yes for that specific item, in this conversation.**

## Step 0: state

The account's memory lives in the repo so it survives cloud sessions:
`<repo>/.claude/instagram/` holds `voice.md`, `swipe.md`, `log.md` and `queue/`.
The `ig-*` skills read `~/.claude/instagram/`, so link it once per session:

```bash
REPO=$(git rev-parse --show-toplevel)
mkdir -p "$REPO/.claude/instagram/queue"
[ -e ~/.claude/instagram ] || ln -s "$REPO/.claude/instagram" ~/.claude/instagram
```

Read `voice.md` first. If its Handle is still TODO, ask for the handle before anything else. Every
other TODO you can work around: say which ones would improve the drafts, once.

## Step 1: research (Mondays, or when asked)

1. `/last30days` on two or three of his themes, phrased the way his audience talks, e.g.
   "breaking into private equity", "small business acquisition due diligence",
   "quant backtest overfitting". Instagram Reels appear in its results only when a
   ScrapeCreators key is set; Reddit, YouTube, HN and the web work without keys. Follow that
   skill's own consent rules (it asks before reading any browser cookies).
2. `/ig-viral` in his niche, with him present if a page needs his login. It ranks reels by how far
   each beat its own account and writes `swipe.md`.
3. Write a five-line research note to `log.md`: the three angles worth taking this week, each
   with the source and the engagement number that justifies it.

## Step 2: plan

`/ig-plan` with the research note and `swipe.md`. Four to five posts, three of them reels.
Every post maps to one of the positions or proof lines in `voice.md`; a post with no proof line
behind it gets cut, not padded.

## Step 3: draft

For each planned post, call the matching skill: `/ig-reel` (hooks scored with `hookscore.py`,
timed with `beats.py`), `/ig-carousel`, `/ig-story`. Then `/ig-caption` for every post
(`caption.py` shows the 125 characters the feed shows). Then `/ig-human` on every piece of text;
nothing reaches Siddharth without passing it.

Finance guardrails, checked on every draft before he sees it:
- No buy/sell/hold language about any security; anything touching markets ends with
  "Not investment advice."
- Backtests are "hypothetical" and never "returns". The CFA line is "won the Level I exam-fee
  scholarship", never "CFA".
- Every number must appear in `voice.md` under Proof, or in the cited research note. No
  `{{your number}}` placeholder ever ships; ask him for the number instead.

Save each draft as `queue/YYYY-MM-DD-<slug>.json`:

```json
{ "id": "2026-10-12-memo-reel", "type": "reel", "status": "draft",
  "caption": "…", "script": "…", "media": [], "scheduled_for": "2026-10-12T17:30:00-04:00",
  "sources": ["…"], "approved": false }
```

## Step 4: review with Siddharth

Show the week as a short table (day, type, hook, status), then each draft in full. He approves,
edits or kills each one. Set `"approved": true` only on his explicit yes for that item, and only
after he has seen the final text. Media (the shot reel, the rendered carousel PNGs) must be
uploaded by him somewhere public over HTTPS before an API publish; put those URLs in `media`.

## Step 5: publish (optional, approved items only)

Default: he posts from his phone, and you mark the item `"status": "posted"` when he says so.

If he has set up Instagram's official API (a professional account, `IG_USER_ID` and
`IG_ACCESS_TOKEN` in his environment, never in the repo), use the publisher in this folder:

```bash
python3 .claude/skills/instagram-autopilot/ig_publish.py limit
python3 .claude/skills/instagram-autopilot/ig_publish.py publish --queue <file>          # dry run
IG_PUBLISH=1 python3 .claude/skills/instagram-autopilot/ig_publish.py publish --queue <file> --yes
```

It refuses anything without `"approved": true`, lints the caption against Instagram's limits,
and prints exactly what it would send (token redacted) unless both `IG_PUBLISH=1` and `--yes` are
present. Run the live form only right after he says "publish it" for that item in this
conversation. One item per command; never loop over the queue.

## Step 6: learn (weekly)

`/ig-audit` on his insights (he pastes them, or `ig_publish.py insights --media <id>` once the API
is set up). Append what worked and what to stop to `log.md`, and carry that into next Monday's
research.

## Never

- Automated likes, follows, comments or DMs, scraping at volume, or logging in for him. These
  break Instagram's Terms and get accounts restricted. `/ig-comment`, `/ig-reply` and `/ig-dm`
  write drafts he sends himself.
- Publishing anything he hasn't approved in this conversation, or batch-publishing the queue.
- Storing tokens, cookies or passwords in the repo.
