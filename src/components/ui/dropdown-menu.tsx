
import * as React from "react"
import { createPortal } from "react-dom"
import { Menu, Transition } from "@headlessui/react"
import { cn } from "@/lib/utils"

const DropdownMenu = Menu

const DropdownMenuTrigger = React.forwardRef<
 HTMLButtonElement,
 React.ComponentPropsWithoutRef<typeof Menu.Button> & { asChild?: boolean; className?: string }
>(({ className, asChild, children, ...props }, ref) => {
 // Note: HeadlessUI doesn't support asChild natively
 // If asChild is true and children is a single element, we try to pass through
 if (asChild && React.isValidElement(children)) {
 const childElement = children as React.ReactElement<{ className?: string }>;
 return (
 <Menu.Button
 as={React.Fragment}
 ref={ref}
 {...props}
 >
 {React.cloneElement(childElement, {
  className: cn(childElement.props?.className, className),
 })}
 </Menu.Button>
 )
 }

 return (
 <Menu.Button
 ref={ref}
 className={className}
 {...props}
 >
 {children}
 </Menu.Button>
 )
})
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

interface DropdownMenuContentProps {
 className?: string;
 align?: "start" | "end" | "center";
 children?: React.ReactNode;
 /** Use Portal to escape overflow:hidden containers (default: true) */
 portal?: boolean;
}

const DropdownMenuContent = React.forwardRef<
 HTMLDivElement,
 DropdownMenuContentProps & Record<string, unknown>
>(({ className, align = "center", portal = true, ...props }, ref) => {
 const triggerRef = React.useRef<HTMLElement | null>(null);
 const [position, setPosition] = React.useState({ top: 0, left: 0 });

 // Find the trigger button to calculate position
 React.useEffect(() => {
 // Find the Menu.Button in the parent Menu context
 const findTrigger = () => {
 const buttons = document.querySelectorAll('[data-headlessui-state]');
 buttons.forEach((btn) => {
  if (btn.getAttribute('aria-haspopup') === 'menu' || btn.getAttribute('aria-expanded')) {
  triggerRef.current = btn as HTMLElement;
  }
 });
 };
 findTrigger();
 }, []);

 const updatePosition = React.useCallback(() => {
 if (triggerRef.current) {
 const rect = triggerRef.current.getBoundingClientRect();
 const menuWidth = 200; // Approximate min-width

 let left = rect.left;
 if (align === "end") {
  left = rect.right - menuWidth;
 } else if (align === "center") {
  left = rect.left + (rect.width / 2) - (menuWidth / 2);
 }

 // Ensure menu doesn't go off-screen
 if (left < 8) left = 8;
 if (left + menuWidth > window.innerWidth - 8) {
  left = window.innerWidth - menuWidth - 8;
 }

 setPosition({
  top: rect.bottom + 8,
  left,
 });
 }
 }, [align]);

 React.useEffect(() => {
 updatePosition();
 window.addEventListener('scroll', updatePosition, true);
 window.addEventListener('resize', updatePosition);
 return () => {
 window.removeEventListener('scroll', updatePosition, true);
 window.removeEventListener('resize', updatePosition);
 };
 }, [updatePosition]);

 const content = (
 <Transition
 as={React.Fragment}
 enter="transition ease-out duration-200"
 enterFrom="transform opacity-0 scale-95"
 enterTo="transform opacity-100 scale-100"
 leave="transition ease-in duration-150"
 leaveFrom="transform opacity-100 scale-100"
 leaveTo="transform opacity-0 scale-95"
 >
 <Menu.Items
 ref={ref}
 className={cn(
  portal ? "fixed" : "absolute",
  "z-dropdown mt-2 min-w-[8rem] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-apple-md focus:outline-none",
  !portal && align === "start" && "left-0",
  !portal && align === "end" && "right-0",
  !portal && align === "center" && "left-1/2 -translate-x-1/2",
  className as string | undefined
 )}
 style={portal ? { top: position.top, left: position.left } : undefined}
 {...props}
 />
 </Transition>
 );

 if (portal && typeof document !== 'undefined') {
 return createPortal(content, document.body);
 }

 return content;
})
DropdownMenuContent.displayName = "DropdownMenuContent"

interface MenuItemRenderProps {
 active: boolean;
 disabled: boolean;
}

const DropdownMenuItem = React.forwardRef<
 HTMLDivElement,
 React.ComponentProps<typeof Menu.Item> & { inset?: boolean; onClick?: () => void; className?: string }
>(({ className, inset, onClick, children, ...props }, ref) => {
 const MenuItem = Menu.Item;
 return (
 <MenuItem>
 {({ active, disabled }: MenuItemRenderProps) => (
 <div
  ref={ref}
  className={cn(
  "relative flex cursor-default select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none transition-colors",
  active && "bg-accent text-accent-foreground",
  disabled && "pointer-events-none opacity-60",
  inset && "pl-8",
  className
  )}
  onClick={!disabled ? onClick : undefined}
  role="menuitem"
  tabIndex={disabled ? -1 : 0}
  onKeyDown={(e) => {
  if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
  e.preventDefault();
  onClick?.();
  }
  }}
  {...props}
 >
  {children as React.ReactNode}
 </div>
 )}
 </MenuItem>
 );
})
DropdownMenuItem.displayName = "DropdownMenuItem"

const DropdownMenuLabel = React.forwardRef<
 HTMLDivElement,
 React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
 <div
 ref={ref}
 className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
 {...props}
 />
))
DropdownMenuLabel.displayName = "DropdownMenuLabel"

const DropdownMenuSeparator = React.forwardRef<
 HTMLDivElement,
 React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
 <div
 ref={ref}
 className={cn("-mx-1 my-1 h-px bg-muted", className)}
 {...props}
 />
))
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

const DropdownMenuGroup = React.forwardRef<
 HTMLDivElement,
 React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
 <div ref={ref} className={cn("", className)} {...props} />
))
DropdownMenuGroup.displayName = "DropdownMenuGroup"

export {
 DropdownMenu,
 DropdownMenuTrigger,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuLabel,
 DropdownMenuSeparator,
 DropdownMenuGroup,
}
