import React, { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar, Sector } from 'recharts';
import { PieChart as PieChartIcon, BarChart3 as BarChartIcon, TrendingUp, AlertTriangle } from '../../ui/Icons';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { EmptyChartState } from '../../ui/EmptyChartState';
import { slideUpVariants } from '../../ui/animationVariants';
import { FINDING_COLORS, SENTINEL_PALETTE, SEVERITY_COLORS } from '../../../theme/chartTheme';

interface AuditChartsProps {
 statusData: Array<{ name: string; value: number; color: string }>;
 findingsByType: Array<{ name: string; value: number }>;
 complianceRate?: number;
 totalAudits?: number;
 completedAudits?: number;
}

export const AuditCharts: React.FC<AuditChartsProps> = ({ statusData, findingsByType, complianceRate = 0, totalAudits = 0, completedAudits = 0 }) => {
 const uid = useId();
 const auditGlowId = `auditGlow-${uid}`;
 const [activeStatusIndex, setActiveStatusIndex] = useState<number | null>(null);

 // Premium activeShape for interactive pie
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const renderActiveShape = (props: any) => {
 const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
 return (
 <g>
 <text x={cx} y={cy - 8} textAnchor="middle" className="fill-foreground font-black text-base">
  {payload.name}
 </text>
 <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground text-sm font-mono">
  {payload.value} ({(percent * 100).toFixed(0)}%)
 </text>
 <Sector
  cx={cx}
  cy={cy}
  innerRadius={innerRadius - 6}
  outerRadius={outerRadius + 10}
  startAngle={startAngle}
  endAngle={endAngle}
  fill={fill}
  style={{ filter: `url(#${auditGlowId})` }}
 />
 <Sector
  cx={cx}
  cy={cy}
  startAngle={startAngle}
  endAngle={endAngle}
  innerRadius={innerRadius - 4}
  outerRadius={outerRadius}
  fill={fill}
  stroke="none"
 />
 </g>
 );
 };

 const completionRate = totalAudits > 0 ? Math.round((completedAudits / totalAudits) * 100) : 0;

 // Gauge data
 const completionGaugeData = [{ name: 'Complétion', value: completionRate, fill: 'url(#auditCompletionGradient)' }];
 const complianceGaugeData = [{ name: 'Conformité', value: complianceRate, fill: 'url(#auditComplianceGradient)' }];

 // Finding severity data
 const findingSeverityData = findingsByType.map((entry) => ({
 ...entry,
 color: entry.name === 'Majeure' ? FINDING_COLORS.majeure : entry.name === 'Mineure' ? FINDING_COLORS.mineure : entry.name === 'Opportunité' ? FINDING_COLORS.opportunite : FINDING_COLORS.observation
 }));

 return (
 <div className="space-y-6">
 {/* SVG Defs */}
 <svg width="0" height="0" className="absolute">
 <defs>
  <filter id={auditGlowId} x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
  <feMerge>
  <feMergeNode in="coloredBlur" />
  <feMergeNode in="SourceGraphic" />
  </feMerge>
  </filter>
  <linearGradient id="auditCompletionGradient" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} />
  <stop offset="100%" stopColor={SENTINEL_PALETTE.secondary} />
  </linearGradient>
  <linearGradient id="auditComplianceGradient" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stopColor={complianceRate >= 80 ? SENTINEL_PALETTE.success : complianceRate >= 50 ? SENTINEL_PALETTE.warning : SEVERITY_COLORS.critical} />
  <stop offset="100%" stopColor={complianceRate >= 80 ? 'hsl(var(--success))' : complianceRate >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--error))'} />
  </linearGradient>
  <linearGradient id="auditBarGradient" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.9} />
  <stop offset="100%" stopColor={SENTINEL_PALETTE.secondary} stopOpacity={0.6} />
  </linearGradient>
 </defs>
 </svg>

 {/* Gauge Cards Row */}
 {(totalAudits > 0 || complianceRate > 0) && (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
  {/* Completion Rate Gauge */}
  <motion.div variants={slideUpVariants} className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300">
  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
  <div className="flex items-center gap-2 mb-4">
  <div className="p-2 bg-primary/10 rounded-3xl">
  <TrendingUp className="h-4 w-4 text-primary" />
  </div>
  <span className="caption">Taux de Complétion</span>
  </div>
  <div className="h-[120px] relative">
  <ResponsiveContainer width="100%" height="100%" >
  <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" barSize={12} data={completionGaugeData} startAngle={180} endAngle={0}>
   <RadialBar background={{ fill: 'hsl(var(--muted) / 0.3)' }} dataKey="value" cornerRadius={10} style={{ filter: `url(#${auditGlowId})` }} />
  </RadialBarChart>
  </ResponsiveContainer>
  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/4 text-center">
  <div className="text-3xl font-black bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
   {completionRate}%
  </div>
  </div>
  </div>
  <div className="text-center text-xs text-muted-foreground mt-2">
  {completedAudits} / {totalAudits} audits complétés
  </div>
  </motion.div>

  {/* Compliance Rate Gauge */}
  <motion.div variants={slideUpVariants} className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300">
  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
  <div className="flex items-center gap-2 mb-4">
  <div className="p-2 bg-emerald-500/10 rounded-3xl">
  <AlertTriangle className="h-4 w-4 text-emerald-500" />
  </div>
  <span className="caption">Taux de Conformité</span>
  </div>
  <div className="h-[120px] relative">
  <ResponsiveContainer width="100%" height="100%" >
  <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" barSize={12} data={complianceGaugeData} startAngle={180} endAngle={0}>
   <RadialBar background={{ fill: 'hsl(var(--muted) / 0.3)' }} dataKey="value" cornerRadius={10} style={{ filter: `url(#${auditGlowId})` }} />
  </RadialBarChart>
  </ResponsiveContainer>
  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/4 text-center">
  <div className={`text-3xl font-black bg-gradient-to-r ${complianceRate >= 80 ? 'from-emerald-600 to-emerald-400' : complianceRate >= 50 ? 'from-amber-600 to-amber-400' : 'from-red-600 to-red-400'} bg-clip-text text-transparent`}>
   {complianceRate}%
  </div>
  </div>
  </div>
  </motion.div>
 </div>
 )}

 {/* Charts Grid */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Status Distribution Interactive Pie */}
 <motion.div variants={slideUpVariants} className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300">
  {/* Tech Corners */}
  <svg className="absolute top-5 left-5 w-3 h-3 text-muted-foreground/30" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute top-5 right-5 w-3 h-3 text-muted-foreground/30 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute bottom-5 left-5 w-3 h-3 text-muted-foreground/30 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute bottom-5 right-5 w-3 h-3 text-muted-foreground/30 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-3xl" />
  <h4 className="heading-4 mb-4 flex items-center gap-2 relative z-10">
  <div className="p-2 bg-primary/10 rounded-3xl">
  <PieChartIcon className="w-4 h-4 text-primary" />
  </div>
  Statut des Audits
  </h4>
  <div className="h-[280px]">
  {statusData.length === 0 ? (
  <EmptyChartState variant="pie" message="Aucune donnée" />
  ) : (
  <ResponsiveContainer width="100%" height="100%" >
  <PieChart>
   <defs>
   {statusData.map((entry, idx) => (
   <linearGradient key={idx || 'unknown'} id={`auditStatusGrad${idx}`} x1="0" y1="0" x2="1" y2="1">
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
   <Cell key={`cell-${index || 'unknown'}`} fill={`url(#auditStatusGrad${index})`} className="cursor-pointer" />
   ))}
   </Pie>
   <Tooltip content={<ChartTooltip />} />
   <Legend
   verticalAlign="bottom"
   iconType="circle"
   iconSize={10}
   formatter={(value) => <span className="caption ml-1">{value}</span>}
   />
  </PieChart>
  </ResponsiveContainer>
  )}
  </div>
 </motion.div>

 {/* Findings by Type Bar Chart */}
 <motion.div variants={slideUpVariants} className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300">
  {/* Tech Corners */}
  <svg className="absolute top-5 left-5 w-3 h-3 text-muted-foreground/30" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute top-5 right-5 w-3 h-3 text-muted-foreground/30 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute bottom-5 left-5 w-3 h-3 text-muted-foreground/30 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
  <svg className="absolute bottom-5 right-5 w-3 h-3 text-muted-foreground/30 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-3xl" />
  <h4 className="heading-4 mb-4 flex items-center gap-2 relative z-10">
  <div className="p-2 bg-orange-500/10 rounded-3xl">
  <BarChartIcon className="w-4 h-4 text-orange-500" />
  </div>
  Constats par Type
  </h4>
  <div className="h-[280px]">
  {findingsByType.length === 0 ? (
  <EmptyChartState variant="bar" message="Aucun constat" />
  ) : (
  <ResponsiveContainer width="100%" height="100%" >
  <BarChart data={findingSeverityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.3)" />
   <XAxis
   dataKey="name"
   axisLine={false}
   tickLine={false}
   tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }}
   dy={10}
   />
   <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
   <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.1)' }} />
   <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40} animationDuration={1200}>
   {findingSeverityData.map((entry, index) => (
   <Cell key={`cell-${index || 'unknown'}`} fill={entry.color} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }} />
   ))}
   </Bar>
  </BarChart>
  </ResponsiveContainer>
  )}
  </div>
 </motion.div>
 </div>
 </div>
 );
};
