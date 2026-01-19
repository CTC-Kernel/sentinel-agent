/**
 * Story 31.7 - Time Machine UI
 *
 * Component for viewing historical Voxel snapshots.
 * Provides date picker, timeline slider, and comparison features.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Layers,
  GitCompare,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from '../ui/Icons';
import { format, subDays, addDays, isAfter, isBefore, isEqual } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarPicker } from '@/components/ui/Calendar';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase';

// ============================================================================
// Types
// ============================================================================

interface VoxelSnapshot {
  id: string;
  organizationId: string;
  date: string;
  createdAt: string;
  metrics: {
    nodes: {
      total: number;
      byType: Record<string, number>;
    };
    edges: {
      total: number;
      byType: Record<string, number>;
    };
    anomalies: {
      total: number;
      active: number;
      acknowledged: number;
      resolved: number;
      dismissed: number;
      bySeverity: Record<string, number>;
      byType: Record<string, number>;
    };
    risks: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    };
    compliance: {
      totalControls: number;
      implementedControls: number;
      partialControls: number;
      notImplemented: number;
      implementationRate: number;
      averageEffectiveness: number;
    } | null;
  };
}

interface SnapshotDelta {
  nodes: {
    total: number;
    byType: Record<string, number>;
  };
  edges: {
    total: number;
  };
  anomalies: {
    total: number;
    active: number;
  };
  compliance: {
    implementationRate: number;
    averageEffectiveness: number;
  } | null;
}

interface TimeMachineProps {
  /** Whether the time machine panel is visible */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Callback when a snapshot is selected */
  onSnapshotSelect?: (snapshot: VoxelSnapshot) => void;
  /** Callback when comparison mode is activated */
  onCompare?: (snapshot1: VoxelSnapshot, snapshot2: VoxelSnapshot, delta: SnapshotDelta) => void;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Delta indicator showing increase/decrease
 */
function DeltaIndicator({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value === 0) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
        <Minus className="h-3 w-3" />
        0{suffix}
      </span>
    );
  }

  const isPositive = value > 0;
  return (
    <span className={cn(
      'text-xs flex items-center gap-0.5',
      isPositive ? 'text-emerald-500' : 'text-red-500'
    )}>
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isPositive ? '+' : ''}{value}{suffix}
    </span>
  );
}

/**
 * Metric card for snapshot data
 */
function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  delta?: number;
  icon?: React.ElementType;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-xl font-semibold">{value}</span>
        {delta !== undefined && <DeltaIndicator value={delta} />}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for snapshot content
 */
function SnapshotSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TimeMachine({
  isOpen,
  onClose,
  onSnapshotSelect,
  onCompare,
}: TimeMachineProps) {
  // State
  const [selectedDate, setSelectedDate] = useState<Date>(subDays(new Date(), 1));
  const [compareDate, setCompareDate] = useState<Date | null>(null);
  const [snapshot, setSnapshot] = useState<VoxelSnapshot | null>(null);
  const [_compareSnapshot, setCompareSnapshot] = useState<VoxelSnapshot | null>(null);
  const [delta, setDelta] = useState<SnapshotDelta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isCompareCalendarOpen, setIsCompareCalendarOpen] = useState(false);

  // Date range for the timeline (last 90 days)
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 90);
    return { start, end };
  }, []);

  // Fetch snapshot for selected date
  const fetchSnapshot = useCallback(async (date: Date) => {
    setIsLoading(true);
    setError(null);

    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const getSnapshot = httpsCallable(functions, 'getVoxelSnapshotByDate');
      const result = await getSnapshot({ date: dateStr });

      const data = result.data as { success: boolean; snapshot: VoxelSnapshot | null };
      if (data.success && data.snapshot) {
        setSnapshot(data.snapshot);
        onSnapshotSelect?.(data.snapshot);
      } else {
        setSnapshot(null);
        setError('Aucun snapshot disponible pour cette date');
      }
    } catch (err) {
      console.error('Failed to fetch snapshot:', err);
      setError('Erreur lors du chargement du snapshot');
    } finally {
      setIsLoading(false);
    }
  }, [onSnapshotSelect]);

  // Compare two snapshots
  const fetchComparison = useCallback(async (date1: Date, date2: Date) => {
    setIsLoading(true);
    setError(null);

    try {
      const compareSnapshots = httpsCallable(functions, 'compareVoxelSnapshots');
      const result = await compareSnapshots({
        date1: format(date1, 'yyyy-MM-dd'),
        date2: format(date2, 'yyyy-MM-dd'),
      });

      const data = result.data as {
        success: boolean;
        snapshot1: { date: string; metrics: VoxelSnapshot['metrics'] };
        snapshot2: { date: string; metrics: VoxelSnapshot['metrics'] };
        delta: SnapshotDelta;
      };

      if (data.success) {
        setDelta(data.delta);
        setCompareSnapshot({
          id: `compare-${data.snapshot2.date}`,
          organizationId: '',
          date: data.snapshot2.date,
          createdAt: new Date().toISOString(),
          metrics: data.snapshot2.metrics,
        });

        onCompare?.(
          snapshot!,
          {
            id: `compare-${data.snapshot2.date}`,
            organizationId: '',
            date: data.snapshot2.date,
            createdAt: new Date().toISOString(),
            metrics: data.snapshot2.metrics,
          },
          data.delta
        );
      }
    } catch (err) {
      console.error('Failed to compare snapshots:', err);
      setError('Erreur lors de la comparaison');
    } finally {
      setIsLoading(false);
    }
  }, [snapshot, onCompare]);



  // Fetch snapshot when date changes
  useEffect(() => {
    if (isOpen && selectedDate) {
      fetchSnapshot(selectedDate);
    }
  }, [isOpen, selectedDate, fetchSnapshot]);

  // Handle comparison when compare date changes
  useEffect(() => {
    if (isCompareMode && compareDate && snapshot) {
      fetchComparison(selectedDate, compareDate);
    }
  }, [isCompareMode, compareDate, selectedDate, snapshot, fetchComparison]);

  // Navigate to previous day
  const goToPreviousDay = useCallback(() => {
    const prevDay = subDays(selectedDate, 1);
    if (!isBefore(prevDay, dateRange.start)) {
      setSelectedDate(prevDay);
    }
  }, [selectedDate, dateRange.start]);

  // Navigate to next day
  const goToNextDay = useCallback(() => {
    const nextDay = addDays(selectedDate, 1);
    if (!isAfter(nextDay, dateRange.end)) {
      setSelectedDate(nextDay);
    }
  }, [selectedDate, dateRange.end]);

  // Handle slider change
  const handleSliderChange = useCallback((value: number[]) => {
    const daysAgo = value[0];
    const newDate = subDays(new Date(), daysAgo);
    setSelectedDate(newDate);
  }, []);

  // Calculate slider value from date
  const sliderValue = useMemo(() => {
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - selectedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return [diffDays];
  }, [selectedDate]);

  // Toggle compare mode
  const toggleCompareMode = useCallback(() => {
    if (isCompareMode) {
      setIsCompareMode(false);
      setCompareDate(null);
      setCompareSnapshot(null);
      setDelta(null);
    } else {
      setIsCompareMode(true);
      setCompareDate(new Date()); // Compare with today
    }
  }, [isCompareMode]);

  // Reset to today
  const resetToToday = useCallback(() => {
    setSelectedDate(subDays(new Date(), 1)); // Yesterday (since today may not have snapshot yet)
    setIsCompareMode(false);
    setCompareDate(null);
    setDelta(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-background border-l shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Time Machine</h2>
          <Badge variant="soft" className="text-xs">
            {format(selectedDate, 'dd MMM yyyy', { locale: fr })}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Date Navigation */}
      <div className="p-4 border-b space-y-4">
        {/* Date picker and arrows */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goToPreviousDay}
            disabled={isBefore(subDays(selectedDate, 1), dateRange.start)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="relative flex-1">
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {format(selectedDate, 'PPP', { locale: fr })}
            </Button>

            {isCalendarOpen && (
              <div className="absolute top-full left-0 z-50 mt-2 bg-background border rounded-md shadow-lg p-2">
                <CalendarPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setIsCalendarOpen(false);
                    }
                  }}
                  disabled={(date) =>
                    isAfter(date, new Date()) || isBefore(date, dateRange.start)
                  }
                  initialFocus
                />
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goToNextDay}
            disabled={isAfter(addDays(selectedDate, 1), dateRange.end)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Timeline slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>90 jours</span>
            <span>Aujourd'hui</span>
          </div>
          <input
            type="range"
            value={sliderValue[0]}
            max={90}
            min={0}
            step={1}
            onChange={(e) => handleSliderChange([parseInt(e.target.value, 10)])}
            className="w-full cursor-pointer accent-primary h-2 bg-secondary rounded-lg appearance-none"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant={isCompareMode ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={toggleCompareMode}
          >
            <GitCompare className="h-4 w-4 mr-2" />
            {isCompareMode ? 'Annuler comparaison' : 'Comparer'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetToToday}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Compare date picker */}
        {isCompareMode && (
          <div className="pt-2 border-t">
            <label className="text-sm text-muted-foreground mb-2 block">
              Comparer avec:
            </label>
            <div className="relative">
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                onClick={() => setIsCompareCalendarOpen(!isCompareCalendarOpen)}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {compareDate ? format(compareDate, 'PPP', { locale: fr }) : "Selectionnez une date"}
              </Button>

              {isCompareCalendarOpen && (
                <div className="absolute top-full left-0 z-50 mt-2 bg-background border rounded-md shadow-lg p-2">
                  <CalendarPicker
                    mode="single"
                    selected={compareDate || undefined}
                    onSelect={(date) => {
                      if (date) {
                        setCompareDate(date);
                        setIsCompareCalendarOpen(false);
                      }
                    }}
                    disabled={(date) =>
                      isAfter(date, new Date()) ||
                      isBefore(date, dateRange.start) ||
                      isEqual(date, selectedDate)
                    }
                    initialFocus
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Snapshot Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <SnapshotSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : snapshot ? (
          <div className="space-y-6">
            {/* Node counts */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Noeuds du graphe
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Total"
                  value={snapshot.metrics.nodes.total}
                  delta={delta?.nodes.total}
                />
                <MetricCard
                  label="Risques"
                  value={snapshot.metrics.nodes.byType.risk || 0}
                  delta={delta?.nodes.byType.risk}
                />
                <MetricCard
                  label="Controles"
                  value={snapshot.metrics.nodes.byType.control || 0}
                  delta={delta?.nodes.byType.control}
                />
                <MetricCard
                  label="Actifs"
                  value={snapshot.metrics.nodes.byType.asset || 0}
                  delta={delta?.nodes.byType.asset}
                />
              </div>
            </div>

            {/* Anomalies */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Anomalies
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Actives"
                  value={snapshot.metrics.anomalies.active}
                  delta={delta?.anomalies.active}
                />
                <MetricCard
                  label="Total"
                  value={snapshot.metrics.anomalies.total}
                  delta={delta?.anomalies.total}
                />
              </div>
            </div>

            {/* Risk distribution */}
            <div>
              <h3 className="text-sm font-medium mb-3">Distribution des risques</h3>
              <div className="flex gap-2">
                <Tooltip content={`Critique: ${snapshot.metrics.risks.critical}`}>
                  <div className="flex-1 h-2 bg-red-500 rounded" style={{
                    flex: snapshot.metrics.risks.critical || 0.1,
                  }} />
                </Tooltip>
                <Tooltip content={`Haut: ${snapshot.metrics.risks.high}`}>
                  <div className="flex-1 h-2 bg-orange-500 rounded" style={{
                    flex: snapshot.metrics.risks.high || 0.1,
                  }} />
                </Tooltip>
                <Tooltip content={`Moyen: ${snapshot.metrics.risks.medium}`}>
                  <div className="flex-1 h-2 bg-yellow-500 rounded" style={{
                    flex: snapshot.metrics.risks.medium || 0.1,
                  }} />
                </Tooltip>
                <Tooltip content={`Faible: ${snapshot.metrics.risks.low}`}>
                  <div className="flex-1 h-2 bg-green-500 rounded" style={{
                    flex: snapshot.metrics.risks.low || 0.1,
                  }} />
                </Tooltip>
              </div>
            </div>

            {/* Compliance */}
            {snapshot.metrics.compliance && (
              <div>
                <h3 className="text-sm font-medium mb-3">Conformite</h3>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="Taux d'implementation"
                    value={`${snapshot.metrics.compliance.implementationRate}%`}
                    delta={delta?.compliance?.implementationRate}
                  />
                  <MetricCard
                    label="Efficacite moyenne"
                    value={`${snapshot.metrics.compliance.averageEffectiveness}%`}
                    delta={delta?.compliance?.averageEffectiveness}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Selectionnez une date pour voir le snapshot</p>
          </div>
        )}
      </div>

      {/* Footer with read-only indicator */}
      <div className="p-4 border-t bg-muted/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Lecture seule</Badge>
          <span>Donnees historiques - non modifiables</span>
        </div>
      </div>
    </div>
  );
}

export default TimeMachine;
