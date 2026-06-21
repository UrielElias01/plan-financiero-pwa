import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#102033",
        navy: "#1f4e78",
        ocean: "#2e75b6",
        teal: "#0f7f83",
        mint: "#d9ead3",
        cream: "#fff2cc",
      },
      boxShadow: {
        glow: "0 24px 80px rgb(31 78 120 / 18%)",
        card: "0 18px 55px rgb(31 78 120 / 12%)",
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
