/** @type {import('tailwindcss').Config} */
// Every colour is a CSS variable (see src/index.css) so the same classes render the dark or the
// light palette depending on <html data-theme>. Values are "r g b" so Tailwind's /opacity still works.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (name, steps) => Object.fromEntries(steps.map((s) => [s, v(`${name}-${s}`)]));

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: scale("ink", [900, 800, 700, 600, 500]),
        line: v("line"),
        gold: { DEFAULT: v("gold"), 600: v("gold-600"), 300: v("gold-300") },
        buy: v("buy"), sell: v("sell"),
        // text greys flip in light mode (slate-100 = strongest text, slate-600 = faintest)
        slate: scale("slate", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        // party tones: readable on both backgrounds
        sky: { 400: v("party-d") }, rose: { 400: v("party-r") }, violet: { 300: v("party-i") },
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
