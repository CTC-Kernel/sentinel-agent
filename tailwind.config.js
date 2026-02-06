/** @type {import('tailwindcss').Config} */
export default {
  content: {
    files: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    // Safelist: Classes dynamiques qui ne doivent JAMAIS etre purgees
    transform: {
      tsx: (content) => {
        // Detecter les classes dynamiques dans les template literals
        const matches = content.match(/`[^`]*\$\{[^}]*\}[^`]*`/g) || [];
        return content + ' ' + matches.join(' ');
      },
    },
  },
  // Mode JIT pour generer uniquement les classes utilisees
  mode: 'jit',
  darkMode: 'class',
  // Safelist explicite pour les classes dynamiques critiques
  safelist: [
    // Couleurs de statut generees dynamiquement
    { pattern: /bg-(red|green|blue|amber|yellow|orange|purple|pink|indigo|teal|cyan|emerald|rose|slate|gray|zinc)-(50|100|200|300|400|500|600|700|800|900)/ },
    { pattern: /text-(red|green|blue|amber|yellow|orange|purple|pink|indigo|teal|cyan|emerald|rose|slate|gray|zinc)-(50|100|200|300|400|500|600|700|800|900)/ },
    { pattern: /border-(red|green|blue|amber|yellow|orange|purple|pink|indigo|teal|cyan|emerald|rose|slate|gray|zinc)-(50|100|200|300|400|500|600|700|800|900)/ },
    // Classes de grille dynamiques
    { pattern: /grid-cols-(1|2|3|4|5|6|7|8|9|10|11|12)/ },
    { pattern: /col-span-(1|2|3|4|5|6|7|8|9|10|11|12)/ },
    // Classes de gap dynamiques
    { pattern: /gap-(0|1|2|3|4|5|6|8|10|12)/ },
    // Z-index dynamiques (inclut toute la hiérarchie définie)
    { pattern: /z-(0|10|20|30|40|50|150|200|700|800|900|950|1000|9999)/ },
    // Z-index nommés (design system)
    { pattern: /z-(auto|base|decorator|sticky|fixed-nav|header|sidebar|dropdown|popover|modal|tooltip|voxel-ui|voxel-panel|toast|supreme|max)/ },
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      /* ====================================================================
         Z-INDEX HIERARCHY - Unified Design System
         AUDIT FIX: Logical ordering from base to supreme
         ==================================================================== */
      zIndex: {
        'auto': 'auto',
        'base': '0',

        /* Layout Layers (10-30) */
        'decorator': '10',      // Decorative elements, badges, markers
        'sticky': '20',         // Sticky headers, floating elements
        'fixed-nav': '30',      // Fixed navigation bars

        /* Content Layers (40-60) */
        'header': '40',         // App header
        'sidebar': '50',        // Sidebar navigation

        /* Overlay Layers (700-1000) - ELEVATED for proper stacking */
        'dropdown': '700',      // Dropdown menus (above all content)
        'popover': '800',       // Popovers, tooltips triggers
        'modal': '900',         // Modal dialogs
        'tooltip': '1000',      // Tooltips (always on top of modals)

        /* UI System Layers (150-200) */
        'voxel-ui': '150',      // Voxel UI Interface layer
        'voxel-panel': '200',   // Voxel Side Panels

        /* Top Layers (900-9999) */
        'toast': '950',         // Toast notifications
        'supreme': '9999',      // The absolute top (cursor, drag, critical)
        'max': '9999',          // Alias for supreme
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Outfit', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        apple: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Inter', 'system-ui', 'sans-serif'],
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
          300: '#cbd5e1', // Slate-300 improved for boundaries
          400: '#94a3b8', // Slate-400 improved for icons/secondary text
          500: '#64748b', // Slate-500 (AA compliant on white background)
          600: '#475569', // Slate-600
          700: '#334155', // Slate-700
          800: '#27272a',
          850: '#202023',
          900: '#18181b',
          950: '#09090b',
        },
        /* ====================================================================
           AUDIT FIX: Removed duplicate color palettes (blue, red, green, amber)
           Use semantic tokens instead: primary, success, warning, error, info
           Legacy code should migrate to semantic colors from design-tokens.css
           ==================================================================== */
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
        /* AUDIT FIX: float and shimmer keyframes are defined in animations.css */
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
        /* AUDIT FIX: shimmer-rotate keyframe is defined in animations.css */
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}
