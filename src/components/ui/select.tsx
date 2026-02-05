import * as React from "react"
import { ChevronDown } from './Icons'
import { cn } from "@/lib/utils"

// Simplified Context-based Select to mock the Radix API structure
const SelectContext = React.createContext<{
 value?: string
 onValueChange?: (value: string) => void
 open?: boolean
 setOpen?: (open: boolean) => void
 listboxId?: string
} | null>(null)

interface SelectProps {
 children?: React.ReactNode
 value?: string
 onValueChange?: (value: string) => void
 defaultValue?: string
 open?: boolean
 onOpenChange?: (open: boolean) => void
}

const Select: React.FC<SelectProps> = ({ children, value, onValueChange, defaultValue, open, onOpenChange }) => {
 const [internalValue, setInternalValue] = React.useState(defaultValue || "")
 const [internalOpen, setInternalOpen] = React.useState(false)

 const isControlled = value !== undefined
 const currentValue = isControlled ? value : internalValue
 const currentOpen = open !== undefined ? open : internalOpen

 const handleValueChange = (v: string) => {
 if (!isControlled) setInternalValue(v)
 onValueChange?.(v)
 }

 const handleOpenChange = (o: boolean) => {
 if (onOpenChange === undefined) setInternalOpen(o)
 onOpenChange?.(o)
 }

 const listboxId = React.useId()

 return (
 <SelectContext.Provider value={{ value: currentValue, onValueChange: handleValueChange, open: currentOpen, setOpen: handleOpenChange, listboxId }}>
 <div className="relative inline-block w-full text-left">
 {children}
 </div>
 </SelectContext.Provider>
 )
}

const SelectTrigger = React.forwardRef<
 HTMLButtonElement,
 React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
 const { open, setOpen, listboxId } = React.useContext(SelectContext)!

 const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
 if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
 e.preventDefault()
 if (!open) {
 setOpen?.(true)
 }
 }
 if (e.key === 'Escape' && open) {
 e.preventDefault()
 setOpen?.(false)
 }
 if (e.key === 'Home' || e.key === 'End') {
 e.preventDefault()
 if (!open) {
 setOpen?.(true)
 }
 }
 }

 return (
 <button
 onClick={() => setOpen?.(!open)}
 onKeyDown={handleKeyDown}
 ref={ref}
 role="combobox"
 aria-expanded={open}
 aria-controls={listboxId}
 aria-haspopup="listbox"
 className={cn(
 "flex h-11 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
 className
 )}
 {...props}
 >
 {children}
 <ChevronDown className="h-4 w-4 opacity-60" />
 </button>
 )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = React.forwardRef<
 HTMLSpanElement,
 React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }
>(({ className, placeholder, ...props }, ref) => {
 const { value } = React.useContext(SelectContext)!
 return (
 <span ref={ref} className={cn("block truncate", className)} {...props}>
 {value || placeholder}
 </span>
 )
})
SelectValue.displayName = "SelectValue"

const SelectContent = React.forwardRef<
 HTMLDivElement,
 React.HTMLAttributes<HTMLDivElement> & { position?: "popper" | "item-aligned" }
>(({ className, children, position = "popper", ...props }, ref) => {
 const { open, setOpen, listboxId } = React.useContext(SelectContext)!
 if (!open) return null

 const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
 if (e.key === 'Escape') {
 e.preventDefault()
 setOpen?.(false)
 }
 if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
 e.preventDefault()
 const container = e.currentTarget
 const items = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'))
 if (items.length === 0) return
 const currentIndex = items.findIndex((item) => item === document.activeElement)
 let nextIndex: number
 if (e.key === 'ArrowDown') {
 nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
 } else {
 nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
 }
 items[nextIndex]?.focus()
 }
 if (e.key === 'Home') {
 e.preventDefault()
 const container = e.currentTarget
 const items = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'))
 if (items.length > 0) items[0]?.focus()
 }
 if (e.key === 'End') {
 e.preventDefault()
 const container = e.currentTarget
 const items = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'))
 if (items.length > 0) items[items.length - 1]?.focus()
 }
 }

 return (
 <div
 ref={ref}
 id={listboxId}
 role="listbox"
 tabIndex={-1}
 className={cn(
 "absolute z-dropdown min-w-[8rem] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-apple-md animate-in fade-in-0 zoom-in-95",
 position === "popper" && "translate-y-1",
 className
 )}
 style={{ top: "100%", left: 0, width: "100%" }}
 onKeyDown={handleKeyDown}
 {...props}
 >
 <div className="p-1">{children}</div>
 </div>
 )
})
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<
 HTMLDivElement,
 React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, children, value, onClick, ...props }, ref) => {
 const { onValueChange, setOpen, value: currentValue } = React.useContext(SelectContext)!
 return (
 <div
 ref={ref}
 role="option"
 tabIndex={0}
 aria-selected={value === currentValue}
 className={cn(
 "relative flex w-full cursor-default select-none items-center rounded-xl py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-60 hover:bg-accent hover:text-accent-foreground cursor-pointer",
 className
 )}
 onClick={(e) => {
 onValueChange?.(value)
 setOpen?.(false)
 onClick?.(e)
 }}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
  e.preventDefault()
  onValueChange?.(value)
  setOpen?.(false)
 }
 }}
 {...props}
 >
 <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
 {/* Check indicator could go here */}
 </span>
 <span className="truncate">{children}</span>
 </div>
 )
})
SelectItem.displayName = "SelectItem"

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator }

// Stub components for completeness
const SelectGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={className} {...props} />)
const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)} {...props} />)
const SelectSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />)
