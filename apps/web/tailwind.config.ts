import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core ocean intelligence theme colors
        deep: "#0B1121",           // Very dark navy background
        ocean: "#142546",          // Slightly lighter navy for cards
        abyss: "#050914",          // Pure darkness for deep layers
        surface: "#1D325E",        // Highlighted card backgrounds
        
        // Brand accents
        argo: {
          cyan: "#00F0FF",         // Neon cyan for data points, highlights
          blue: "#3A86FF",         // Primary blue for UI elements
          gold: "#FFBE0B",         // Warning/highlight color (like a buoy)
          orange: "#FB5607",       // Vibrant secondary highlight
        },

        // Typography
        text: {
          main: "#E2E8F0",
          muted: "#94A3B8",
          dark: "#0F172A",
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'conic-gradient(from 180deg at 50% 50%, #142546 0deg, #0B1121 180deg, #1D325E 360deg)',
      },
      fontFamily: {
        sans: ['var(--font-inter)'],
        mono: ['var(--font-jetbrains-mono)'],
        display: ['var(--font-outfit)'],
      },
      animation: {
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
        'pulse-glow': 'pulseGlow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '.8', filter: 'brightness(1.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
};
export default config;
