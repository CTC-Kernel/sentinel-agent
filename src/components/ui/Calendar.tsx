import * as React from "react"
import { DayPicker } from "react-day-picker"
import { fr } from "date-fns/locale"

import { cn } from "../../lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            locale={fr}
            showOutsideDays={showOutsideDays}
            className={cn("p-3", className)}
            classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                    "h-7 w-7 bg-transparent hover:opacity-70 border border-slate-200 dark:border-white/10 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center opacity-60 transition-all"
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell:
                    "text-slate-600 rounded-md w-9 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-slate-100/50 [&:has([aria-selected])]:bg-slate-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: cn(
                    "h-9 w-9 p-0 font-normal aria-selected:opacity-70 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-white/10"
                ),
                day_range_end: "day-range-end",
                day_selected:
                    "bg-brand-600 text-white hover:bg-brand-600 hover:text-white focus:bg-brand-600 focus:text-white",
                day_today: "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 font-bold",
                day_outside:
                    "day-outside text-slate-600 dark:text-slate-300 opacity-60 aria-selected:bg-slate-100/50 aria-selected:text-slate-600 aria-selected:opacity-30",
                day_disabled: "text-slate-600 opacity-60",
                day_range_middle:
                    "aria-selected:bg-slate-100 aria-selected:text-slate-900",
                day_hidden: "invisible",
                ...classNames,
            }}
            {...props}
        />
    )
}
Calendar.displayName = "Calendar"

export { Calendar }
