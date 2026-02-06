/**
 * HARMONIZED CHART PALETTE
 * AUDIT FIX: All colors now use CSS custom properties for dark/light mode support
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
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--nav-repository))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  danger: 'hsl(var(--error))',
  info: 'hsl(var(--info))',
  tertiary: 'hsl(var(--nav-support))',

  // Data Series Colors - USING CSS VARIABLES for dark/light support
  series1: 'hsl(var(--chart-series-1))',
  series2: 'hsl(var(--chart-series-2))',
  series3: 'hsl(var(--chart-series-3))',
  series4: 'hsl(var(--chart-series-4))',
  series5: 'hsl(var(--chart-series-5))',
  series6: 'hsl(var(--chart-series-6))',
  series7: 'hsl(var(--chart-series-7))',
  series8: 'hsl(var(--chart-series-8))',
};

export const SEVERITY_COLORS = {
  critical: 'hsl(var(--chart-critical))',
  high: 'hsl(var(--chart-high))',
  medium: 'hsl(var(--chart-medium))',
  low: 'hsl(var(--chart-low))',
  info: 'hsl(var(--chart-info))',
  // Uppercase aliases for compatibility
  Critical: 'hsl(var(--chart-critical))',
  High: 'hsl(var(--chart-high))',
  Medium: 'hsl(var(--chart-medium))',
  Low: 'hsl(var(--chart-low))',
  Info: 'hsl(var(--chart-info))',
};

export const CHART_STYLES = {
  // Grid - Uses CSS variables for dark/light mode
  grid: {
    strokeDasharray: '3 3',
    stroke: 'hsl(var(--chart-grid))',
    opacity: 'var(--chart-grid-opacity)',
    vertical: false
  },
  // Axis - Uses CSS variables for dark/light mode
  axis: {
    stroke: 'hsl(var(--chart-axis-tick))',
    fill: 'hsl(var(--chart-axis-tick))',
    fontSize: 12,
    tickLine: false,
    axisLine: false,
    tickMargin: 8
  },
  // Tick style for XAxis/YAxis
  tick: {
    fontSize: 11,
    fill: 'hsl(var(--chart-axis-tick))',
  },
  // Specific X-Axis Style
  xAxis: {
    padding: { left: 10, right: 10 }
  },
  // Tooltip - Uses CSS variables for dark/light mode
  tooltip: {
    contentStyle: {
      backgroundColor: 'hsl(var(--chart-tooltip-bg))',
      borderRadius: '12px',
      border: '1px solid hsl(var(--chart-tooltip-border))',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      backdropFilter: 'blur(8px)',
      padding: '8px 12px',
    },
    itemStyle: {
      fontSize: '13px',
      fontWeight: 500,
      color: 'hsl(var(--chart-tooltip-text))',
    },
    labelStyle: {
      color: 'hsl(var(--chart-tooltip-text))',
      fontWeight: 600,
      marginBottom: '4px',
      fontSize: '12px',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em'
    }
  },
  // Reference Lines (Thresholds)
  referenceLine: {
    stroke: 'hsl(var(--chart-critical))',
    strokeDasharray: '3 3',
    strokeWidth: 2,
    opacity: 0.7
  },
  // Cursor/Hover Indicator
  cursor: 'hsl(var(--chart-text-muted))',
  // Active dot for line/area charts
  activeDot: {
    r: 6,
    strokeWidth: 2,
    stroke: 'hsl(var(--chart-active-stroke))',
  }
};

// Helper for Recharts Gradient Definitions (harmonized)
export const ChartGradients = {
 primary: { id: 'gradientPrimary', from: 'hsl(var(--primary))', to: 'hsl(var(--primary) / 0.6)' },
 blue: { id: 'gradientBlue', from: 'hsl(var(--primary))', to: 'hsl(var(--primary) / 0.6)' },
 success: { id: 'gradientSuccess', from: 'hsl(var(--success))', to: 'hsl(var(--success) / 0.6)' },
 teal: { id: 'gradientTeal', from: 'hsl(var(--success))', to: 'hsl(var(--success) / 0.6)' },
 purple: { id: 'gradientPurple', from: 'hsl(var(--nav-repository))', to: 'hsl(var(--nav-repository) / 0.6)' },
 violet: { id: 'gradientViolet', from: 'hsl(var(--nav-repository))', to: 'hsl(var(--nav-repository) / 0.6)' },
 warning: { id: 'gradientWarning', from: 'hsl(var(--warning))', to: 'hsl(var(--warning) / 0.6)' },
 amber: { id: 'gradientAmber', from: 'hsl(var(--warning))', to: 'hsl(var(--warning) / 0.6)' },
 danger: { id: 'gradientDanger', from: 'hsl(var(--error))', to: 'hsl(var(--error) / 0.6)' },
 info: { id: 'gradientInfo', from: 'hsl(var(--info))', to: 'hsl(var(--info) / 0.6)' },
 cyan: { id: 'gradientCyan', from: 'hsl(var(--info))', to: 'hsl(var(--info) / 0.6)' },
};

// Score gauge gradient colors - USING CSS VARIABLES
export const SCORE_GRADIENT_COLORS = {
  critical: {
    start: 'hsl(var(--chart-critical) / 0.6)',
    end: 'hsl(var(--chart-critical))'
  },
  warning: {
    start: 'hsl(var(--chart-high) / 0.6)',
    end: 'hsl(var(--chart-high))'
  },
  good: {
    start: 'hsl(var(--chart-low) / 0.6)',
    end: 'hsl(var(--chart-low))'
  },
} as const;

// Finding type colors for audit charts - USING CSS VARIABLES
export const FINDING_COLORS = {
  majeure: 'hsl(var(--chart-critical))',
  mineure: 'hsl(var(--chart-high))',
  observation: 'hsl(var(--chart-series-1))',
  opportunite: 'hsl(var(--chart-low))',
} as const;

// Audit status colors - USING CSS VARIABLES
export const AUDIT_STATUS_COLORS = {
  planifie: 'hsl(var(--chart-series-7))',
  en_cours: 'hsl(var(--chart-series-1))',
  termine: 'hsl(var(--chart-low))',
  annule: 'hsl(var(--chart-critical))',
} as const;

// Chart axis and grid colors - USING CSS VARIABLES
export const CHART_AXIS_COLORS = {
  grid: 'hsl(var(--chart-grid))',
  tick: 'hsl(var(--chart-axis-tick))',
  gridOpacity: 'var(--chart-grid-opacity)',
  text: 'hsl(var(--chart-text))',
  textMuted: 'hsl(var(--chart-text-muted))',
} as const;

// Donut/Pie chart color sequences - USING CSS VARIABLES
export const DONUT_COLORS = {
  // For status distribution
  status: [
    'hsl(var(--chart-low))',
    'hsl(var(--chart-series-1))',
    'hsl(var(--chart-high))',
    'hsl(var(--chart-critical))',
    'hsl(var(--chart-series-7))'
  ],
  // For category distribution
  category: [
    'hsl(var(--chart-series-1))',
    'hsl(var(--chart-series-2))',
    'hsl(var(--chart-series-3))',
    'hsl(var(--chart-series-4))',
    'hsl(var(--chart-series-5))',
    'hsl(var(--chart-series-8))'
  ],
  // For severity distribution
  severity: [
    'hsl(var(--chart-critical))',
    'hsl(var(--chart-high))',
    'hsl(var(--chart-medium))',
    'hsl(var(--chart-low))'
  ],
} as const;
