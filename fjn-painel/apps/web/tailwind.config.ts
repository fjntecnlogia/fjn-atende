import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Barlow", "system-ui", "sans-serif"],
        display: ["Barlow Condensed", "Barlow", "sans-serif"],
      },
      colors: {
        navy:   "#0B1340",
        navy2:  "#060C28",
        navy3:  "#0F1A52",
        navy4:  "#162466",
        orange: "#FFBA00",
        orange2:"#E0A000",
        gray2:  "#8A93B2",
        light:  "#F4F6FF",
        border: "#1A2358",
      },
      boxShadow: {
        glow: "0 0 24px rgba(255,186,0,.18)",
      },
    },
  },
  plugins: [],
};

export default config;
