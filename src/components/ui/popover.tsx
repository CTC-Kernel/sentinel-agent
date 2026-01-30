import * as React from "react"
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

const PopoverContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        align?: "start" | "center" | "end"
        sideOffset?: number
    }
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
    const PopoverPanel = HeadlessPopover.Panel;
    return (
        <Transition
            as={React.Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
        >
            <PopoverPanel
                ref={ref}
                className={cn(
                    "absolute z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
                    align === "start" && "left-0",
                    align === "end" && "right-0",
                    align === "center" && "left-1/2 -translate-x-1/2",
                    className
                )}
                style={{ marginTop: sideOffset }}
                {...props}
            />
        </Transition>
    )
})
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverTrigger, PopoverContent }
