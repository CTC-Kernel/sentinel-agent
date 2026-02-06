import { cva } from "class-variance-authority"

/**
 * Button Variants - Unified interaction states
 * Uses design tokens for consistent timing and shadows
 * All variants use: hover:-translate-y-0.5, active:scale-[0.98] active:translate-y-0
 */
export const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold ring-offset-background transition-all duration-normal active:duration-75 ease-apple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:shadow-none",
    {
        variants: {
            variant: {
                // Primary - Bold with colored shadow and glow
                default: "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:shadow-lg hover:shadow-primary/40 hover:scale-[1.02] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] dark:shadow-primary/30 dark:hover:shadow-primary/50",
                destructive: "bg-destructive text-destructive-foreground shadow-sm shadow-error/20 hover:shadow-lg hover:shadow-error/40 hover:scale-[1.02] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] dark:shadow-error/30 dark:hover:shadow-error/50",

                // Outline - Subtle with backdrop blur
                outline: "border border-input bg-background/50 backdrop-blur-sm shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-accent hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",

                // Secondary - Muted but interactive
                secondary: "bg-secondary text-secondary-foreground border border-secondary/50 backdrop-blur-sm shadow-sm hover:bg-secondary/80 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",

                // Ghost - Minimal, no shadow
                ghost: "hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",

                // Link - Text only with underline
                link: "text-primary underline-offset-4 hover:underline active:opacity-80",

                // Glass - Frosted glass effect
                glass: "bg-[var(--glass-bg)] border border-[var(--glass-border)] text-foreground shadow-glass backdrop-blur-md hover:bg-[var(--glass-medium-bg)] hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] before:absolute before:inset-0 before:bg-[var(--glass-highlight)] before:pointer-events-none transition-all duration-300",

                // Premium - Gradient with shine and pulse-glow effect
                premium: "relative overflow-hidden bg-gradient-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/50 hover:scale-[1.02] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/25 after:to-transparent after:translate-x-[-200%] hover:after:translate-x-[200%] after:transition-transform after:duration-slower after:ease-out dark:shadow-primary/40 dark:hover:shadow-primary/60",
            },
            size: {
                default: "h-11 px-6 py-2.5",
                sm: "h-9 rounded-xl px-4 text-xs",
                lg: "h-12 rounded-xl px-8",
                icon: "h-11 w-11",
                xl: "h-14 px-10 text-base rounded-xl",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)
