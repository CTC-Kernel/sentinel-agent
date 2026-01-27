/**
 * Story 31.10 - Calendar Heatmap
 *
 * GitHub-style contribution heatmap showing Voxel activity per day.
 * Color intensity based on change volume, click to load snapshot.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  format,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  getDay,
  getMonth,
  parseISO,
  isToday,
  isFuture,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ErrorLogger } from '@/services/errorLogger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase';
import { Calendar, Activity, ChevronLeft, ChevronRight } from '../ui/Icons';

// ============================================================================
// Types
// ============================================================================

interface DayData {
  date: string;
  hasData: boolean;
  changes: number;
  nodesDelta: number;
  anomaliesDelta: number;
  risksDelta: number;
  complianceDelta: number;
}

interface CalendarHeatmapProps {
  /** CSS class name */
  className?: string;
  /** Initial year to display */
  initialYear?: number;
  /** Callback when a day is clicked */
  onDayClick?: (date: string, data: DayData | null) => void;
  /** Callback to load snapshot for a date */
  onLoadSnapshot?: (date: string) => void;
}

type IntensityLevel = 0 | 1 | 2 | 3 | 4;


// ============================================================================
// Constants
// ============================================================================

const DAYS_OF_WEEK = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aout', 'Sep', 'Oct', 'Nov', 'Dec'];

