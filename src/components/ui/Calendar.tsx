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
  "h-7 w-7 bg-transparent hover:opacity-70 border border-border/40 p-0 rounded-lg hover:bg-muted dark:hover:bg-muted flex items-center justify-center opacity-60 transition-all"
 ),
 nav_button_previous: "absolute left-1",
 nav_button_next: "absolute right-1",
 table: "w-full border-collapse space-y-1",
 head_row: "flex",
 head_cell:
  "text-muted-foreground rounded-md w-9 font-normal text-xs",
 row: "flex w-full mt-2",
 cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-muted/50 [&:has([aria-selected])]:bg-muted first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
 day: cn(
  "h-9 w-9 p-0 font-normal aria-selected:opacity-70 rounded-lg transition-colors hover:bg-muted dark:hover:bg-muted"
 ),
 day_range_end: "day-range-end",
 day_selected:
  "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-foreground focus:bg-primary focus:text-white",
 day_today: "bg-muted text-foreground border border-border/40 font-bold",
 day_outside:
  "day-outside text-muted-foreground opacity-60 aria-selected:bg-muted/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
 day_disabled: "text-muted-foreground opacity-60",
 day_range_middle:
  "aria-selected:bg-muted aria-selected:text-foreground",
 day_hidden: "invisible",
 ...classNames,
 }}
 {...props}
 />
 )
}
Calendar.displayName = "Calendar"

export { Calendar }
