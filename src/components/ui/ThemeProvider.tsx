import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { ThemeContext, Theme, ColorScheme, colorSchemes } from '../../contexts/ThemeContext';
import { useTheme } from '../../hooks/useTheme';

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
