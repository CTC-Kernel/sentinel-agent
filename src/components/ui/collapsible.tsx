import * as React from "react"
import { cn } from "@/lib/utils"

const Collapsible = React.forwardRef<
 HTMLDivElement,
 React.HTMLAttributes<HTMLDivElement> & { open?: boolean; onOpenChange?: (open: boolean) => void }
>(({ className, open, onOpenChange, children, ...props }, ref) => {
 const [isOpen, setIsOpen] = React.useState(open || false)

 React.useEffect(() => {
 if (open !== undefined) setIsOpen(open)
 }, [open])

 return (
 <div
 ref={ref}
 data-state={isOpen ? "open" : "closed"}
 className={cn(className)}
 {...props}
 >
 {React.Children.map(children, child => {
 if (React.isValidElement(child)) {
  // @ts-expect-error - Cloning element to pass down open state
  return React.cloneElement(child, { isOpen, setIsOpen, onOpenChange })
 }
 return child
 })}
 </div>
 )
})
Collapsible.displayName = "Collapsible"

const CollapsibleTrigger = React.forwardRef<
 HTMLButtonElement,
 React.ButtonHTMLAttributes<HTMLButtonElement> & { isOpen?: boolean; setIsOpen?: (open: boolean) => void; onOpenChange?: (open: boolean) => void }
>(({ className, isOpen, setIsOpen, onOpenChange, onClick, ...props }, ref) => (
 <button
 ref={ref}
 type="button"
 onClick={(e) => {
 const newState = !isOpen
 setIsOpen?.(newState)
 onOpenChange?.(newState)
 onClick?.(e)
 }}
 className={cn("flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50", className)}
 {...props}
 />
))
CollapsibleTrigger.displayName = "CollapsibleTrigger"

const CollapsibleContent = React.forwardRef<
 HTMLDivElement,
 React.HTMLAttributes<HTMLDivElement> & { isOpen?: boolean }
>(({ className, isOpen, ...props }, ref) => (
 <div
 ref={ref}
 hidden={!isOpen}
 className={cn("overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down", className)}
 {...props}
 />
))
CollapsibleContent.displayName = "CollapsibleContent"

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
