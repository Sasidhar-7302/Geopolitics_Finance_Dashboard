/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/layouts/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#E4E4E7",
        "ink-muted": "#71717A",
        slate: "#71717A",
        shell: "#000000",
        "shell-light": "#0A0A0A",
        fog: "#27272A",
        surface: "#0A0A0A",
        accent: "#10B981",
        accent2: "#F97316",
        accent3: "#FBBF24",
        night: "#000000",
        ocean: "#3B82F6",
        danger: "#EF4444",
        rose: "#F43F5E",
        emerald: "#10B981",
        cyan: "#06B6D4",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        body: ["'Manrope'", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 3px rgba(0, 0, 0, 0.5)",
        card: "0 2px 8px rgba(0, 0, 0, 0.6)",
        glow: "0 0 20px rgba(16, 185, 129, 0.15)",
        "glow-red": "0 0 20px rgba(239, 68, 68, 0.1)",
        "glow-blue": "0 0 20px rgba(59, 130, 246, 0.1)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.95" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        float: "float 10s ease-in-out infinite",
        "fade-up": "fade-up 0.6s ease-out forwards",
        "pulse-soft": "pulse-soft 6s ease-in-out infinite",
        ticker: "ticker 30s linear infinite",
      },
    },
  },
  plugins: [],
};
