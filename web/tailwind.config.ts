import type { Config } from "tailwindcss";

// Token values match ../mobile's NativeWind config (see docs/05-uiux-design.md §4) —
// same source of truth, not shared code, per the fully-separate-codebases decision.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2563EB", // Blue 600
        success: "#16A34A", // Green 600
        warning: "#F59E0B", // Amber 500
        danger: "#DC2626", // Red 600
      },
      borderRadius: {
        card: "8px",
        pill: "999px",
      },
    },
  },
  plugins: [],
};

export default config;
