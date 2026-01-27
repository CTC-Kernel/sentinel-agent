import * as React from "react"
import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { 'aria-label'?: string }
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        role="img"
        className={cn(
            "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10 shadow-sm",
            className
        )}
        {...props}
    />
))
Avatar.displayName = "Avatar"

/**
 * AvatarImage - WCAG AAA compliant
 * @param alt - Required for accessibility. Use empty string "" for decorative images.
 */
interface AvatarImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'alt'> {
    /** Required alt text for screen readers. Use "" for decorative images. */
    alt: string;
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
    ({ className, alt, ...props }, ref) => (
        <img
            ref={ref}
            alt={alt}
            className={cn("aspect-square h-full w-full object-cover", className)}
            {...props}
        />
    )
)
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "flex h-full w-full items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium",
            className
        )}
        {...props}
    />
))
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
