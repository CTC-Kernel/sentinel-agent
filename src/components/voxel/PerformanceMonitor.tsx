/**
 * Story 32.6 - Performance Monitoring Dashboard
 *
 * Collapsible overlay displaying FPS, memory usage, node/edge counts,
 * render metrics, and performance warnings.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Stats } from '@react-three/drei';
import { useMemoryManagement, formatMemorySize, getMemoryStatusColor } from '@/hooks/voxel/useMemoryManagement';

// ============================================================================
// Types
// ============================================================================

export interface PerformanceMonitorProps {
  /** Show the monitor */
  visible?: boolean;
  /** Initial collapsed state */
  initialCollapsed?: boolean;
  /** Position in viewport */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Number of nodes being rendered */
  nodeCount?: number;
  /** Number of edges being rendered */
  edgeCount?: number;
  /** Additional custom metrics */
  customMetrics?: Record<string, string | number>;
  /** Callback when performance warning is triggered */
  onWarning?: (message: string) => void;
  /** FPS threshold for warning */
  fpsWarningThreshold?: number;
}

interface FPSData {
  current: number;
  average: number;
  min: number;
  max: number;
  history: number[];
}

// ============================================================================
// Constants
// ============================================================================

const HISTORY_LENGTH = 60; // 1 second of history at 60fps
const FPS_UPDATE_INTERVAL = 100; // Update FPS display every 100ms

// ============================================================================
// FPS Hook
// ============================================================================

function useFPS(): FPSData {
  const [fpsData, setFpsData] = useState<FPSData>({
    current: 60,
    average: 60,
    min: 60,
    max: 60,
    history: [],
  });

  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(0);
  const lastUpdateRef = useRef(0);

  useFrame(() => {
    const now = performance.now();
    if (lastTimeRef.current === 0) lastTimeRef.current = now;
    if (lastUpdateRef.current === 0) lastUpdateRef.current = now;

    const delta = now - lastTimeRef.current;
    lastTimeRef.current = now;

    // Calculate FPS from frame time
    const fps = delta > 0 ? 1000 / delta : 60;
    frameTimesRef.current.push(fps);

    // Keep only last HISTORY_LENGTH frames
    if (frameTimesRef.current.length > HISTORY_LENGTH) {
      frameTimesRef.current.shift();
    }

    // Update display at lower frequency
    if (now - lastUpdateRef.current >= FPS_UPDATE_INTERVAL) {
      lastUpdateRef.current = now;
      const history = [...frameTimesRef.current];
      const current = history[history.length - 1] || 60;
      const average = history.reduce((a, b) => a + b, 0) / history.length;
      const min = Math.min(...history);
      const max = Math.max(...history);

      setFpsData({ current, average, min, max, history });
    }
  });

  return fpsData;
}

// ============================================================================
// Mini FPS Graph Component
// ============================================================================

const FPSGraph: React.FC<{ history: number[]; width: number; height: number }> = ({
  history,
  width,
  height,
}) => {
  const points = useMemo(() => {
    if (history.length < 2) return '';
    const maxFPS = 120;
    const step = width / (HISTORY_LENGTH - 1);

    return history
      .map((fps, i) => {
        const x = i * step;
        const y = height - (Math.min(fps, maxFPS) / maxFPS) * height;
        return `${x},${y}`;
      })
      .join(' ');
  }, [history, width, height]);

  const color = useMemo(() => {
    const avg = history.reduce((a, b) => a + b, 0) / history.length || 60;
    if (avg >= 55) return '#22c55e';
    if (avg >= 30) return '#f59e0b';
    return '#ef4444';
  }, [history]);

  return (
    <svg width={width} height={height} className="opacity-80">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Reference lines */}
      <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="#ffffff20" strokeWidth="1" />
      <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#ffffff10" strokeWidth="1" strokeDasharray="2,2" />
    </svg>
  );
};

// ============================================================================
// Metric Row Component
// ============================================================================

