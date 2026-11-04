import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.18)",
        pop: "0 24px 60px rgba(0,0,0,0.55)",
      },
      colors: {
        gold: {
          50: "#fdf8ec",
          100: "#f8ecc9",
          300: "#e9cd7a",
          400: "#dfbd55",
          500: "#D4AF37",
          600: "#b6912a",
          700: "#8f7020",
        },
        ink: {
          950: "#08080a",
          900: "#0c0c0e",
          800: "#131316",
          700: "#1b1b1f",
          600: "#2a2a30",
          500: "#3a3a42",
        },
      },
    },
  },
  plugins: [],
};

export default config;
