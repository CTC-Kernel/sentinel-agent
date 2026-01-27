/**
 * CategoryChart Component
 * Story 37-4: Vendor Concentration Dashboard
 *
 * Donut chart showing vendor distribution by category
 * with interactive legend and drill-down capabilities.
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  AlertTriangle,
  Building2,
  ChevronRight,
} from '../ui/Icons';
import type { CategoryConcentration } from '../../types/vendorConcentration';
import { formatPercentage, getHHILevel } from '../../types/vendorConcentration';
import { DONUT_COLORS, SEVERITY_COLORS } from '../../theme/chartTheme';

// ============================================================================
// Types
// ============================================================================

interface CategoryChartProps {
  categories: CategoryConcentration[];
  totalVendors: number;
  onCategoryClick?: (category: CategoryConcentration) => void;
}

interface ChartDataItem {
  name: string;
  value: number;
  percentage: number;
  category: string;
  hasSPOF: boolean;
  isCritical: boolean;
  vendorCount: number;
  hhi: number;
}

// ============================================================================
// Constants
// ============================================================================

// Extended harmonized chart colors from design system
const CHART_COLORS = [
  ...DONUT_COLORS.category,
  SEVERITY_COLORS.high,      // Amber
  SEVERITY_COLORS.critical,  // Red
  SEVERITY_COLORS.medium,    // Yellow-gold
  SEVERITY_COLORS.low,       // Teal
];

const RADIAN = Math.PI / 180;

// ============================================================================
// Custom Tooltip
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: ChartDataItem;
  }>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  const { t } = useTranslation();

  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="glass-panel p-3 rounded-xl shadow-apple-md min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium text-slate-900 dark:text-white">
          {data.name}
        </span>
        {data.hasSPOF && (
          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 dark:bg-red-900/30 text-red-600">
            SPOF
          </span>
        )}
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">{t('vendorConcentration.chart.vendors')}</span>
          <span className="font-medium text-slate-900 dark:text-white">{data.vendorCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">{t('vendorConcentration.chart.share')}</span>
          <span className="font-medium text-slate-900 dark:text-white">{formatPercentage(data.percentage)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">HHI</span>
          <span className={`font-medium ${data.hhi > 2500 ? 'text-red-600' : data.hhi > 1500 ? 'text-yellow-600' : 'text-green-600'
            }`}>
            {Math.round(data.hhi)}
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Custom Label
// ============================================================================

interface CustomLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}

const CustomLabel: React.FC<CustomLabelProps> = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}) => {
  if (percent < 0.08) return null; // Don't show labels for small segments

  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-medium"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ============================================================================
// Category Legend Item
// ============================================================================

interface LegendItemProps {
  category: CategoryConcentration;
  color: string;
  onClick?: () => void;
}

const LegendItem: React.FC<LegendItemProps> = ({ category, color, onClick }) => {
  const { t } = useTranslation();
  const hhiLevel = getHHILevel(category.herfindahlIndex);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
    >
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {category.categoryLabel}
          </span>
          {category.hasSPOF && (
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500">
            {category.vendorCount} {t('vendorConcentration.chart.vendor', { count: category.vendorCount })}
          </span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className={`text-xs ${hhiLevel === 'high' ? 'text-red-500' : hhiLevel === 'moderate' ? 'text-yellow-500' : 'text-green-500'
            }`}>
            {formatPercentage(category.percentage)}
          </span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
};

// ============================================================================
// Vendor List (Drill-down)
// ============================================================================

interface VendorListProps {
  category: CategoryConcentration;
  onBack: () => void;
}

const VendorList: React.FC<VendorListProps> = ({ category, onBack }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
        {t('common.back')}
      </button>

      <div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">
          {category.categoryLabel}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {category.vendorCount} {t('vendorConcentration.chart.vendor', { count: category.vendorCount })} • HHI: {Math.round(category.herfindahlIndex)}
        </p>
      </div>

      {category.hasSPOF && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 dark:border-red-800">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-400">
            {t('vendorConcentration.chart.spofWarning')}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {category.vendors.map((vendor) => (
          <div
            key={vendor.supplierId}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700">
                <Building2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {vendor.name}
                </p>
                <p className="text-xs text-slate-500">
                  {vendor.servicesCount} {t('vendorConcentration.chart.services')}
                  {vendor.criticalServicesCount > 0 && (
                    <span className="text-red-500 ml-1">
                      ({vendor.criticalServicesCount} {t('vendorConcentration.chart.critical')})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className={`px-2 py-1 rounded text-xs font-medium ${vendor.riskLevel === 'Critical'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : vendor.riskLevel === 'High'
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                  : vendor.riskLevel === 'Medium'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                }`}>
                {vendor.riskLevel}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const CategoryChart: React.FC<CategoryChartProps> = ({
  categories,
  totalVendors,
  onCategoryClick,
}) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<CategoryConcentration | null>(null);

  // Prepare chart data
  const chartData = useMemo<ChartDataItem[]>(() => {
    return categories.map((cat) => ({
      name: cat.categoryLabel,
      value: cat.vendorCount,
      percentage: cat.percentage,
      category: cat.category,
      hasSPOF: cat.hasSPOF,
      isCritical: cat.isCritical,
      vendorCount: cat.vendorCount,
      hhi: cat.herfindahlIndex,
    }));
  }, [categories]);

  // Handle category selection
  const handleCategoryClick = (category: CategoryConcentration) => {
    setSelectedCategory(category);
    onCategoryClick?.(category);
  };

  // Show vendor list if a category is selected
  if (selectedCategory) {
    return (
      <VendorList
        category={selectedCategory}
        onBack={() => setSelectedCategory(null)}
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Chart */}
      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              labelLine={false}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label={CustomLabel as any}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${entry.category}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  stroke={entry.hasSPOF ? SEVERITY_COLORS.critical : 'transparent'}
                  strokeWidth={entry.hasSPOF ? 3 : 0}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    const cat = categories.find(c => c.category === entry.category);
                    if (cat) handleCategoryClick(cat);
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="text-center -mt-[180px] mb-[120px]">
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {totalVendors}
          </p>
          <p className="text-sm text-slate-500">
            {t('vendorConcentration.chart.totalVendors')}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="lg:w-64 space-y-1">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          {t('vendorConcentration.chart.categories')}
        </p>
        {categories.map((category, index) => (
          <LegendItem
            key={category.category}
            category={category}
            color={CHART_COLORS[index % CHART_COLORS.length]}
            onClick={() => handleCategoryClick(category)}
          />
        ))}
      </div>
    </div>
  );
};

export default CategoryChart;
