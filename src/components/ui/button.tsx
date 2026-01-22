import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { type VariantProps } from "class-variance-authority"
import { buttonVariants } from "./button-variants"
import { Spinner } from "./Spinner"

import { cn } from "@/lib/utils"

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean
        isLoading?: boolean
        loadingText?: string
        'aria-label'?: string
    }

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({
        className,
        variant,
        size,
        asChild = false,
        isLoading = false,
        loadingText,
        children,
        disabled,
        'aria-label': ariaLabel,
        ...props
    }, ref) => {
        const Comp = asChild ? Slot : "button"
        const isDisabled = disabled || isLoading

        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={isDisabled}
                aria-disabled={isDisabled}
                aria-busy={isLoading}
                aria-label={ariaLabel}
                {...props}
            >
                {isLoading && <Spinner className="mr-2 h-4 w-4" size="sm" />}
                {isLoading && loadingText ? loadingText : children}
            </Comp>
        )
    }
)
Button.displayName = "Button"

export { Button }
