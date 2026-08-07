import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        gold: {
          50: "#fdf8ec",
          100: "#f8ecc9",
          300: "#e9cd7a",
          500: "#D4AF37",
          600: "#b6912a",
          700: "#8f7020",
        },
        ink: {
          900: "#0b0b0c",
          800: "#141416",
          700: "#1c1c1f",
          600: "#26262a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
