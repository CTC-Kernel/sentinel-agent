import * as React from "react"
import { createPortal } from "react-dom"
import { Popover as HeadlessPopover, Transition } from "@headlessui/react"
import { cn } from "@/lib/utils"

const Popover = HeadlessPopover

const PopoverTrigger = React.forwardRef<
 HTMLButtonElement,
 React.ComponentPropsWithoutRef<typeof HeadlessPopover.Button> & { asChild?: boolean; className?: string }
>(({ className, asChild, children, ...props }, ref) => {
 // Note: HeadlessUI doesn't support asChild, so we ignore it and render the button wrapper
 // If asChild is true and children is a button element, we try to pass className to it
 if (asChild && React.isValidElement(children)) {
 const childElement = children as React.ReactElement<{ className?: string }>;
 return (
 <HeadlessPopover.Button
 as={React.Fragment}
 ref={ref}
 {...props}
 >
 {React.cloneElement(childElement, {
  className: cn(childElement.props?.className, className),
 })}
 </HeadlessPopover.Button>
 )
 }

 return (
 <HeadlessPopover.Button
 ref={ref}
 className={className}
 {...props}
 >
 {children}
 </HeadlessPopover.Button>
 )
})
PopoverTrigger.displayName = "PopoverTrigger"

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
 align?: "start" | "center" | "end"
 sideOffset?: number
 /** Use Portal to escape overflow:hidden containers (default: true) */
 portal?: boolean
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
 ({ className, align = "center", sideOffset = 4, portal = true, ...props }, ref) => {
 const [coords, setCoords] = React.useState({ top: 0, left: 0 })
 const buttonRef = React.useRef<HTMLElement | null>(null)

 // Find the popover button to position relative to
 React.useEffect(() => {
 const findButton = () => {
  const buttons = document.querySelectorAll('[data-headlessui-state]')
  buttons.forEach((btn) => {
  if (btn.getAttribute('aria-expanded') === 'true') {
   buttonRef.current = btn as HTMLElement
  }
  })
 }
 findButton()
 }, [])

 const updatePosition = React.useCallback(() => {
 if (buttonRef.current) {
  const rect = buttonRef.current.getBoundingClientRect()
  let left = rect.left

  if (align === "end") {
  left = rect.right - 288 // w-72 = 18rem = 288px
  } else if (align === "center") {
  left = rect.left + rect.width / 2 - 144
  }

  // Ensure doesn't go off-screen
  if (left < 8) left = 8
  if (left + 288 > window.innerWidth - 8) {
  left = window.innerWidth - 288 - 8
  }

  setCoords({
  top: rect.bottom + sideOffset,
  left,
  })
 }
 }, [align, sideOffset])

 React.useEffect(() => {
 updatePosition()
 window.addEventListener('scroll', updatePosition, true)
 window.addEventListener('resize', updatePosition)
 return () => {
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
 }
 }, [updatePosition])

 const content = (
 <Transition
  as={React.Fragment}
  enter="transition ease-out duration-200"
  enterFrom="opacity-0 translate-y-1"
  enterTo="opacity-100 translate-y-0"
  leave="transition ease-in duration-150"
  leaveFrom="opacity-100 translate-y-0"
  leaveTo="opacity-0 translate-y-1"
 >
  <HeadlessPopover.Panel
  ref={ref}
  className={cn(
   portal ? "fixed" : "absolute",
   "z-popover w-72 rounded-xl border bg-popover p-4 text-popover-foreground shadow-elevation-md outline-none",
   !portal && align === "start" && "left-0",
   !portal && align === "end" && "right-0",
   !portal && align === "center" && "left-1/2 -translate-x-1/2",
   className
  )}
  style={portal ? { top: coords.top, left: coords.left } : { marginTop: sideOffset }}
  {...props}
  />
 </Transition>
 )

 if (portal && typeof document !== 'undefined') {
 return createPortal(content, document.body)
 }

 return content
 }
)
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverTrigger, PopoverContent }
