# Claude Code design skills

Animation / 3D / motion skills installed for this project so Claude Code has
consistent guidance when building immersive ("Unseen-style") front-end work.

## Installed (22)

**Core 3D & animation**
`threejs-webgl` · `react-three-fiber` · `gsap-scrolltrigger` · `motion-framer` · `babylonjs-engine`

**Scroll & page transitions**
`locomotive-scroll` · `scroll-reveal-libraries` · `barba-js`

**2D / WebXR / engines**
`pixijs-2d` · `playcanvas-engine` · `aframe-webxr` · `lightweight-3d-effects`

**Component & micro-animation**
`react-spring-physics` · `animejs` · `lottie-animations` · `animated-component-libraries`

**Authoring pipelines**
`blender-web-pipeline` · `spline-interactive` · `rive-interactive` · `substance-3d-texturing`

**Signature looks (Siddharth's own specs)**
`particle-brain-hero` — the Tunnel particle wormhole + Jarvis's particle brain, framed by the Atelier scrim

**Meta**
`web3d-integration-patterns` · `modern-web-design`

## Not installed

`skill-creator` — upstream ships one, but Claude Code already provides a
built-in skill of that name; a project copy would shadow it. Omitted on purpose.

## Source & license

Vendored from **https://github.com/freshtechbro/claudedesignskills** —
MIT License, Copyright (c) 2025 Claude Skills Project. Unmodified copies of the
upstream `skills/*` folders (taken from `plugins/individual/*` where available,
otherwise `plugins/bundles/*`).

Upstream also publishes these as a Claude Code plugin marketplace. To track
upstream updates instead of these vendored copies, run in an interactive
Claude Code session:

```
/plugin marketplace add freshtechbro/claudedesignskills
/plugin install core-3d-animation
/plugin install extended-3d-scroll
/plugin install animation-components
/plugin install authoring-motion
/plugin install meta-skills
```

...then delete this directory.

## Research and Instagram

| skill | source | what it does |
| --- | --- | --- |
| `last30days` | [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) @ 7f582ad (MIT) | Research what people actually said about a topic in the last 30 days across Reddit, X, YouTube, TikTok, Instagram, HN, Polymarket, GitHub and the web. See `last30days/SOURCE.md` for the install review. |
| `ig-*` (13) | [Jakeschincariol/instagram-agent-skill](https://github.com/Jakeschincariol/instagram-agent-skill) @ d03c56b (MIT) | Reels, captions, carousels, stories, profile, planning, humanizer, comments, replies, DMs, repurposing, viral research and audits. Writes only; nothing posts on its own. |
| `instagram-autopilot` | this repo | The weekly loop over both: research, plan, draft, humanize, approve, optional official-API publish, audit. State lives in `../instagram/`. |
