import type { Config } from "tailwindcss";
import { createPreset } from "fumadocs-ui/tailwind-plugin";

const light = {
  background: "0 0% 100%",
  foreground: "0 0% 4%",
  muted: "0 0% 100%",
  "muted-foreground": "0 0% 36%",
  popover: "0 0% 100%",
  "popover-foreground": "0 0% 4%",
  card: "0 0% 100%",
  "card-foreground": "0 0% 4%",
  border: "0 0% 91.8%",
  primary: "0 0% 0%",
  "primary-foreground": "0 0% 100%",
  secondary: "0 0% 100%",
  "secondary-foreground": "0 0% 4%",
  accent: "0 0% 98%",
  "accent-foreground": "0 0% 4%",
  ring: "0 0% 0%",
};

const dark = {
  background: "0 0% 0%",
  foreground: "0 0% 93%",
  muted: "0 0% 4%",
  "muted-foreground": "0 0% 64%",
  popover: "0 0% 4%",
  "popover-foreground": "0 0% 93%",
  card: "0 0% 0%",
  "card-foreground": "0 0% 93%",
  border: "0 0% 16%",
  primary: "0 0% 100%",
  "primary-foreground": "0 0% 0%",
  secondary: "0 0% 4%",
  "secondary-foreground": "0 0% 93%",
  accent: "0 0% 8%",
  "accent-foreground": "0 0% 93%",
  ring: "0 0% 100%",
};

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./node_modules/fumadocs-ui/dist/**/*.js"],
  presets: [
    createPreset({
      addGlobalColors: true,
      preset: { light, dark },
    }),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
};

export default config;
