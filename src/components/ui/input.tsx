import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    'aria-invalid'?: boolean
    'aria-describedby'?: string
    error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, error, 'aria-invalid': ariaInvalid, ...props }, ref) => {
        const hasError = error || ariaInvalid

        return (
            <input
                type={type}
                className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                    "placeholder:text-muted-foreground",
                    // Focus states
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    // Hover states for better feedback
                    "hover:border-primary/30 hover:bg-background/80 transition-colors duration-200",
                    // Disabled state - WCAG AAA: using colors instead of opacity for proper contrast
                    "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:border-border/40",
                    "dark:disabled:bg-slate-800 dark:disabled:text-slate-400 dark:disabled:border-slate-700",
                    // Dark mode explicit styles - improved placeholder contrast
                    "dark:bg-slate-800/50 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-500",
                    "dark:hover:border-primary/40 dark:hover:bg-slate-800/70",
                    // Error state styling
                    hasError && "border-error-500 dark:border-error-500 focus-visible:ring-error-500 hover:border-error-500",
                    className
                )}
                ref={ref}
                aria-invalid={hasError}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
