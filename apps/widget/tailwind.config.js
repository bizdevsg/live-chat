/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: "#D4AF37",
        ink: "#0b0b0c",
      },
    },
  },
  plugins: [],
};
