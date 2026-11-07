const rock = { 50: "#fbf3ee", 100: "#f5e1d5", 300: "#e2a585", 500: "#c4623a", 600: "#a94c28", 800: "#6b2f1a" };
const alpine = { 50: "#eef5f4", 100: "#d5e7e4", 300: "#86b8b0", 500: "#2f7f76", 700: "#1d544f", 900: "#12332f" };
const sand = "#f7f1e8";
const ink = "#231a15";
const dusk = "#6e625a";

/** @type {import('tailwindcss').Config} */
export default {
  // The site has no dark theme; without this, dark: classes follow the OS and turn buttons black.
  darkMode: 'selector',
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // The site has no dark theme. The default "media" let dark: classes follow the OS and put ink text on near-black buttons.
  darkMode: "selector",
  theme: {
    extend: {
      colors: {
        rock,
        alpine,
        sand,
        ink,
        dusk,
        // Semantic tokens: new code uses these. src/components/ui/tokens.test.ts holds them to WCAG AA.
        surface: sand,
        "surface-raised": "#ffffff",
        "surface-sunken": rock[50],
        border: rock[100],
        "border-strong": dusk,
        // Unfilled slider track and ticks: 3:1 on every surface, and lighter than primary so the fill reads.
        track: "#8f8378",
        text: ink,
        "text-muted": dusk,
        primary: rock[600],
        "primary-hover": rock[800],
        "on-primary": "#ffffff",
        danger: rock[800],
        success: alpine[700],
        focus: alpine[500],
      },
      fontSize: {
        caption: ["0.75rem", { lineHeight: "1rem" }],
        small: ["0.875rem", { lineHeight: "1.25rem" }],
        body: ["1rem", { lineHeight: "1.5rem" }],
        title: ["1.25rem", { lineHeight: "1.75rem" }],
        heading: ["1.5rem", { lineHeight: "2rem" }],
        display: ["clamp(2.25rem, 6vw, 3.5rem)", { lineHeight: "1.1" }],
      },
      spacing: {
        gutter: "1rem",
        stack: "1.5rem",
        section: "3rem",
      },
      borderRadius: {
        control: "0.5rem",
        card: "0.75rem",
        pill: "9999px",
      },
      boxShadow: {
        raised: "0 1px 2px rgb(35 26 21 / 0.06), 0 4px 12px rgb(35 26 21 / 0.06)",
        overlay: "0 12px 40px rgb(35 26 21 / 0.24)",
      },
      zIndex: {
        // Above Leaflet's panes and controls, which reach 1000.
        header: "1100",
      },
      fontFamily: {
        display: ["Iowan Old Style", "Palatino Linotype", "Palatino", "Georgia", "serif"],
        sans: ["ui-sans-serif", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
