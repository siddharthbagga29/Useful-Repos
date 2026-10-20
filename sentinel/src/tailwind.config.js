module.exports = {
  content: ['./src.html'],
  theme: {
    extend: {
      colors: {
        ink:   '#f2f6f8',
        dim:   '#9aa7b1',
        faint: '#7c8894',
        teal:  { DEFAULT:'#1cc0a8', deep:'#0d6d61', glow:'#39e8cc' },
        amber: { DEFAULT:'#ff7a2f', deep:'#a1441a' },
        rose:  { DEFAULT:'#ff5470', deep:'#8f2338' },
        sky:   '#7fb4d8',
      },
      fontFamily: {
        sans: ['Helvetica Neue','Inter','-apple-system','BlinkMacSystemFont','Segoe UI','Arial','sans-serif'],
        mono: ['ui-monospace','SF Mono','SFMono-Regular','Menlo','Consolas','monospace'],
      },
      // The design uses fine-grained alpha (white/8, white/12, teal/45...).
      // Tailwind's default opacity scale is coarse, so extend it to every
      // integer — this makes any `/NN` modifier valid, including inside @apply.
      opacity: Object.fromEntries(
        Array.from({ length: 101 }, (_, i) => [String(i), String(i / 100)])
      ),
      backdropBlur: { xs:'2px' },
      maxWidth: { content:'1200px' },
    },
  },
  plugins: [],
};
