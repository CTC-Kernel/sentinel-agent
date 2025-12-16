import { cva } from "class-variance-authority"

export const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/20 hover:shadow-destructive/30 hover:-translate-y-0.5",
                outline:
                    "border border-input bg-background/50 hover:bg-accent hover:text-accent-foreground backdrop-blur-sm",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
                glass: "glass-panel hover:bg-white/40 dark:hover:bg-white/10 text-foreground shadow-sm backdrop-blur-md border border-white/50 dark:border-white/10 hover:-translate-y-0.5",
                premium: "relative overflow-hidden bg-gradient-to-r from-brand-600 to-blue-600 text-white shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 hover:scale-[1.02] active:scale-[0.98] border border-brand-500/20 after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent after:translate-x-[-200%] hover:after:translate-x-[200%] after:transition-transform after:duration-[1.5s] after:ease-in-out",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-md px-3",
                lg: "h-11 rounded-md px-8",
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
