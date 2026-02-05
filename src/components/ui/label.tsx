import * as React from "react"
import { type VariantProps, cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const labelVariants = cva(
 "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:bg-muted disabled:text-muted-foreground"
)

const Label = React.forwardRef<
 HTMLLabelElement,
 React.LabelHTMLAttributes<HTMLLabelElement> &
 VariantProps<typeof labelVariants>
>(({ className, htmlFor, ...props }, ref) => (
 <label
 ref={ref}
 className={cn(labelVariants(), className)}
 htmlFor={htmlFor}
 {...props}
 />
))
Label.displayName = "Label"

export { Label }
