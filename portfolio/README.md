# Portfolio + in-browser Jarvis

React 19 + Framer Motion site for Siddharth Bagga, with **Jarvis**, a personal AI assistant that runs
entirely in the visitor's browser. No server, no API keys, no cost.

| Piece | How |
|---|---|
| Film | Vertical scroll drives a horizontal film (`useScroll` → `useSpring` → `useTransform`); vertical stack on phones and with reduced motion |
| Analyst | Canvas character whose activity follows the station; taps stamp APPROVED, scroll speed makes him type faster |
| Jarvis engine | Guard → curated intents → skills → BM25 retrieval over `../jarvis/knowledge/brief.md`, with citations and a trace |
| Agents | Chat, Research (splits compound questions, cites each part), Briefing (60-second spoken digest) |
| Skills | `navigate`, `set_dcf`, `open_exhibit`, `draft_email`, `remember`; side-effects only on the visitor's click |
| Voice | Web Speech API: push-to-talk and hands-free "Hey Jarvis"; spoken answers |
| On-device LLM | Optional WebLLM (Llama 3.2 1B, WebGPU) in a worker, lazy-loaded, output guarded against known-false claims |
| Memory | `localStorage` only |

The brief is the same file the Python service in `../jarvis` answers from, so both stay in sync.

```bash
npm install
npm run dev          # http://localhost:5173
npm run eval         # recruiter eval cases (../jarvis/knowledge/eval_cases.toml) + skill checks
npm run build && npx vite preview --port 4173 &
python3 e2e/e2e.py   # Playwright: film, terminal, model, voice (faked mic), agents, memory, mobile
```

Deploy: `scripts/deploy.sh` pushes `dist/` to the `siddharthbagga29.github.io` repository (GitHub Pages, free).
