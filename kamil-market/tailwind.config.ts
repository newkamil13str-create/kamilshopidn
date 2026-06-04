import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0a0a0a",
          secondary: "#111111",
          card: "#1a1a1a",
        },
        accent: {
          DEFAULT: "#22c55e",
          hover: "#16a34a",
          muted: "#14532d",
        },
        border: "#2a2a2a",
        "text-primary": "#f5f5f5",
        "text-secondary": "#a3a3a3",
      },
    },
  },
  plugins: [],
}

export default config