const MetricRow: React.FC<{
  label: string;
  value: string | number;
  unit?: string;
  warning?: boolean;
  critical?: boolean;
}> = ({ label, value, unit, warning, critical }) => {
  const color = critical ? 'text-red-400' : warning ? 'text-amber-400' : 'text-slate-300';

  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className={`font-mono text-xs ${color}`}>
        {value}
        {unit && <span className="text-slate-500 ml-1">{unit}</span>}
      </span>
    </div>
  );
};

// ============================================================================
// Section Header Component
// ============================================================================

const SectionHeader: React.FC<{ title: string; icon: string }> = ({ title, icon }) => (
  <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-white/10">
    <span className="text-xs">{icon}</span>
    <span className="text-xs font-medium text-slate-200">{title}</span>
  </div>
);

// ============================================================================
// Main Performance Monitor Component
// ============================================================================

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  visible = true,
  initialCollapsed = false,
  position = 'top-right',
  nodeCount = 0,
  edgeCount = 0,
  customMetrics = {},
  onWarning,
  fpsWarningThreshold = 30,
}) => {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [showDreiStats, setShowDreiStats] = useState(false);
  const fpsData = useFPS();
  const { gl } = useThree();
  const memory = useMemoryManagement({
    logging: false,
    onWarning: (stats) => onWarning?.(`GPU memory usage high: ${formatMemorySize(stats.gpuMemoryMB)}`),
    onCritical: (stats) => onWarning?.(`GPU memory critical: ${formatMemorySize(stats.gpuMemoryMB)}`),
  });

  // Check FPS warning
  useEffect(() => {
    if (fpsData.average < fpsWarningThreshold) {
      onWarning?.(`Low FPS detected: ${fpsData.average.toFixed(0)} fps`);
    }
  }, [fpsData.average, fpsWarningThreshold, onWarning]);

  // Position styles
  const positionStyles = useMemo(() => {
    switch (position) {
      case 'top-left':
        return { top: '16px', left: '16px' };
      case 'top-right':
        return { top: '16px', right: '16px' };
      case 'bottom-left':
        return { bottom: '16px', left: '16px' };
      case 'bottom-right':
        return { bottom: '16px', right: '16px' };
      default:
        return { top: '16px', right: '16px' };
    }
  }, [position]);

  // Get render info
  const renderInfo = useMemo(() => {
    const info = gl.info;
    return {
      drawCalls: info.render?.calls ?? 0,
      triangles: info.render?.triangles ?? 0,
      points: info.render?.points ?? 0,
      lines: info.render?.lines ?? 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, fpsData]); // Update with FPS to refresh

  // Toggle collapse
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  if (!visible) return null;

  return (
    <Html
      style={{
        ...positionStyles,
        position: 'fixed',
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
    >
      <div
        className={`
          bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl
          font-sans text-white select-none transition-all duration-200
          ${collapsed ? 'w-auto' : 'w-64'}
        `}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5 rounded-t-lg"
          onClick={toggleCollapsed}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor:
                  fpsData.average >= 55
                    ? '#22c55e'
                    : fpsData.average >= 30
                      ? '#f59e0b'
                      : '#ef4444',
              }}
            />
            <span className="text-sm font-medium">Performance</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{fpsData.current.toFixed(0)} fps</span>
            <span className="text-slate-500 text-xs">{collapsed ? '+' : '-'}</span>
          </div>
        </div>

        {/* Expanded Content */}
        {!collapsed && (
          <div className="px-3 pb-3 space-y-3">
            {/* FPS Section */}
            <div>
              <SectionHeader title="Frame Rate" icon="..." />
              <FPSGraph history={fpsData.history} width={230} height={40} />
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div className="text-center">
                  <div className="text-xs text-slate-500">Min</div>
                  <div className="font-mono text-xs">{fpsData.min.toFixed(0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500">Avg</div>
                  <div className="font-mono text-xs">{fpsData.average.toFixed(0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500">Max</div>
                  <div className="font-mono text-xs">{fpsData.max.toFixed(0)}</div>
                </div>
              </div>
            </div>

            {/* Memory Section */}
            <div>
              <SectionHeader title="Memory" icon="..." />
              <MetricRow
                label="GPU Memory"
                value={formatMemorySize(memory.stats.gpuMemoryMB)}
                warning={memory.status === 'warning'}
                critical={memory.status === 'critical'}
              />
              <MetricRow label="Geometries" value={memory.stats.geometries} />
              <MetricRow label="Textures" value={memory.stats.textures} />
              {memory.stats.heapUsedMB !== null && (
                <MetricRow
                  label="JS Heap"
                  value={formatMemorySize(memory.stats.heapUsedMB)}
                />
              )}
            </div>

            {/* Render Section */}
            <div>
              <SectionHeader title="Render" icon="..." />
              <MetricRow
                label="Draw Calls"
                value={renderInfo.drawCalls}
                warning={renderInfo.drawCalls > 200}
              />
              <MetricRow
                label="Triangles"
                value={renderInfo.triangles.toLocaleString()}
                warning={renderInfo.triangles > 500000}
              />
              <MetricRow label="Points" value={renderInfo.points.toLocaleString()} />
            </div>

            {/* Scene Section */}
            <div>
              <SectionHeader title="Scene" icon="..." />
              <MetricRow label="Nodes" value={nodeCount.toLocaleString()} />
              <MetricRow label="Edges" value={edgeCount.toLocaleString()} />
              <MetricRow label="Total Objects" value={memory.stats.objects} />
            </div>

            {/* Custom Metrics */}
            {Object.keys(customMetrics).length > 0 && (
              <div>
                <SectionHeader title="Custom" icon="..." />
                {Object.entries(customMetrics).map(([key, value]) => (
                  <MetricRow key={key} label={key} value={value} />
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => memory.requestGC()}
                className="flex-1 px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded transition-colors"
              >
                Request GC
              </button>
              <button
                onClick={() => memory.cleanupPools()}
                className="flex-1 px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded transition-colors"
              >
                Clean Pools
              </button>
              <button
                onClick={() => setShowDreiStats(!showDreiStats)}
                className={`px-2 py-1 text-xs rounded transition-colors ${showDreiStats ? 'bg-blue-500/30' : 'bg-white/5 hover:bg-white/10'
                  }`}
              >
                Stats
              </button>
            </div>

            {/* Status Indicator */}
            <div
              className="flex items-center justify-center gap-2 py-1.5 rounded text-xs"
              style={{ backgroundColor: getMemoryStatusColor(memory.status) + '20' }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: getMemoryStatusColor(memory.status) }}
              />
              <span style={{ color: getMemoryStatusColor(memory.status) }}>
                Memory: {memory.status.charAt(0).toUpperCase() + memory.status.slice(1)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* drei Stats panel (optional) */}
      {showDreiStats && (
        <div className="fixed top-0 left-0">
          <Stats showPanel={0} />
        </div>
      )}
    </Html>
  );
};

// ============================================================================
// Compact Performance Badge Component
// ============================================================================

export interface PerformanceBadgeProps {
  nodeCount?: number;
  onClick?: () => void;
}

export const PerformanceBadge: React.FC<PerformanceBadgeProps> = ({ nodeCount = 0, onClick }) => {
  const fpsData = useFPS();

  const color = useMemo(() => {
    if (fpsData.average >= 55) return '#22c55e';
    if (fpsData.average >= 30) return '#f59e0b';
    return '#ef4444';
  }, [fpsData.average]);

  return (
    <Html>
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-sm border border-white/10 rounded-full text-white text-sm hover:bg-slate-800/90 transition-colors"
      >
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-mono">{fpsData.current.toFixed(0)} fps</span>
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground">{nodeCount} nodes</span>
      </button>
    </Html>
  );
};

export default PerformanceMonitor;
