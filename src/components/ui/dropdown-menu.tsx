
import * as React from "react"
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

const DropdownMenuContent = React.forwardRef<
    HTMLDivElement,
    { className?: string; align?: "start" | "end" | "center"; children?: React.ReactNode } & Record<string, unknown>
>(({ className, align = "center", ...props }, ref) => {
    const MenuItems = Menu.Items;
    return (
        <Transition
            as={React.Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
        >
            <MenuItems
                ref={ref}
                className={cn(
                    "absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md focus:outline-none",
                    align === "start" && "left-0",
                    align === "end" && "right-0",
                    align === "center" && "left-1/2 -translate-x-1/2",
                    className as string | undefined
                )}
                {...props}
            />
        </Transition>
    )
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
                        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                        active && "bg-accent text-accent-foreground",
                        disabled && "pointer-events-none opacity-50",
                        inset && "pl-8",
                        className
                    )}
                    onClick={!disabled ? onClick : undefined}
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
