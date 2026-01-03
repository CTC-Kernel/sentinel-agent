import React, { createContext, useContext, useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

type Theme = 'light' | 'dark' | 'system' | 'custom';
type ColorScheme = 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'custom';

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
  setTheme: (theme: Theme) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  customColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  setCustomColors: (colors: any) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const colorSchemes = {
  default: {
    primary: '59 130 246',
    secondary: '107 114 128',
    accent: '99 102 241'
  },
  blue: {
    primary: '37 99 235',
    secondary: '59 130 246',
    accent: '96 165 250'
  },
  green: {
    primary: '34 197 94',
    secondary: '74 222 128',
    accent: '134 239 172'
  },
  purple: {
    primary: '109 40 217',
    secondary: '139 92 246',
    accent: '167 139 250'
  },
  orange: {
    primary: '249 115 22',
    secondary: '251 146 60',
    accent: '254 215 170'
  },
  red: {
    primary: '239 68 68',
    secondary: '248 113 113',
    accent: '254 202 202'
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('system');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('default');
  const [customColors, setCustomColors] = useState(colorSchemes.default);

  useEffect(() => {
    const root = document.documentElement;
    
    // Apply theme
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.toggle('dark', systemTheme === 'dark');
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }

    // Apply color scheme
    const colors = colorScheme === 'custom' && customColors ? customColors : colorSchemes[colorScheme as keyof typeof colorSchemes];
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-accent', colors.accent);
  }, [theme, colorScheme, customColors]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colorScheme,
        setTheme,
        setColorScheme,
        customColors,
        setCustomColors
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme, colorScheme, setColorScheme } = useTheme();

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Thème
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['light', 'dark', 'system'] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                "px-3 py-2 rounded-lg border transition-colors",
                theme === t
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              )}
            >
              {t === 'light' && '☀️ Clair'}
              {t === 'dark' && '🌙 Sombre'}
              {t === 'system' && '💻 Système'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Palette de couleurs
        </label>
        <div className="grid grid-cols-3 gap-2">
          {Object.keys(colorSchemes).map((scheme) => (
            <button
              key={scheme}
              onClick={() => setColorScheme(scheme as ColorScheme)}
              className={cn(
                "px-3 py-2 rounded-lg border transition-colors capitalize",
                colorScheme === scheme
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              )}
            >
              {scheme === 'default' && '🔵 Bleu'}
              {scheme === 'blue' && '💙 Bleu foncé'}
              {scheme === 'green' && '🟢 Vert'}
              {scheme === 'purple' && '🟣 Violet'}
              {scheme === 'orange' && '🟠 Orange'}
              {scheme === 'red' && '🔴 Rouge'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
