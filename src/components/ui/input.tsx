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
                    "flex h-11 w-full rounded-xl border border-border/40 bg-background/50 px-4 py-2 text-sm backdrop-blur-sm transition-all duration-normal ease-apple ring-offset-background",
                    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                    "placeholder:text-muted-foreground",
                    // Focus states
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    // Hover states for better feedback
                    "hover:border-primary/30 hover:bg-background/80 hover:shadow-sm",
                    // Disabled state
                    "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40",
                    // Dark mode explicit styles
                    "dark:bg-card/50 dark:border-border dark:text-foreground dark:placeholder:text-muted-foreground/60",
                    "dark:hover:border-primary/40 dark:hover:bg-card/70",
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
