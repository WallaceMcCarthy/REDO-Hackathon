/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rock: { 50: "#fbf3ee", 100: "#f5e1d5", 300: "#e2a585", 500: "#c4623a", 600: "#a94c28", 800: "#6b2f1a" },
        alpine: { 50: "#eef5f4", 100: "#d5e7e4", 300: "#86b8b0", 500: "#2f7f76", 700: "#1d544f", 900: "#12332f" },
        sand: "#f7f1e8",
        ink: "#231a15",
        dusk: "#6e625a",
      },
      fontFamily: {
        display: ["Iowan Old Style", "Palatino Linotype", "Palatino", "Georgia", "serif"],
        sans: ["ui-sans-serif", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
