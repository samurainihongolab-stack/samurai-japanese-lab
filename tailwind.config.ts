import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "samurai-navy": "#082D6B",
        "samurai-blue": "#0077D6",
        "samurai-gold": "#FFD600",
        "samurai-red": "#E60012",
        "samurai-light": "#E6F4FF",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
