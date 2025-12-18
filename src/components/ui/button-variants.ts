import { cva } from "class-variance-authority"

export const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-bold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    {
        variants: {
            variant: {
                default: "bg-gradient-to-r from-brand-600 to-blue-600 text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:-translate-y-0.5 active:translate-y-0 border border-brand-500/20 active:scale-[0.98]",
                destructive:
                    "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:-translate-y-0.5 active:translate-y-0 border border-red-500/20",
                outline:
                    "border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white backdrop-blur-sm hover:-translate-y-0.5 active:translate-y-0 shadow-sm",
                secondary:
                    "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 shadow-sm hover:-translate-y-0.5 active:translate-y-0",
                ghost: "hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white active:bg-slate-200 dark:active:bg-slate-700",
                link: "text-brand-600 dark:text-brand-400 underline-offset-4 hover:underline",
                glass: "glass-panel hover:bg-white/60 dark:hover:bg-white/10 text-slate-900 dark:text-white shadow-sm backdrop-blur-md border border-white/50 dark:border-white/10 hover:-translate-y-0.5 active:translate-y-0",
                premium: "relative overflow-hidden bg-gradient-to-r from-brand-600 to-blue-600 text-white shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 hover:scale-[1.02] active:scale-[0.98] border border-brand-500/20 after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent after:translate-x-[-200%] hover:after:translate-x-[200%] after:transition-transform after:duration-[1500ms] after:ease-in-out",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-xl px-3",
                lg: "h-11 rounded-2xl px-8",
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
