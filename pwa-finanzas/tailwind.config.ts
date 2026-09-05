import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#e7edf7",
        navy: "#162b43",
        ocean: "#62dbea",
        teal: "#b9f17c",
        mint: "#b9f17c",
        cream: "#f5cb79",
        midnight: "#080d17",
        surface: "#111b2c",
      },
      boxShadow: {
        glow: "0 16px 56px rgb(0 0 0 / 30%), 0 0 32px rgb(98 219 234 / 6%)",
        card: "0 10px 32px rgb(0 0 0 / 16%)",
      },
      animation: {
        "fade-up": "fadeUp 220ms ease both",
        "soft-pulse": "softPulse 2.8s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        softPulse: {
          "0%, 100%": { transform: "scale(.96)", opacity: ".72" },
          "50%": { transform: "scale(1.04)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
