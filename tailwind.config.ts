import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        chassis: "var(--chassis)",
        panel: "var(--panel)",
        "panel-raised": "var(--panel-raised)",
        ink: "var(--ink)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        signal: "var(--signal)",
        "signal-dim": "var(--signal-dim)",
        "map-bg": "var(--map-bg)",
        muted: "var(--muted)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      backgroundImage: {
        "paper-noise": "url('/textures/paper-noise.svg')",
      },
      maxWidth: {
        phone: "32rem",
      },
      borderRadius: {
        chassis: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
