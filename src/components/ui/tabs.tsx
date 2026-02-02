import * as React from "react"
import { Spinner } from "./Spinner"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
    value: string
    onValueChange: (value: string) => void
} | null>(null)

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
    defaultValue?: string
    value?: string
    onValueChange?: (value: string) => void
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
    ({ className, defaultValue, value: controlledValue, onValueChange, children, ...props }, ref) => {
        const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || "")
        const value = controlledValue !== undefined ? controlledValue : uncontrolledValue

        const handleValueChange = React.useCallback(
            (newValue: string) => {
                if (onValueChange) {
                    onValueChange(newValue)
                }
                if (controlledValue === undefined) {
                    setUncontrolledValue(newValue)
                }
            },
            [controlledValue, onValueChange]
        )

        return (
            <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
                <div ref={ref} className={cn("", className)} {...props}>
                    {children}
                </div>
            </TabsContext.Provider>
        )
    }
)
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "inline-flex h-10 items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground",
            className
        )}
        {...props}
    />
))
TabsList.displayName = "TabsList"

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    value: string
    isLoading?: boolean
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
    ({ className, value, onClick, isLoading, children, ...props }, ref) => {
        const context = React.useContext(TabsContext)
        if (!context) throw new Error("TabsTrigger must be used within Tabs")

        const isActive = context.value === value

        return (
            <button
                ref={ref}
                id={`tab-${value}`}
                role="tab"
                aria-selected={isActive}
                data-state={isActive ? "active" : "inactive"}
                disabled={isLoading || props.disabled}
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                    isLoading && "cursor-wait",
                    className
                )}
                onClick={(e) => {
                    context.onValueChange(value)
                    onClick?.(e)
                }}
                {...props}
            >
                {isLoading && <Spinner className="mr-2 h-3 w-3" size="sm" />}
                {children}
            </button>
        )
    }
)
TabsTrigger.displayName = "TabsTrigger"

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
    ({ className, value, children, ...props }, ref) => {
        const context = React.useContext(TabsContext)
        if (!context) throw new Error("TabsContent must be used within Tabs")

        // Optimisation: Garder le composant monté mais caché au lieu de démonter
        const isActive = context.value === value

        return (
            <div
                ref={ref}
                role="tabpanel"
                aria-labelledby={`tab-${value}`}
                data-state={isActive ? "active" : "inactive"}
                style={{
                    display: isActive ? 'block' : 'none'
                }}
                className={cn(
                    "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
