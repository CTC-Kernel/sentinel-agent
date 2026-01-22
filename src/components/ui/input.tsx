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
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    // Dark mode explicit styles
                    "dark:bg-slate-800/50 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-400",
                    // Error state styling
                    hasError && "border-red-500 dark:border-red-500 focus-visible:ring-red-500",
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
