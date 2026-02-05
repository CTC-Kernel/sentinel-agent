import React, { useState, useMemo } from 'react';
import { Risk } from '../../types';
import { Activity, Layers, TrendingUp, AlertTriangle, Shield, Target, Zap } from '../ui/Icons';
import { motion } from 'framer-motion';
import { RiskHeatmap } from './RiskHeatmap';
import { RiskResidualChart } from './RiskResidualChart';
import { RiskTreatmentChart } from './RiskTreatmentChart';
import { useLocale } from '@/hooks/useLocale';
import { RiskStrategy } from '@/constants/RiskConstants';
import {
 RadialBarChart, RadialBar, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
 Sector
} from 'recharts';
import { ChartTooltip } from '../ui/ChartTooltip';
import { SEVERITY_COLORS, SENTINEL_PALETTE } from '../../theme/chartTheme';
import { RISK_THRESHOLDS } from '../../constants/complianceConfig';

interface RiskDashboardProps {
 risks: Risk[];
}

// Premium activeShape renderer for interactive pie
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderActiveShape = (props: any) => {
 const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;

 return (
 <g>
 <text x={cx} y={cy - 8} textAnchor="middle" className="fill-foreground font-black text-lg">
 {payload.name}
 </text>
 <text x={cx} y={cy + 14} textAnchor="middle" className="fill-muted-foreground text-sm font-mono">
 {payload.value} ({(percent * 100).toFixed(0)}%)
 </text>
 <Sector
 cx={cx}
 cy={cy}
 innerRadius={innerRadius - 6}
 outerRadius={outerRadius + 8}
 startAngle={startAngle}
 endAngle={endAngle}
 fill={fill}
 style={{ filter: 'url(#riskGlow)' }}
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

export const RiskDashboard: React.FC<RiskDashboardProps> = ({ risks }) => {
 const { t } = useLocale();
 const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

 // Calculate metrics using centralized RISK_THRESHOLDS
 const metrics = useMemo(() => {
 const total = risks.length;
 const critical = risks.filter(r => r.score >= RISK_THRESHOLDS.CRITICAL).length;
 const high = risks.filter(r => r.score >= RISK_THRESHOLDS.HIGH && r.score < RISK_THRESHOLDS.CRITICAL).length;
 const medium = risks.filter(r => r.score >= RISK_THRESHOLDS.MEDIUM && r.score < RISK_THRESHOLDS.HIGH).length;
 const low = risks.filter(r => r.score < RISK_THRESHOLDS.MEDIUM).length;

 const treated = risks.filter(r => r.strategy && r.strategy !== RiskStrategy.ACCEPT).length;
 const treatmentRate = total > 0 ? Math.round((treated / total) * 100) : 0;

 const avgScore = total > 0 ? risks.reduce((acc, r) => acc + r.score, 0) / total : 0;
 const avgResidual = total > 0 ? risks.reduce((acc, r) => acc + (r.residualScore || r.score), 0) / total : 0;
 const reductionRate = avgScore > 0 ? Math.round(((avgScore - avgResidual) / avgScore) * 100) : 0;

 return { total, critical, high, medium, low, treatmentRate, avgScore, avgResidual, reductionRate };
 }, [risks]);

 // Distribution data for interactive pie
 const distributionData = useMemo(() => [
 { name: t('risks.matrix.legend.critical', { defaultValue: 'Critique' }), value: metrics.critical, color: SEVERITY_COLORS.critical },
 { name: t('risks.matrix.legend.high', { defaultValue: 'Élevé' }), value: metrics.high, color: SEVERITY_COLORS.high },
 { name: t('risks.matrix.legend.medium', { defaultValue: 'Moyen' }), value: metrics.medium, color: SEVERITY_COLORS.medium },
 { name: t('risks.matrix.legend.low', { defaultValue: 'Faible' }), value: metrics.low, color: SEVERITY_COLORS.low }
 ].filter(d => d.value > 0), [metrics, t]);

 // Gauge data for RadialBarChart
 const gaugeData = [
 { name: 'Traitement', value: metrics.treatmentRate, fill: 'url(#gaugeGradient)' }
 ];

 const reductionGaugeData = [
 { name: 'Réduction', value: metrics.reductionRate, fill: 'url(#reductionGradient)' }
 ];

 return (
 <div className="space-y-6" role="region" aria-label="Tableau de bord des risques">
 {/* SVG Defs for Glow Effects and Gradients */}
 <svg width="0" height="0" className="absolute">
 <defs>
  <filter id="riskGlow" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
  <feMerge>
  <feMergeNode in="coloredBlur" />
  <feMergeNode in="SourceGraphic" />
  </feMerge>
  </filter>
  <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} />
  <stop offset="100%" stopColor={SENTINEL_PALETTE.secondary} />
  </linearGradient>
  <linearGradient id="reductionGradient" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stopColor={SENTINEL_PALETTE.success} />
  <stop offset="100%" stopColor="#10b981" />
  </linearGradient>
 </defs>
 </svg>

 {/* Hero KPI Section */}
 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
 {/* Treatment Rate Gauge */}
 <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.1 }}
  className="glass-premium p-6 rounded-3xl relative overflow-hidden group hover:shadow-apple-lg transition-all duration-300"
 >
  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
  <div className="flex items-center gap-2 mb-4">
  <div className="p-2 bg-primary/10 rounded-3xl">
  <Shield className="h-4 w-4 text-primary" />
  </div>
  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('risks.dashboard.kpi.treatmentRate', { defaultValue: 'Taux Traitement' })}</span>
  </div>
  <div className="h-[140px] relative">
  <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
  <RadialBarChart
  cx="50%"
  cy="50%"
  innerRadius="60%"
  outerRadius="90%"
  barSize={12}
  data={gaugeData}
  startAngle={180}
  endAngle={0}
  >
  <RadialBar
   background={{ fill: 'hsl(var(--muted) / 0.3)' }}
   dataKey="value"
   cornerRadius={10}
   style={{ filter: 'url(#riskGlow)' }}
  />
  </RadialBarChart>
  </ResponsiveContainer>
  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/4 text-center">
  <div className="text-3xl font-black bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
  {metrics.treatmentRate}%
  </div>
  </div>
  </div>
 </motion.div>

 {/* Reduction Rate Gauge */}
 <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.15 }}
  className="glass-premium p-6 rounded-3xl relative overflow-hidden group hover:shadow-apple-lg transition-all duration-300"
 >
  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
  <div className="flex items-center gap-2 mb-4">
  <div className="p-2 bg-emerald-500/10 rounded-3xl">
  <TrendingUp className="h-4 w-4 text-emerald-500" />
  </div>
  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('risks.dashboard.kpi.reductionRate', { defaultValue: 'Réduction Risque' })}</span>
  </div>
  <div className="h-[140px] relative">
  <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
  <RadialBarChart
  cx="50%"
  cy="50%"
  innerRadius="60%"
  outerRadius="90%"
  barSize={12}
  data={reductionGaugeData}
  startAngle={180}
  endAngle={0}
  >
  <RadialBar
   background={{ fill: 'hsl(var(--muted) / 0.3)' }}
   dataKey="value"
   cornerRadius={10}
   style={{ filter: 'url(#riskGlow)' }}
  />
  </RadialBarChart>
  </ResponsiveContainer>
  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/4 text-center">
  <div className="text-3xl font-black bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">
  {metrics.reductionRate}%
  </div>
  </div>
  </div>
 </motion.div>

 {/* Key Metrics Cards */}
 <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.2 }}
  className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4"
 >
  {[
  { label: t('common.all', { defaultValue: 'Total' }), value: metrics.total, icon: Target, color: 'brand', gradient: 'from-primary to-primary/80' },
  { label: t('risks.dashboard.kpi.critical', { defaultValue: 'Critiques' }), value: metrics.critical, icon: AlertTriangle, color: 'red', gradient: 'from-red-500 to-red-400' },
  { label: 'Score Moy.', value: metrics.avgScore.toFixed(1), icon: Zap, color: 'amber', gradient: 'from-amber-500 to-amber-400' },
  { label: t('risks.dashboard.kpi.residualValue', { defaultValue: 'Résiduel' }), value: metrics.avgResidual.toFixed(1), icon: Shield, color: 'emerald', gradient: 'from-emerald-500 to-emerald-400' }
  ].map((item, idx) => (
  <div
  key={idx || 'unknown'}
  className="glass-premium p-4 rounded-4xl flex flex-col items-center justify-center text-center hover:shadow-apple hover:-translate-y-1 transition-all duration-300 group"
  >
  <div className={`p-2.5 bg-${item.color}-500/10 rounded-3xl mb-3 group-hover:scale-110 transition-transform`}>
  <item.icon className={`h-4 w-4 text-${item.color}-500`} />
  </div>
  <span className={`text-2xl font-black bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent mb-1`}>
  {item.value}
  </span>
  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{item.label}</span>
  </div>
  ))}
 </motion.div>
 </div>

 {/* Charts Row 1: Heatmap + Interactive Distribution */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Risk Heatmap */}
 <motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ delay: 0.1 }}
  className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
  aria-label="Graphique Heatmap des risques"
 >
  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-3xl" />
  <h3 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2 uppercase tracking-wider">
  <div className="p-2 bg-primary/10 rounded-3xl">
  <Activity className="w-4 h-4 text-primary" />
  </div>
  {t('risks.matrix.title', { defaultValue: 'Cartographie des Risques' })}
  </h3>
  <RiskHeatmap risks={risks} />
 </motion.div>

 {/* Interactive Risk Distribution Pie */}
 <motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ delay: 0.2 }}
  className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
 >
  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-3xl" />
  <h3 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2 uppercase tracking-wider">
  <div className="p-2 bg-orange-500/10 rounded-3xl">
  <AlertTriangle className="w-4 h-4 text-orange-500" />
  </div>
  {t('risks.dashboard.charts.distribution', { defaultValue: 'Distribution par Niveau' })}
  </h3>
  <div className="h-[280px]">
  <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
  <PieChart>
  <defs>
   {distributionData.map((entry, idx) => (
   <linearGradient key={idx || 'unknown'} id={`riskPieGrad${idx}`} x1="0" y1="0" x2="1" y2="1">
   <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
   <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
   </linearGradient>
   ))}
  </defs>
  <Pie
   data={distributionData}
   cx="50%"
   cy="50%"
   innerRadius="55%"
   outerRadius="75%"
   paddingAngle={4}
   dataKey="value"
   stroke="none"
   cornerRadius={6}
   activeIndex={activePieIndex !== null ? activePieIndex : undefined}
   activeShape={renderActiveShape}
   onMouseEnter={(_, index) => setActivePieIndex(index)}
   onMouseLeave={() => setActivePieIndex(null)}
  >
   {distributionData.map((_, index) => (
   <Cell
   key={`cell-${index || 'unknown'}`}
   fill={`url(#riskPieGrad${index})`}
   className="cursor-pointer transition-all duration-300"
   />
   ))}
  </Pie>
  <Tooltip content={<ChartTooltip />} />
  <Legend
   verticalAlign="bottom"
   iconType="circle"
   iconSize={10}
   formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1 uppercase">{value}</span>}
  />
  </PieChart>
  </ResponsiveContainer>
  </div>
 </motion.div>
 </div>

 {/* Treatment Progress */}
 <motion.div
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: 0.25 }}
 className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
 aria-label="Graphique d'avancement des traitements"
 >
 <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-3xl" />
 <h3 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2 uppercase tracking-wider">
  <div className="p-2 bg-success-bg rounded-3xl">
  <Layers className="w-4 h-4 text-success-text" />
  </div>
  {t('risks.dashboard.charts.treatmentStatus', { defaultValue: 'Avancement des Traitements' })}
 </h3>
 <RiskTreatmentChart risks={risks} />
 </motion.div>

 {/* Inherent vs Residual (Full Width) */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.35 }}
 className="glass-premium p-8 rounded-3xl relative overflow-hidden min-h-[350px] hover:shadow-apple-lg transition-all duration-300"
 >
 <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 dark:bg-primary/60/15 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

 <div className="flex items-center gap-3 mb-6 relative z-10">
  <div className="p-2 bg-primary/10 rounded-3xl">
  <TrendingUp className="h-5 w-5 text-primary" />
  </div>
  <div>
  <h3 className="font-bold text-lg text-foreground">{t('risks.dashboard.charts.inherentVsResidual', { defaultValue: 'Réduction du Risque (Inhérent vs Résiduel)' })}</h3>
  <p className="text-xs text-muted-foreground">{t('risks.matrix.description', { defaultValue: 'Impact des mesures de sécurité par catégorie' })}</p>
  </div>
 </div>

 <div className="h-[250px] w-full relative z-10" aria-label="Graphique de réduction du risque">
  <RiskResidualChart risks={risks} />
 </div>
 </motion.div>

 {/* Top Critical Risks Table */}
 {metrics.critical > 0 && (
 <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.4 }}
  className="glass-premium p-8 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
 >
  <div className="flex items-center gap-3 mb-6">
  <div className="p-2 bg-error-bg rounded-3xl">
  <AlertTriangle className="h-5 w-5 text-error-text" />
  </div>
  <div>
  <h3 className="font-bold text-lg text-foreground">{t('dashboard.insightRisks', { defaultValue: 'Top Risques Critiques' })}</h3>
  <p className="text-xs text-muted-foreground">{t('risks.dashboardStatDesc', { defaultValue: 'Actions prioritaires requises' })}</p>
  </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Liste des risques critiques">
  {risks
  .filter(r => r.score >= RISK_THRESHOLDS.CRITICAL)
  .sort((a, b) => b.score - a.score)
  .slice(0, 6)
  .map((risk, index) => (
  <motion.div
   key={`risk-card-${index || 'unknown'}`}
   initial={{ opacity: 0, y: 10 }}
   animate={{ opacity: 1, y: 0 }}
   transition={{ delay: 0.4 + index * 0.05 }}
   className="flex flex-col p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-error-border/30 hover:bg-error-bg/50 hover:border-error-border transition-all cursor-pointer group focus-visible:ring-2 focus-visible:ring-error-text focus:outline-none"
   role="listitem"
   tabIndex={0}
   aria-label={`Risque critique: ${risk.threat}, Score ${risk.score}`}
  >
   <div className="flex justify-between items-start mb-2">
   <div className="flex items-center gap-2">
   <span className="text-lg font-black text-error-text">#{index + 1}</span>
   <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-error-bg text-error-text border border-error-border/30">
   Score {risk.score}
   </span>
   </div>
   <span className="text-[11px] text-muted-foreground">
   {risk.treatmentDeadline ? new Date(risk.treatmentDeadline).toLocaleDateString() : t('risks.treatment.noDeadline', { defaultValue: 'Pas d\'échéance' })}
   </span>
   </div>
   <h5 className="font-bold text-sm text-foreground mb-1 line-clamp-2 group-hover:text-error-text transition-colors">
   {risk.threat}
   </h5>
   <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{risk.category || 'Général'}</p>

   <div className="mt-auto pt-3 border-t border-border/50 flex justify-between items-center">
   <span className={`text-[11px] uppercase font-bold px-2 py-1 rounded-md
   ${risk.strategy === RiskStrategy.MITIGATE ? 'bg-info-bg text-info-text' :
   risk.strategy === RiskStrategy.TRANSFER ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400' :
    risk.strategy === RiskStrategy.AVOID ? 'bg-success-bg text-success-text' :
    'bg-warning-bg text-warning-text'
   }`}>
   {risk.strategy || t('common.unknown', { defaultValue: 'Non défini' })}
   </span>
   {risk.residualScore !== undefined && (
   <span className="text-[11px] text-muted-foreground">
   Résiduel: <span className="font-bold text-foreground">{risk.residualScore}</span>
   </span>
   )}
   </div>
  </motion.div>
  ))}
  </div>
 </motion.div>
 )}
 </div>
 );
};
