import * as React from "react"
import { Check } from './Icons' // Assuming lucide-react is available, or use a simple svg
import { cn } from "@/lib/utils"

// Simple implementation without radix primitive for speed/simplicity if primitive not available, 
// but user usually has radix. I'll stick to a controlled native-like input or a simple div-based one.
// Let's use a simple controlled component approach.

const Checkbox = React.forwardRef<
    HTMLInputElement,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
        onCheckedChange?: (checked: boolean) => void
    }
>(({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
        <div className="relative inline-flex items-center">
            <input
                type="checkbox"
                className={cn(
                    "peer h-4 w-4 shrink-0 rounded border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground appearance-none bg-background checked:bg-primary checked:text-primary-foreground",
                    className
                )}
                ref={ref}
                checked={checked}
                onChange={(e) => onCheckedChange?.(e.target.checked)}
                {...props}
            />
            <Check className="absolute top-0 left-0 h-4 w-4 hidden peer-checked:block text-primary-foreground pointer-events-none" />
        </div>
    )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }
