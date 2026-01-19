import { cva } from "class-variance-authority"

export const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.23)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/25 hover:shadow-destructive/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300",
                outline:
                    "border border-input bg-background/50 hover:bg-accent hover:text-accent-foreground backdrop-blur-sm hover:-translate-y-0.5 active:translate-y-0 shadow-sm transition-all duration-300",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm border border-secondary/50 transition-all duration-300",
                ghost: "hover:bg-accent hover:text-accent-foreground active:scale-[0.98] transition-all duration-300",
                link: "text-primary underline-offset-4 hover:underline transition-all duration-300",
                glass: "bg-[var(--glass-bg)] border-[var(--glass-border)] text-foreground shadow-[var(--glass-shadow)] hover:bg-[var(--glass-bg)]/80 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 backdrop-blur-md",
                premium: "relative overflow-hidden bg-gradient-to-r from-primary to-blue-600 text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.98] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent after:translate-x-[-200%] hover:after:translate-x-[200%] after:transition-transform after:duration-1000 after:ease-in-out transition-all duration-300",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-lg px-3",
                lg: "h-11 rounded-2xl px-6",
                icon: "h-10 w-10",
                xl: "h-12 px-8 text-base",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)
