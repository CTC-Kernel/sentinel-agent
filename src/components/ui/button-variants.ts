import { cva } from "class-variance-authority"

/**
 * Button Variants - Unified interaction states
 * Uses design tokens for consistent timing and shadows
 * All variants use: hover:-translate-y-0.5, active:scale-[0.98] active:translate-y-0
 */
export const buttonVariants = cva(
    // Base styles with unified focus ring
    // WCAG AAA: disabled state uses explicit colors instead of opacity for proper contrast
    "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-bold ring-offset-background transition-all duration-normal active:duration-75 ease-apple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:disabled:border-slate-600",
    {
        variants: {
            variant: {
                // Primary - Bold with colored shadow
                default: "bg-primary text-primary-foreground shadow-sm shadow-primary hover:shadow-md hover:shadow-primary hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",

                // Destructive - Same pattern, different color
                destructive: "bg-destructive text-destructive-foreground shadow-sm shadow-error hover:shadow-md hover:shadow-error hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",

                // Outline - Subtle with backdrop blur
                outline: "border border-input bg-background/50 backdrop-blur-sm shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",

                // Secondary - Muted but interactive
                secondary: "bg-secondary text-secondary-foreground border border-secondary/50 backdrop-blur-sm shadow-sm hover:bg-secondary/80 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",

                // Ghost - Minimal, no shadow
                ghost: "hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",

                // Link - Text only with underline
                link: "text-primary underline-offset-4 hover:underline active:opacity-80",

                // Glass - Frosted glass effect
                glass: "bg-[var(--glass-bg,rgba(255,255,255,0.85))] border border-[var(--glass-border,rgba(28,32,48,0.12))] text-foreground shadow-glass backdrop-blur-md hover:bg-white/90 dark:hover:bg-slate-800/90 hover:border-primary/20 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",

                // Premium - Gradient with shine effect
                premium: "relative overflow-hidden bg-gradient-primary text-primary-foreground shadow-md shadow-primary hover:shadow-xl hover:shadow-primary hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent after:translate-x-[-200%] hover:after:translate-x-[200%] after:transition-transform after:duration-slower after:ease-out",
            },
            size: {
                default: "h-11 px-6 py-2.5",
                sm: "h-9 rounded-xl px-4 text-xs",
                lg: "h-12 rounded-3xl px-8",
                icon: "h-11 w-11",
                xl: "h-14 px-10 text-base rounded-3xl",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)
