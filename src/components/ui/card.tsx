import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const cardVariants = cva(
    "rounded-2xl bg-card text-card-foreground transition-all duration-300",
    {
        variants: {
            variant: {
                default: "border shadow-sm",
                elevated: "border shadow-apple-md",
                glass: "bg-[var(--glass-bg,rgba(255,255,255,0.85))] backdrop-blur-xl border-[var(--glass-border,rgba(28,32,48,0.12))] shadow-[var(--glass-shadow)]",
                premium: "bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border shadow-apple-md ring-1 ring-black/5 dark:ring-white/10",
            },
            hover: {
                none: "",
                lift: "hover:-translate-y-1 hover:shadow-apple-xl cursor-pointer",
                glow: "hover:shadow-glow hover:border-primary/30 cursor-pointer",
            },
        },
        defaultVariants: {
            variant: "default",
            hover: "none",
        },
    }
)

export interface CardProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant, hover, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(cardVariants({ variant, hover }), className)}
            {...props}
        />
    )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5 p-6", className)}
        {...props}
    />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn(
            // AUDIT FIX: Ajout font-display pour conformité Apple design
            "text-2xl font-semibold font-display leading-none tracking-tight",
            className
        )}
        {...props}
    />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center p-6 pt-0", className)}
        {...props}
    />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
