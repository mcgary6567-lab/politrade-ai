/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 900: "#0a0f1c", 800: "#0d1322", 700: "#121a2e", 600: "#1a2440", 500: "#24314f" },
        line: "#223052",
        gold: { DEFAULT: "#e7b23c", 600: "#d79f26", 300: "#f3cf74" },
        buy: "#22c58b", sell: "#f26a6a",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
