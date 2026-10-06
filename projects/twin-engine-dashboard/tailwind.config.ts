import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Monochromatic slate ground (the "unseen audio" palette) ──
        void: '#0b0e14',        // app background
        surface: '#12161f',     // card ground
        'surface-2': '#171c26', // raised / inset card
        line: '#232936',        // hairline borders & tracks
        ink: '#f2f3f5',         // primary off-white
        'ink-2': '#b9bec7',     // secondary text
        muted: '#6f757f',       // captions / labels
        // ── Restrained market keylines (desaturated; set to slate for pure mono) ──
        us: '#5b8bd0',          // US steel
        in: '#d0a24e',          // IN brass
        // ── Functional status only — never decorative ──
        clean: '#4ea87c',
        attention: '#c79a54',
        breach: '#c76b6b',
      },
      borderRadius: {
        squircle: '16px', // 16px soft-squircle (see globals.css for true superellipse)
      },
      boxShadow: {
        tile: '0 1px 2px rgba(0,0,0,.4)',
        'tile-raised': '0 1px 2px rgba(0,0,0,.4), 0 12px 40px rgba(0,0,0,.35)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        micro: '0.14em',
      },
    },
  },
  plugins: [],
};

export default config;
