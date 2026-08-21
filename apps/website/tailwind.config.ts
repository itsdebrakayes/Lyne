import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        /* QME Now brand palette (from the design specification) */
        qme: {
          /* One blue across the product — these mirror the admin QX tokens and
             the mobile theme, so the site, the phone and the staff desktop are
             the same colour. The token NAMES are kept (purple/lavender) purely
             so 100+ call sites do not all have to change in one commit; the
             VALUES are the blue family. Rename them when the site is next
             touched properly. Was #7b5fff / #533483 / #c4b5fd. */
          purple: "#5a93e8",        /* accent on a dark ground = admin dark --c-primary */
          "purple-deep": "#2e6fc7", /* lifted, for hover and glow  = --c-primary-bright */
          violet: "#1b4b8f",        /* deep fill                   = admin light --c-primary */
          lavender: "#b9c8dc",      /* muted body text on dark — blue-grey, not violet */
          "lavender-dim": "#8fa3bd",
          navy: "#0c1826",          /* matches the mobile app ground exactly */
          surface: "#16213e",
          mid: "#0f3460",
          yellow: "#f5a623",
          green: "#22c55e",
          lime: "#c8f135",
          red: "#ef4444",
          ink: "#1c1c1e",
          paper: "#f8f8f8",
          soft: "#f0f0f0",
          night: "#08111c",   /* blue-black, was violet-black #0d0d1a */
          black: "#0d0d0d",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
