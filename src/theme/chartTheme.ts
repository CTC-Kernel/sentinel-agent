/**
 * HARMONIZED CHART PALETTE
 * Matches design-tokens.css with consistent hues and reduced saturation
 *
 * Hue Reference:
 * - Primary: 221° (Blue)
 * - Success: 152° (Teal-green)
 * - Warning: 38° (Amber)
 * - Error/Danger: 4° (True red)
 * - Info: 201° (Cyan-blue)
 * - Purple: 270°
 */
export const SENTINEL_PALETTE = {
    // Semantic colors (harmonized with design tokens)
    primary: '#4a8ce7',   // hsl(221 68% 60%) - Softened blue
    secondary: '#9b7ed7', // hsl(270 50% 67%) - Softened purple
    success: '#52a67e',   // hsl(152 48% 42%) - Softened teal
    warning: '#d69e5e',   // hsl(38 58% 52%) - Softened amber
    danger: '#d66161',    // hsl(4 55% 54%) - Softened red
    info: '#4ba0c7',      // hsl(201 55% 50%) - Softened cyan
    tertiary: '#7fa1b3',  // hsl(200 25% 60%) - Softened slate-blue

    // Data Series Colors (for multi-series charts)
    series1: '#4a7fc7',   // Primary blue
    series2: '#2d9d6a',   // Teal-green
    series3: '#9b6dd7',   // Purple
    series4: '#2a8ab8',   // Cyan-blue
    series5: '#c87f1a',   // Amber
    series6: '#d64545',   // Red
    series7: '#6b8fa3',   // Slate-blue
    series8: '#7c5cbd',   // Violet
};

export const SEVERITY_COLORS = {
    critical: '#d66161',  // Soft red
    high: '#d69e5e',      // Soft amber
    medium: '#d4b45d',    // Soft gold
    low: '#52a67e',       // Soft teal
    info: '#4ba0c7',      // Soft cyan
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

// Helper for Recharts Gradient Definitions (harmonized)
export const ChartGradients = {
    primary: { id: 'gradientPrimary', from: '#4a7fc7', to: '#93b8fd' },
    blue: { id: 'gradientBlue', from: '#4a7fc7', to: '#93b8fd' },
    success: { id: 'gradientSuccess', from: '#2d9d6a', to: '#6fcca3' },
    teal: { id: 'gradientTeal', from: '#2d9d6a', to: '#6fcca3' },
    purple: { id: 'gradientPurple', from: '#9b6dd7', to: '#c9aee8' },
    violet: { id: 'gradientViolet', from: '#7c5cbd', to: '#b49dda' },
    warning: { id: 'gradientWarning', from: '#c87f1a', to: '#e8b86d' },
    amber: { id: 'gradientAmber', from: '#c87f1a', to: '#e8b86d' },
    danger: { id: 'gradientDanger', from: '#d64545', to: '#eb9090' },
    info: { id: 'gradientInfo', from: '#2a8ab8', to: '#7ac0de' },
    cyan: { id: 'gradientCyan', from: '#2a8ab8', to: '#7ac0de' },
};

// Score gauge gradient colors (harmonized)
export const SCORE_GRADIENT_COLORS = {
    critical: { start: '#eb9090', end: '#d64545' }, // Light red to red
    warning: { start: '#e8b86d', end: '#c87f1a' },  // Light amber to amber
    good: { start: '#6fcca3', end: '#2d9d6a' },     // Light teal to teal
} as const;

// Finding type colors for audit charts (harmonized)
export const FINDING_COLORS = {
    majeure: '#d64545',      // Red (hsl 4 68% 50%)
    mineure: '#c87f1a',      // Amber (hsl 38 72% 48%)
    observation: '#4a7fc7',  // Blue (hsl 221 55% 54%)
    opportunite: '#2d9d6a',  // Teal (hsl 152 62% 38%)
} as const;

// Audit status colors
export const AUDIT_STATUS_COLORS = {
    planifie: '#6b8fa3',     // Slate-blue (neutral)
    en_cours: '#4a7fc7',     // Blue (primary)
    termine: '#2d9d6a',      // Teal (success)
    annule: '#d64545',       // Red (error)
} as const;

// Chart axis and grid colors
export const CHART_AXIS_COLORS = {
    grid: '#94a3b8',         // Slate-400
    tick: '#475569',         // Slate-600 (better contrast)
    gridOpacity: 0.2,        // Slightly increased for visibility
    gridDark: '#475569',     // Slate-600 for dark mode
} as const;

// Donut/Pie chart color sequences
export const DONUT_COLORS = {
    // For status distribution
    status: ['#2d9d6a', '#4a7fc7', '#c87f1a', '#d64545', '#6b8fa3'],
    // For category distribution
    category: ['#4a7fc7', '#2d9d6a', '#9b6dd7', '#2a8ab8', '#c87f1a', '#7c5cbd'],
    // For severity distribution
    severity: ['#d64545', '#c87f1a', '#d4a820', '#2d9d6a'],
} as const;
