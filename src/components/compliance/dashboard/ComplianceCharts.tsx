import React, { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { Control } from '../../../types';
import { PieChart as PieChartIcon, BarChart3 as BarChartIcon, Target } from '../../ui/Icons';
import {
 PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
 RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, RadialBarChart, RadialBar, Sector
} from 'recharts';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { slideUpVariants } from '../../ui/animationVariants';
import { SENTINEL_PALETTE, SEVERITY_COLORS } from '../../../theme/chartTheme';
import { PARTIAL_CONTROL_WEIGHT } from '../../../constants/complianceConfig';

interface ComplianceChartsProps {
 controls: Control[];
 currentFramework: string;
}

// Fixed activeShape for interactive pie using Sector instead of nested Pie
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderActiveShape = (props: any) => {
 const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;

 return (
 <g>
 <defs>
 <filter id="compliancePieGlow" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
  <feMerge>
  <feMergeNode in="coloredBlur" />
  <feMergeNode in="SourceGraphic" />
  </feMerge>
 </filter>
 </defs>
 <text x={cx} y={cy - 8} textAnchor="middle" className="fill-foreground font-black text-base">
 {payload.name}
 </text>
 <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground text-sm font-mono">
 {payload.value} ({(percent * 100).toFixed(0)}%)
 </text>
 <Sector
 cx={cx}
 cy={cy}
 innerRadius={innerRadius}
 outerRadius={outerRadius + 6}
 startAngle={startAngle}
 endAngle={endAngle}
 fill={fill}
 style={{ filter: 'url(#compliancePieGlow)' }}
 />
 <Sector
 cx={cx}
 cy={cy}
 startAngle={startAngle}
 endAngle={endAngle}
 innerRadius={innerRadius}
 outerRadius={outerRadius}
 fill={fill}
 />
 </g>
 );
};

import { useTranslation } from 'react-i18next';
import { CONTROL_STATUS } from '../../../constants/complianceConfig';

export const ComplianceCharts: React.FC<ComplianceChartsProps> = ({
 controls,
 currentFramework
}) => {
 const { t } = useTranslation();
 const uid = useId();
 const complianceGlowId = `complianceGlow-${uid}`;
 const [activeStatusIndex, setActiveStatusIndex] = useState<number | null>(null);

 // Chart Theme Configuration
 const chartTheme = {
 grid: 'hsl(var(--border) / 0.2)',
 text: 'hsl(var(--muted-foreground) / 0.7)',
 cursor: 'hsl(var(--muted-foreground) / 0.1)',
 colors: {
 implemented: SENTINEL_PALETTE.success,
 partial: SENTINEL_PALETTE.warning,
 notStarted: SEVERITY_COLORS.critical,
 notApplicable: 'hsl(var(--muted-foreground) / 0.55)',
 primary: SENTINEL_PALETTE.primary,
 primaryDark: SENTINEL_PALETTE.secondary
 }
 };

 const implementedControls = controls.filter(c => c.status === CONTROL_STATUS.IMPLEMENTED).length;
 const partialControls = controls.filter(c => c.status === CONTROL_STATUS.PARTIAL).length;
 const notImplementedControls = controls.filter(c => c.status === CONTROL_STATUS.NOT_STARTED).length;
 const notApplicableControls = controls.filter(c => c.status === CONTROL_STATUS.NOT_APPLICABLE).length;

 const actionableControls = controls.filter(c => c.status !== CONTROL_STATUS.NOT_APPLICABLE && c.status !== CONTROL_STATUS.EXCLUDED).length;
 const overallScore = actionableControls > 0 ? Math.round(((implementedControls + (partialControls * PARTIAL_CONTROL_WEIGHT)) / actionableControls) * 100) : 100;

 // Status distribution
 const statusData = [
 { name: t('compliance.dashboard.implemented'), value: implementedControls, color: chartTheme.colors.implemented },
 { name: t('compliance.dashboard.partial'), value: partialControls, color: chartTheme.colors.partial },
 { name: t('compliance.dashboard.notStarted'), value: notImplementedControls, color: chartTheme.colors.notStarted },
 { name: t('compliance.dashboard.notApplicable'), value: notApplicableControls, color: chartTheme.colors.notApplicable }
 ].filter(d => d.value > 0);

 // Group by Domain
 const domainData = controls.reduce((acc, control) => {
 if (!control.code) return acc;
 const parts = control.code.split('.');
 const domain = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0];

 if (!acc[domain]) {
 acc[domain] = { total: 0, implemented: 0, inProgress: 0 };
 }
 acc[domain].total++;
 if (control.status === CONTROL_STATUS.IMPLEMENTED) acc[domain].implemented++;
 if (control.status === CONTROL_STATUS.PARTIAL) acc[domain].inProgress++;
 return acc;
 }, {} as Record<string, { total: number; implemented: number; inProgress: number }>);

 const domainChartData = Object.entries(domainData).map(([domain, data]) => ({
 domain,
 rate: data.total > 0 ? Math.round(((data.implemented + (data.inProgress * PARTIAL_CONTROL_WEIGHT)) / data.total) * 100) : 0,
 total: data.total,
 implemented: data.implemented
 }));

 const radarData = Object.entries(domainData)
 .map(([domain, data]) => ({
 domain: domain,
 score: data.total > 0 ? ((data.implemented + (data.inProgress * PARTIAL_CONTROL_WEIGHT)) / data.total * 100) : 0
 }))
 .slice(0, 8);

 // Gauge data
 const scoreGaugeData = [{ name: t('compliance.dashboard.scoreTitle', { framework: '' }).trim(), value: overallScore, fill: 'url(#complianceScoreGradient)' }];

 const barGradientPrimaryId = React.useId();
 const barGradientSuccessId = React.useId();
 const radarGradientId = React.useId();

 return (
 <div className="space-y-6">
 {/* SVG Defs */}
 <svg width="0" height="0" className="absolute">
 <defs>
  <filter id={complianceGlowId} x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
  <feMerge>
  <feMergeNode in="coloredBlur" />
  <feMergeNode in="SourceGraphic" />
  </feMerge>
  </filter>
  <linearGradient id="complianceScoreGradient" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stopColor={overallScore >= 75 ? SENTINEL_PALETTE.success : overallScore >= 50 ? SENTINEL_PALETTE.warning : SEVERITY_COLORS.critical} />
  <stop offset="100%" stopColor={overallScore >= 75 ? SENTINEL_PALETTE.success : overallScore >= 50 ? SENTINEL_PALETTE.warning : SEVERITY_COLORS.critical} />
  </linearGradient>
  <linearGradient id={barGradientPrimaryId} x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stopColor={chartTheme.colors.primary} stopOpacity={1} />
  <stop offset="100%" stopColor={chartTheme.colors.primaryDark} stopOpacity={0.8} />
  </linearGradient>
  <linearGradient id={barGradientSuccessId} x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stopColor={SENTINEL_PALETTE.success} stopOpacity={1} />
  <stop offset="100%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.8} />
  </linearGradient>
  <linearGradient id={radarGradientId} x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stopColor={chartTheme.colors.primary} stopOpacity={0.6} />
  <stop offset="100%" stopColor={chartTheme.colors.primaryDark} stopOpacity={0.1} />
  </linearGradient>
 </defs>
 </svg>

 {/* Overall Score Hero Gauge */}
 <motion.div
 variants={slideUpVariants}
 initial="hidden"
 animate="visible"
 className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
 >
 <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
 <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
  <div className="relative">
  <div className="h-[140px] w-[140px]">
  <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
  <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%" barSize={14} data={scoreGaugeData} startAngle={180} endAngle={0}>
   <RadialBar background={{ fill: 'hsl(var(--muted) / 0.3)' }} dataKey="value" cornerRadius={12} style={{ filter: `url(#${complianceGlowId})` }} />
  </RadialBarChart>
  </ResponsiveContainer>
  </div>
  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/4 text-center">
  <div className={`text-4xl font-black bg-gradient-to-r ${overallScore >= 75 ? 'from-emerald-600 to-emerald-400' : overallScore >= 50 ? 'from-amber-600 to-amber-400' : 'from-red-600 to-red-400'} bg-clip-text text-transparent`}>
  {overallScore}%
  </div>
  </div>
  </div>
  <div className="flex-1 text-center sm:text-left">
  <h3 className="text-lg font-bold text-foreground mb-2 uppercase tracking-wide">
  {t('compliance.dashboard.scoreTitle', { framework: currentFramework })}
  </h3>
  <p className="text-sm text-muted-foreground max-w-md">
  {t('compliance.dashboard.statsSummary', {
  defaultValue: '{{count}} contrôles implémentés sur {{total}} au total.',
  count: implementedControls,
  total: controls.length
  })}
  {overallScore >= 75 ? ` ${t('compliance.dashboard.excellentLevel')}` :
  overallScore >= 50 ? ` ${t('compliance.dashboard.acceptableLevel')}` :
   ` ${t('compliance.dashboard.priorityActionsRequired')}`}
  </p>
  </div>
 </div>
 </motion.div>

 {/* Charts Grid */}
 <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
 {/* Status Distribution Interactive Pie */}
 <motion.div variants={slideUpVariants} initial="hidden" animate="visible" className="glass-premium p-6 rounded-3xl relative overflow-hidden group hover:shadow-apple-lg transition-all duration-300">
  {/* Tech Corners */}
  <svg className="absolute top-5 left-5 w-3 h-3 text-muted-foreground/30" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute top-5 right-5 w-3 h-3 text-muted-foreground/30 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute bottom-5 left-5 w-3 h-3 text-muted-foreground/30 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute bottom-5 right-5 w-3 h-3 text-muted-foreground/30 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-3xl" />
  <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider relative z-10 flex items-center gap-2">
  <div className="p-2 bg-primary/10 rounded-3xl">
  <PieChartIcon className="w-4 h-4 text-primary" />
  </div>
  {t('compliance.dashboard.distributionTitle')}
  </h4>
  <div className="h-[280px] w-full relative z-10">
  <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
  <PieChart>
  <defs>
   {statusData.map((entry, index) => (
   <linearGradient key={`grad-${index || 'unknown'}`} id={`pieStatusGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
   <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
   <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
   </linearGradient>
   ))}
  </defs>
  <Pie
   data={statusData}
   cx="50%"
   cy="50%"
   innerRadius="55%"
   outerRadius="75%"
   paddingAngle={4}
   dataKey="value"
   stroke="none"
   cornerRadius={6}
   activeIndex={activeStatusIndex !== null ? activeStatusIndex : undefined}
   activeShape={renderActiveShape}
   onMouseEnter={(_, index) => setActiveStatusIndex(index)}
   onMouseLeave={() => setActiveStatusIndex(null)}
  >
   {statusData.map((_, index) => (
   <Cell key={`cell-${index || 'unknown'}`} fill={`url(#pieStatusGradient-${index})`} className="cursor-pointer drop-shadow-sm" />
   ))}
  </Pie>
  <Tooltip content={<ChartTooltip />} cursor={false} />
  <Legend
   verticalAlign="bottom"
   height={36}
   iconType="circle"
   iconSize={10}
   formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1 uppercase tracking-wide">{value}</span>}
  />
  </PieChart>
  </ResponsiveContainer>
  </div>
 </motion.div>

 {/* Domain Progress Bar Chart */}
 <motion.div variants={slideUpVariants} initial="hidden" animate="visible" className="glass-premium p-6 rounded-3xl relative overflow-hidden group hover:shadow-apple-lg transition-all duration-300">
  <svg className="absolute top-5 left-5 w-3 h-3 text-muted-foreground/30" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute top-5 right-5 w-3 h-3 text-muted-foreground/30 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute bottom-5 left-5 w-3 h-3 text-muted-foreground/30 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute bottom-5 right-5 w-3 h-3 text-muted-foreground/30 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-3xl" />
  <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider relative z-10 flex items-center gap-2">
  <div className="p-2 bg-violet-500/10 rounded-3xl">
  <BarChartIcon className="w-4 h-4 text-violet-500" />
  </div>
  {t('compliance.dashboard.domainConformityTitle')}
  </h4>
  <div className="h-[280px] w-full relative z-10">
  <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
  <BarChart data={domainChartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
  <XAxis
   dataKey="domain"
   stroke={chartTheme.text}
   fontSize={10}
   fontWeight={600}
   tickLine={false}
   axisLine={false}
   dy={10}
  />
  <YAxis
   stroke={chartTheme.text}
   fontSize={11}
   tickLine={false}
   axisLine={false}
   tickFormatter={(v) => `${v}%`}
  />
  <Tooltip content={<ChartTooltip />} cursor={{ fill: chartTheme.cursor, radius: 4 }} />
  <Bar dataKey="rate" name="Taux %" fill={chartTheme.colors.primary} radius={[8, 8, 0, 0]} barSize={24} animationDuration={1200}>
   {domainChartData.map((entry, index) => (
   <Cell
   key={`cell-${index || 'unknown'}`}
   fill={entry.rate >= 75 ? `url(#${barGradientSuccessId})` : entry.rate >= 50 ? chartTheme.colors.partial : `url(#${barGradientPrimaryId})`}
   style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
   />
   ))}
  </Bar>
  </BarChart>
  </ResponsiveContainer>
  </div>
 </motion.div>

 {/* Radar Chart */}
 <motion.div variants={slideUpVariants} initial="hidden" animate="visible" className="glass-premium p-6 rounded-3xl lg:col-span-2 xl:col-span-1 relative overflow-hidden group hover:shadow-apple-lg transition-all duration-300">
  <svg className="absolute top-5 left-5 w-3 h-3 text-muted-foreground/30" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute top-5 right-5 w-3 h-3 text-muted-foreground/30 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute bottom-5 left-5 w-3 h-3 text-muted-foreground/30 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute bottom-5 right-5 w-3 h-3 text-muted-foreground/30 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-3xl" />
  <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider relative z-10 flex items-center gap-2">
  <div className="p-2 bg-emerald-500/10 rounded-3xl">
  <Target className="w-4 h-4 text-emerald-500" />
  </div>
  {t('compliance.dashboard.radarTitle')}
  </h4>
  <div className="h-[280px] w-full relative z-10">
  <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
  <PolarGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
  <PolarAngleAxis dataKey="domain" tick={{ fill: chartTheme.text, fontSize: 10, fontWeight: 600 }} />
  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: chartTheme.text, fontSize: 9 }} axisLine={false} />
  <Radar
   name="Conformité %"
   dataKey="score"
   stroke={chartTheme.colors.primary}
   strokeWidth={3}
   fill={`url(#${radarGradientId})`}
   fillOpacity={1}
   isAnimationActive={true}
   style={{ filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.5))' }}
  />
  <Tooltip content={<ChartTooltip />} />
  <Legend iconType="circle" iconSize={10} formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1 uppercase tracking-wide">{value}</span>} />
  </RadarChart>
  </ResponsiveContainer>
  </div>
 </motion.div>
 </div>
 </div>
 );
};