const INTENSITY_COLORS: Record<IntensityLevel, string> = {
  0: 'bg-muted hover:bg-muted/80',
  1: 'bg-emerald-200 dark:bg-emerald-900/50 hover:bg-emerald-300 dark:hover:bg-emerald-800/50',
  2: 'bg-emerald-400 dark:bg-emerald-700 hover:bg-emerald-500 dark:hover:bg-emerald-600',
  3: 'bg-emerald-500 dark:bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400',
  4: 'bg-emerald-700 dark:bg-emerald-400 hover:bg-emerald-800 dark:hover:bg-emerald-300',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate intensity level based on change count
 */
function getIntensityLevel(changes: number, maxChanges: number): IntensityLevel {
  if (changes === 0 || maxChanges === 0) return 0;

  const ratio = changes / maxChanges;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/**
 * Get week number for positioning
 */
function getWeekNumber(date: Date, yearStart: Date): number {
  const dayOfYear = Math.ceil(
    (date.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.floor((dayOfYear + getDay(yearStart)) / 7);
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Single day cell in the heatmap
 */
function DayCell({
  date,
  data,
  intensity,
  onClick,
  isSelected,
}: {
  date: Date;
  data: DayData | null;
  intensity: IntensityLevel;
  onClick: () => void;
  isSelected: boolean;
}) {
  const isFutureDate = isFuture(date);
  const isTodayDate = isToday(date);


  const tooltipContent = (
    <div className="text-xs">
      <div className="font-medium">
        {format(date, 'EEEE d MMMM yyyy', { locale: fr })}
      </div>
      {data?.hasData ? (
        <div className="mt-1 space-y-0.5">
          <div>{data.changes} changements</div>
          {data.nodesDelta !== 0 && (
            <div className={data.nodesDelta > 0 ? 'text-emerald-500' : 'text-red-500'}>
              Noeuds: {data.nodesDelta > 0 ? '+' : ''}{data.nodesDelta}
            </div>
          )}
          {data.anomaliesDelta !== 0 && (
            <div className={data.anomaliesDelta > 0 ? 'text-orange-500' : 'text-emerald-500'}>
              Anomalies: {data.anomaliesDelta > 0 ? '+' : ''}{data.anomaliesDelta}
            </div>
          )}
        </div>
      ) : (
        <div className="text-muted-foreground">Pas de donnees</div>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent}>
      <button
        className={cn(
          'w-3 h-3 rounded-sm transition-colors',
          INTENSITY_COLORS[isFutureDate ? 0 : intensity],
          isSelected && 'ring-2 ring-primary ring-offset-1',
          isTodayDate && 'ring-1 ring-foreground/30',
          isFutureDate && 'opacity-50 cursor-not-allowed'
        )}
        onClick={isFutureDate ? undefined : onClick}
        disabled={isFutureDate}
      />
    </Tooltip>
  );

}

/**
 * Legend for intensity levels
 */
function IntensityLegend() {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>Moins</span>
      {([0, 1, 2, 3, 4] as IntensityLevel[]).map((level) => (
        <div
          key={level}
          className={cn('w-3 h-3 rounded-sm', INTENSITY_COLORS[level])}
        />
      ))}
      <span>Plus</span>
    </div>
  );
}

/**
 * Loading skeleton
 */
function HeatmapSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-1">
        {Array.from({ length: 52 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton key={j} className="w-3 h-3 rounded-sm" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CalendarHeatmap({
  className,
  initialYear = new Date().getFullYear(),
  onDayClick,
  onLoadSnapshot,
}: CalendarHeatmapProps) {
  const [year, setYear] = useState(initialYear);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activityData, setActivityData] = useState<Map<string, DayData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Generate all days for the year
  const yearDays = useMemo(() => {
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(new Date(year, 0, 1));
    return eachDayOfInterval({ start, end });
  }, [year]);

  // Calculate max changes for intensity scaling
  const maxChanges = useMemo(() => {
    let max = 0;
    activityData.forEach((data) => {
      if (data.changes > max) max = data.changes;
    });
    return max;
  }, [activityData]);

  // Organize days by week for grid layout
  const weeks = useMemo(() => {
    const yearStart = startOfYear(new Date(year, 0, 1));
    const weeksMap: Map<number, { date: Date; dayOfWeek: number }[]> = new Map();

    yearDays.forEach((date) => {
      const weekNum = getWeekNumber(date, yearStart);
      const dayOfWeek = getDay(date);

      if (!weeksMap.has(weekNum)) {
        weeksMap.set(weekNum, []);
      }
      weeksMap.get(weekNum)!.push({ date, dayOfWeek });
    });

    return Array.from(weeksMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([_weekNum, days]) => days);
  }, [yearDays, year]);

  // Get month labels with their positions
  const monthLabels = useMemo(() => {
    const labels: { month: string; weekIndex: number }[] = [];
    const yearStart = startOfYear(new Date(year, 0, 1));
    let lastMonth = -1;

    yearDays.forEach((date) => {
      const month = getMonth(date);
      if (month !== lastMonth) {
        const weekNum = getWeekNumber(date, yearStart);
        labels.push({
          month: MONTHS[month],
          weekIndex: weekNum,
        });
        lastMonth = month;
      }
    });

    return labels;
  }, [yearDays, year]);

  // Fetch activity data
  const fetchActivityData = useCallback(async () => {
    setIsLoading(true);

    try {
      const startDate = format(startOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');
      const endDate = format(endOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');

      const getSnapshots = httpsCallable(functions, 'getVoxelSnapshots');
      const result = await getSnapshots({
        startDate,
        endDate,
        limit: 366,
      });

      interface VoxelSnapshot {
        date: string;
        metrics?: {
          nodes?: { total: number };
          anomalies?: { active: number };
          risks?: { total: number };
          compliance?: { implementationRate: number };
        };
      }

      // ... inside component ...
      const response = result.data as { success: boolean; snapshots: VoxelSnapshot[] };
      if (response.success) {
        const dataMap = new Map<string, DayData>();

        // Sort snapshots by date
        const sortedSnapshots = response.snapshots.sort((a, b) =>
          a.date.localeCompare(b.date)
        );

        // Calculate deltas between consecutive snapshots
        for (let i = 0; i < sortedSnapshots.length; i++) {
          const current = sortedSnapshots[i];
          const previous = i > 0 ? sortedSnapshots[i - 1] : null;

          const nodesDelta = previous
            ? (current.metrics?.nodes?.total || 0) - (previous.metrics?.nodes?.total || 0)
            : 0;
          const anomaliesDelta = previous
            ? (current.metrics?.anomalies?.active || 0) - (previous.metrics?.anomalies?.active || 0)
            : 0;
          const risksDelta = previous
            ? (current.metrics?.risks?.total || 0) - (previous.metrics?.risks?.total || 0)
            : 0;
          const complianceDelta = previous
            ? (current.metrics?.compliance?.implementationRate || 0) -
            (previous.metrics?.compliance?.implementationRate || 0)
            : 0;

          // Total changes = sum of absolute deltas
          const changes =
            Math.abs(nodesDelta) + Math.abs(anomaliesDelta) + Math.abs(risksDelta);

          dataMap.set(current.date, {
            date: current.date,
            hasData: true,
            changes,
            nodesDelta,
            anomaliesDelta,
            risksDelta,
            complianceDelta,
          });
        }

        setActivityData(dataMap);
      }
    } catch (err) {
      ErrorLogger.error(err, 'CalendarHeatmap.fetchActivityData');
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  // Fetch data on mount and when year changes
  useEffect(() => {
    fetchActivityData();
  }, [fetchActivityData]);

  // Handle day click
  const handleDayClick = useCallback(
    (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      setSelectedDate(dateStr);
      const data = activityData.get(dateStr) || null;
      onDayClick?.(dateStr, data);
    },
    [activityData, onDayClick]
  );

  // Handle load snapshot
  const handleLoadSnapshot = useCallback(() => {
    if (selectedDate) {
      onLoadSnapshot?.(selectedDate);
    }
  }, [selectedDate, onLoadSnapshot]);

  // Year navigation
  const goToPreviousYear = useCallback(() => setYear((y) => y - 1), []);
  const goToNextYear = useCallback(() => setYear((y) => y + 1), []);

  // Available years for dropdown
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  // Calculate total activity
  const totalActivity = useMemo(() => {
    let total = 0;
    activityData.forEach((data) => {
      total += data.changes;
    });
    return total;
  }, [activityData]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Activite Voxel
            </CardTitle>
            <CardDescription>
              {totalActivity} changements en {year}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToPreviousYear}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToNextYear}
              disabled={year >= new Date().getFullYear()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <HeatmapSkeleton />
        ) : (
          <div className="space-y-4">
            {/* Month labels */}
            <div className="relative h-4 ml-8">
              {monthLabels.map(({ month, weekIndex }, i) => (
                <span
                  key={`${month}-${i}`}
                  className="absolute text-xs text-muted-foreground"
                  style={{ left: `${(weekIndex / 53) * 100}%` }}
                >
                  {month}
                </span>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="flex gap-1">
              {/* Day of week labels */}
              <div className="flex flex-col gap-1 pr-2">
                {DAYS_OF_WEEK.map((day, i) => (
                  <div
                    key={day}
                    className="h-3 text-[10px] text-muted-foreground leading-3"
                    style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Week columns */}
              <div className="flex gap-1 overflow-x-auto">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {/* Create 7 slots for days of week */}
                    {Array.from({ length: 7 }).map((_, dayOfWeekIndex) => {
                      const dayData = week.find((d) => d.dayOfWeek === dayOfWeekIndex);

                      if (!dayData) {
                        return <div key={dayOfWeekIndex} className="w-3 h-3" />;
                      }

                      const dateStr = format(dayData.date, 'yyyy-MM-dd');
                      const data = activityData.get(dateStr) || null;
                      const intensity = data
                        ? getIntensityLevel(data.changes, maxChanges)
                        : (0 as IntensityLevel);

                      return (
                        <DayCell
                          key={dateStr}
                          date={dayData.date}
                          data={data}
                          intensity={intensity}
                          onClick={() => handleDayClick(dayData.date)}
                          isSelected={selectedDate === dateStr}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
              <IntensityLegend />
              {selectedDate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadSnapshot}
                  className="gap-2"
                >
                  <Activity className="h-4 w-4" />
                  Charger le snapshot du {format(parseISO(selectedDate), 'd MMM', { locale: fr })}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CalendarHeatmap;
