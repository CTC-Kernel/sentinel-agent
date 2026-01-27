import { useEffect, useState } from "react";
import { Moon, Sun } from './Icons';
import { Button } from "./button";

export function ThemeToggle() {
    const [theme, setTheme] = useState<"light" | "dark" | "system">("theme" in localStorage ? (localStorage.theme as "light" | "dark" | "system") : "system");

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light";
            root.classList.add(systemTheme);
            return;
        }

        root.classList.add(theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => (prev === "dark" ? "light" : "dark"));
    };

    return (
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-slate-500 dark:text-slate-300 dark:text-white transition-colors relative overflow-hidden">
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 absolute" />
            <Moon className="h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 absolute" />
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
