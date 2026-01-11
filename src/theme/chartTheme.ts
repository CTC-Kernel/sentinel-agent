export const SENTINEL_PALETTE = {
    // Vibrant Cyber Palette (Gradients can be derived from these)
    primary: '#6366f1',   // Indigo 500
    secondary: '#8b5cf6', // Violet 500
    success: '#10b981',   // Emerald 500
    warning: '#f59e0b',   // Amber 500
    danger: '#ef4444',    // Red 500
    info: '#06b6d4',      // Cyan 500
    tertiary: '#0ea5e9',  // Sky 500 (Adding for charts)

    // Abstract/Data Series Colors
    series1: '#8b5cf6', // Violet
    series2: '#3b82f6', // Blue
    series3: '#06b6d4', // Cyan
    series4: '#10b981', // Emerald
    series5: '#f59e0b', // Amber
    series6: '#ec4899', // Pink
};

export const SEVERITY_COLORS = {
    critical: '#ef4444', // Red-500
    high: '#f97316',     // Orange-500
    medium: '#eab308',   // Yellow-500
    low: '#22c55e',      // Green-500
    info: '#3b82f6',     // Blue-500
};

export const CHART_STYLES = {
    // Grid
    grid: {
        strokeDasharray: '3 3',
        stroke: 'hsl(var(--border))',
        opacity: 0.3,
        vertical: false
    },
    // Axis
    // Base Axis Style (Common)
    axis: {
        stroke: 'hsl(var(--muted-foreground))',
        fontSize: 12,
        tickLine: false,
        axisLine: false,
        tickMargin: 8
    },
    // Specific X-Axis Style
    xAxis: {
        padding: { left: 10, right: 10 }
    },
    // Tooltip (Recharts internal wrapper style)
    tooltip: {
        contentStyle: {
            backgroundColor: 'rgba(255, 255, 255, 0.8)', // Fallback / Light
            borderRadius: '12px',
            border: '1px solid hsl(var(--border))',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            backdropFilter: 'blur(8px)',
            padding: '8px 12px',
        },
        itemStyle: {
            fontSize: '13px',
            fontWeight: 500,
        },
        labelStyle: {
            color: 'hsl(var(--foreground))',
            fontWeight: 600,
            marginBottom: '4px',
            fontSize: '12px',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.05em'
        }
    },
    // Reference Lines (Thresholds)
    referenceLine: {
        stroke: 'hsl(var(--destructive))',
        strokeDasharray: '3 3',
        strokeWidth: 2,
        opacity: 0.7
    },
    // Cursor/Hover Indicator
    cursor: 'hsl(var(--muted-foreground))' // Simple string for stroke/fill reference
};

// Helper for Recharts Gradient Definitions (to be used inside <defs>)
export const ChartGradients = {
    violet: { id: 'gradientViolet', from: '#8b5cf6', to: '#c4b5fd' },
    blue: { id: 'gradientBlue', from: '#3b82f6', to: '#93c5fd' },
    emerald: { id: 'gradientEmerald', from: '#10b981', to: '#6ee7b7' },
    amber: { id: 'gradientAmber', from: '#f59e0b', to: '#fcd34d' },
    rose: { id: 'gradientRose', from: '#f43f5e', to: '#fda4af' },
};

// Score gauge gradient colors (for circular progress indicators)
export const SCORE_GRADIENT_COLORS = {
    critical: { start: '#fca5a5', end: '#ef4444' }, // red-300 to red-500
    warning: { start: '#fdba74', end: '#f97316' },  // orange-300 to orange-500
    good: { start: '#86efac', end: '#22c55e' },     // green-300 to green-500
} as const;

// Finding type colors for audit charts
export const FINDING_COLORS = {
    majeure: '#EF4444',      // Red-500
    mineure: '#F59E0B',      // Amber-500
    observation: '#3B82F6',  // Blue-500
    opportunite: '#10B981',  // Emerald-500
} as const;

// Chart axis and grid colors
export const CHART_AXIS_COLORS = {
    grid: '#94a3b8',         // Slate-400
    tick: '#94a3b8',         // Slate-400
    gridOpacity: 0.1,
} as const;
