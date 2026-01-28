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
        'sidebar': '45',    // AUDIT FIX: Sidebar between header and modal
        'modal': '50',
        'dropdown': '55',   // AUDIT FIX: Dropdowns above modals
        'popover': '60',    // AUDIT FIX: Popovers above dropdowns
        'tooltip': '70',    // AUDIT FIX: Tooltips always on top
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
          text: "hsl(var(--success-text))",
          bg: "hsl(var(--success-bg))",
          border: "hsl(var(--success-border))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "white",
          text: "hsl(var(--warning-text))",
          bg: "hsl(var(--warning-bg))",
          border: "hsl(var(--warning-border))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          foreground: "white",
          text: "hsl(var(--error-text))",
          bg: "hsl(var(--error-bg))",
          border: "hsl(var(--error-border))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "white",
          text: "hsl(var(--info-text))",
          bg: "hsl(var(--info-bg))",
          border: "hsl(var(--info-border))",
        },
        brand: {
          // Proper blue palette (hue 221) with real color values for WCAG AAA contrast
          50: '#eff6ff',   // Light background - visible
          100: '#dbeafe',  // Lighter accent - visible
          200: '#bfdbfe',  // Light accent
          300: '#93c5fd',  // Medium light
          400: '#60a5fa',  // Medium
          500: '#3b82f6',  // Primary blue (matches --primary hue 221)
          600: '#2563eb',  // Darker - good for text
          700: '#1d4ed8',  // Dark - excellent contrast
          800: '#1e40af',  // Very dark
          900: '#1e3a8a',  // Darkest
          950: '#172554',  // Near black
          DEFAULT: '#3b82f6',
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
        // Standardizing aggressive colors by shadowing default Tailwind palettes
        blue: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#38a9f8',
          500: '#5a8ed5', // Refined desaturated blue
          600: '#4a7ec5',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        red: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#cc6e6e', // Refined desaturated red
          600: '#bc5e5e',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#5e9b7e', // Refined desaturated green
          600: '#4e8b6e',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#c59a6e', // Refined desaturated amber
          600: '#b58a5e',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Navigation section colors (harmonized with design tokens)
        nav: {
          pilotage: "hsl(var(--nav-pilotage))",
          operations: "hsl(var(--nav-operations))",
          governance: "hsl(var(--nav-governance))",
          repository: "hsl(var(--nav-repository))",
          admin: "hsl(var(--nav-admin))",
          support: "hsl(var(--nav-support))",
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
        // Elevation system (use CSS variables for theme-aware shadows)
        'elevation-xs': 'var(--shadow-xs)',
        'elevation-sm': 'var(--shadow-sm)',
        'elevation-md': 'var(--shadow-md)',
        'elevation-lg': 'var(--shadow-lg)',
        'elevation-xl': 'var(--shadow-xl)',
        'elevation-2xl': 'var(--shadow-2xl)',
        // Colored shadows
        'primary': 'var(--shadow-primary)',
        'success': 'var(--shadow-success)',
        'warning': 'var(--shadow-warning)',
        'error': 'var(--shadow-error)',
        // Legacy support
        'glass': 'var(--glass-shadow)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        'apple': 'var(--shadow-sm)',
        'apple-md': 'var(--shadow-md)',
        'apple-xl': 'var(--shadow-xl)',
        // Glow effects
        'glow': '0 0 20px hsl(var(--primary) / 0.25)',
        'glow-success': '0 0 20px hsl(var(--success) / 0.25)',
        'glow-warning': '0 0 20px hsl(var(--warning) / 0.25)',
        'glow-danger': '0 0 20px hsl(var(--error) / 0.25)',
        // Interactive states
        'button': 'var(--shadow-button)',
        'button-hover': 'var(--shadow-button-hover)',
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        'modal': 'var(--shadow-modal)',
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-success': 'var(--gradient-success)',
        'gradient-warning': 'var(--gradient-warning)',
        'gradient-danger': 'var(--gradient-danger)',
        'gradient-info': 'var(--gradient-info)',
        'aurora': "repeating-linear-gradient(100deg,var(--blue-500) 10%,var(--indigo-300) 15%,var(--blue-300) 20%,var(--violet-200) 25%,var(--blue-400) 30%)",
      },
      animation: {
        'fade-in': 'fadeIn 0.5s var(--ease-apple)',
        'slide-up': 'slideUp 0.4s var(--ease-apple)',
        'scale-in': 'scaleIn 0.3s var(--ease-apple)',
      },
      transitionTimingFunction: {
        'apple': 'var(--ease-apple)',
        'out': 'var(--ease-out)',
        'in': 'var(--ease-in)',
        'in-out': 'var(--ease-in-out)',
        'spring': 'var(--ease-spring)',
        'custom-ease': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        'instant': 'var(--duration-instant)',
        'fast': 'var(--duration-fast)',
        'normal': 'var(--duration-normal)',
        'slow': 'var(--duration-slow)',
        'slower': 'var(--duration-slower)',
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
        "shimmer-rotate": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}
