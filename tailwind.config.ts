import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Discord-like dark palette: server rail, channel sidebar, chat pane, member list
        surface: {
          DEFAULT: "#313338",
          rail: "#1e1f22",
          sidebar: "#2b2d31",
          panel: "#383a40",
          hover: "#3f4147",
        },
        accent: {
          DEFAULT: "#5865f2",
          hover: "#4752c4",
        },
        online: "#23a55a",
        offline: "#80848e",
        danger: "#da373c",
      },
    },
  },
  plugins: [],
} satisfies Config;
