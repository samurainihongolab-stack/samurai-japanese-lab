import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#082D6B",
        deep: "#061c3c",
        blue: "#0077D6",
        yellow: "#FFD600",
        red: "#E60012",
        pale: "#E6F4FF",
        text: "#142b47",
        muted: "#5b6a7b",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "sans-serif"],
      },
      spacing: {
        "13": "52px",
      },
      fontSize: {
        "2xs": "9px",
      },
    },
  },
  plugins: [],
};

export default config;
