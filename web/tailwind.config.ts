import type { Config } from "tailwindcss";

// Web now runs its own visual identity ("Your spec": stone-grey + deep sage + Cambria +
// full-radius cards), independently from ../mobile's NativeWind tokens — the two are
// deliberately no longer the same palette (see the dual-platform "shared design
// language, not shared code" decision; web's read as too generic and diverged on
// purpose). Overriding Tailwind's own `gray`/`blue` scales (not just adding new custom
// tokens) is what makes the new palette apply across every existing page automatically —
// they were built entirely from `gray-*`/`blue-50` utilities, not hardcoded hex.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#3F5C40", // deep sage — the one accent
        success: "#3F5C40", // reuses sage rather than a separate green — one accent, not two
        warning: "#C1531C", // burnt orange — reserved for "needs attention" (overdue, due-soon)
        danger: "#A83A3A", // muted brick red — true errors only, kept distinct from warning-orange
        gray: {
          50: "#F8F7F4",
          100: "#F1EFE9",
          200: "#E4E2DB",
          300: "#CFCDC3",
          400: "#B3B0A4",
          500: "#8C8979",
          600: "#6B6858",
          700: "#4A483F",
          800: "#33322B",
          900: "#292824",
        },
        blue: {
          50: "#E9EFE9", // sage-tinted "selected" background, replaces literal blue-50
          100: "#DCE6DC",
          600: "#3F5C40",
          700: "#33492F",
        },
      },
      borderRadius: {
        card: "18px", // full soft radius, was 8px
        pill: "999px",
      },
      fontFamily: {
        sans: ["Cambria", "Georgia", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
