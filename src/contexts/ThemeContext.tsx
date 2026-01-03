import { createContext } from 'react';

export type Theme = 'light' | 'dark' | 'system' | 'custom';
export type ColorScheme = 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'custom';

export interface CustomColors {
    primary: string;
    secondary: string;
    accent: string;
}

export interface ThemeContextType {
    theme: Theme;
    colorScheme: ColorScheme;
    setTheme: (theme: Theme) => void;
    setColorScheme: (scheme: ColorScheme) => void;
    customColors?: CustomColors;
    setCustomColors: (colors: CustomColors) => void;
}

export const colorSchemes = {
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

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
