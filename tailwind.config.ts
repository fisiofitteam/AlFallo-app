import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Mapeadas a variables CSS para theming claro/oscuro (ver globals.css).
        bg: "var(--c-bg)",
        surface: "var(--c-surface)",
        "surface-2": "var(--c-surface-2)",
        border: "var(--c-border)",
        text: "var(--c-text)",
        muted: "var(--c-muted)",
        primary: "var(--c-primary)",
        "primary-fg": "var(--c-primary-fg)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
