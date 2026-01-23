/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/App.tsx",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/views/**/*.{js,ts,jsx,tsx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx}",
    "./src/utils/**/*.{js,ts,jsx,tsx}",
    "./src/services/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      zIndex: {
        'decorator': '10',
        'sticky': '20',
        'header': '40',
        'tooltip': '45',    // AUDIT FIX: tooltip doit être < modal pour éviter superposition
        'modal': '50',
        'dropdown': '55',   // AUDIT FIX: ajout niveau pour dropdowns
        'popover': '60',    // AUDIT FIX: popovers au-dessus des modals si nécessaire
        'max': '9999',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          50: "hsl(var(--primary) / 0.05)",
          100: "hsl(var(--primary) / 0.1)",
          200: "hsl(var(--primary) / 0.2)",
          300: "hsl(var(--primary) / 0.3)",
          400: "hsl(var(--primary) / 0.4)",
          500: "hsl(var(--primary) / 0.5)",
          600: "hsl(var(--primary) / 0.6)",
          700: "hsl(var(--primary) / 0.7)",
          800: "hsl(var(--primary) / 0.8)",
          900: "hsl(var(--primary) / 0.9)",
          950: "hsl(var(--primary) / 0.95)",
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "white",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "white",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          foreground: "white",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "white",
        },
        brand: {
          50: "hsl(var(--primary) / 0.05)",
          100: "hsl(var(--primary) / 0.1)",
          200: "hsl(var(--primary) / 0.2)",
          300: "hsl(var(--primary) / 0.3)",
          400: "hsl(var(--primary) / 0.4)",
          500: "hsl(var(--primary))",
          600: "hsl(var(--primary) / 0.9)",
          700: "hsl(var(--primary) / 0.8)",
          800: "hsl(var(--primary) / 0.7)",
          900: "hsl(var(--primary) / 0.6)",
          950: "hsl(var(--primary) / 0.5)",
          DEFAULT: "hsl(var(--primary))",
        },
        slate: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          850: '#202023',
          900: '#18181b',
          950: '#09090b',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        'xs': '0.375rem',
        'base': '0.75rem',
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      letterSpacing: {
        'tightest': '-0.06em',
        'tighter': '-0.04em',
        'tight': '-0.02em',
        'snug': '-0.01em',
        'normal': '0em',
        'wide': '0.01em',
        'wider': '0.02em',
        'widest': '0.05em',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.04)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        'apple': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'apple-md': '0 8px 30px rgba(0,0,0,0.08)',
        'apple-xl': '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s var(--ease-apple)',
        'slide-up': 'slideUp 0.4s var(--ease-apple)',
        'scale-in': 'scaleIn 0.3s var(--ease-apple)',
      },
      transitionTimingFunction: {
        'custom-ease': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      keyframes: {
        spotlight: {
          "0%": {
            opacity: 0,
            transform: "translate(-72%, -62%) scale(0.5)",
          },
          "100%": {
            opacity: 1,
            transform: "translate(-50%,-40%) scale(1)",
          },
        },
        aurora: {
          from: {
            backgroundPosition: "50% 50%, 50% 50%",
          },
          to: {
            backgroundPosition: "350% 50%, 350% 50%",
          },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-15px)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        badgeIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "blur-in": {
          "0%": { opacity: "0", filter: "blur(8px)" },
          "100%": { opacity: "1", filter: "blur(0)" },
        },
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(50px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        "pulse-gentle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}
