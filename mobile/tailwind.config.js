// Token values match ../web's Tailwind config (see docs/05-uiux-design.md §4) —
// same source of truth, not shared code, per the fully-separate-codebases decision.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#2563EB", // Blue 600
        success: "#16A34A", // Green 600
        warning: "#F59E0B", // Amber 500
        danger: "#DC2626", // Red 600
      },
      borderRadius: {
        card: 8,
        pill: 999,
      },
    },
  },
  plugins: [],
};
