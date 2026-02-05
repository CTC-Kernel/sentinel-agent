import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { EmptyChartState } from '../../ui/EmptyChartState';
import { SENTINEL_PALETTE, CHART_STYLES } from '../../../theme/chartTheme';

interface MaturityRadarWidgetProps {
 radarData: { subject: string; A: number; fullMark?: number }[];
 t: (key: string) => string;
 navigate: (path: string) => void;
 theme: string;
 referential?: string; // e.g. "ISO 27001", "DORA", etc.
}

export const MaturityRadarWidget: React.FC<MaturityRadarWidgetProps> = ({ radarData, t, navigate, referential = "" }) => {
 const radarGradientId = React.useId();
 const totalScore = radarData.length > 0
 ? Math.round(radarData.reduce((acc, curr) => acc + curr.A, 0) / radarData.length)
 : 0;

 return (
 <div className="relative group/chart flex flex-col items-center pt-2 w-full h-full min-h-[380px]">
 <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-full blur-2xl opacity-0 group-hover/chart:opacity-70 transition-opacity duration-700 pointer-events-none"></div>

 {/* Radar Chart Section */}
 <div
 className="relative w-[260px] h-[260px] sm:w-[280px] sm:h-[280px] md:w-[320px] md:h-[320px] shrink-0 cursor-pointer transition-all duration-500 hover:scale-[1.02] bg-card/40 backdrop-blur-sm rounded-full border border-border shadow-inner p-4 flex items-center justify-center overflow-hidden mb-6"
 onClick={() => navigate('/compliance')}
 onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
  e.preventDefault();
  navigate('/compliance');
  }
 }}
 role="button"
 tabIndex={0}
 aria-label="Voir le radar de maturité détaillé"
 >
 {/* Radar Sweep Effect - Premium Animated */}
 <div className="absolute inset-0 rounded-full animate-spin pointer-events-none" style={{ animationDuration: '4s' }}>
  <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,hsl(var(--primary)/0.6)_360deg)]" />
  <div className="absolute right-1/2 top-0 h-1/2 w-1 bg-gradient-to-b from-primary/80 to-transparent origin-bottom" />
 </div>
 <div className="absolute inset-0 rounded-full animate-spin pointer-events-none opacity-30" style={{ animationDuration: '8s', animationDirection: 'reverse' }}>
  <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg,transparent_0deg,transparent_350deg,hsl(var(--brand-500)/0.4)_360deg)]" />
 </div>

 <div className="w-full h-full relative z-10">
  {radarData.every(d => d.A === 0) ? (
  <div className="w-full h-full flex flex-col items-center justify-center pointer-events-none">
  <EmptyChartState
  variant="radar"
  message={t('dashboard.maturity')}
  description="Aucune donnée"
  className="scale-75 origin-center" // adjust size for the small widget
  />
  </div>
  ) : (
  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={undefined}>
  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
  <defs>
   <linearGradient id={radarGradientId} x1="0" y1="0" x2="0" y2="1">
   <stop offset="5%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.5} />
   <stop offset="95%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.05} />
   </linearGradient>
  </defs>
  <PolarGrid stroke={CHART_STYLES.grid.stroke} strokeDasharray={CHART_STYLES.grid.strokeDasharray} />
  <PolarAngleAxis
   dataKey="subject"
   tick={{
   fill: CHART_STYLES.axis.stroke,
   fontSize: 11,
   fontWeight: 700,
   fontFamily: 'var(--font-sans)'
   }}
  />
  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
  <RechartsRadar
   name={t('dashboard.maturity')}
   dataKey="A"
   stroke={SENTINEL_PALETTE.primary}
   strokeWidth={3}
   fill={`url(#${radarGradientId})`}
   fillOpacity={1}
   isAnimationActive={true}
   animationDuration={1500}
   animationEasing="ease-out"
  />
  <Tooltip
   content={<ChartTooltip />}
   cursor={{ stroke: CHART_STYLES.cursor, strokeWidth: 1 }}
  />
  </RadarChart>
  </ResponsiveContainer>
  )}
 </div>
 {!radarData.every(d => d.A === 0) && (
  <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center z-20">
  <span className="inline-flex items-center px-3 py-1 rounded-full bg-background/70 backdrop-blur-md border border-border text-[11px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest shadow-sm whitespace-nowrap">
  {t('dashboard.isoMaturity')}
  </span>
  </div>
 )}
 </div>

 {/* Premium Goal Gauge */}
 <div className="w-[85%] max-w-[280px] relative mt-2 group/gauge">
 <div className="flex justify-between items-end mb-2">
  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Objectif Conformité{referential ? ` ${referential}` : ''}</span>
  <span className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
  {totalScore}%
  </span>
 </div>

 <div className="h-3 w-full bg-secondary/50 rounded-full overflow-hidden backdrop-blur-sm border border-border/50 shadow-inner relative">
  {/* Background Grid Pattern */}
  <div className="absolute inset-0 opacity-30 bg-[linear-gradient(90deg,transparent_90%,#000_90%)] bg-[length:10px_100%] dark:bg-[linear-gradient(90deg,transparent_90%,#fff_90%)]"></div>

  {/* Progress Bar with Gradient and Glow */}
  <div
  className="h-full rounded-full relative transition-all duration-1000 ease-out flex items-center justify-end"
  style={{ width: `${totalScore}%` }}
  >
  <div className="absolute inset-0 bg-gradient-to-r from-primary via-purple-500 to-pink-500 animate-gradient-x"></div>
  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>

  {/* Glow effect at the tip */}
  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-white/40 blur-md rounded-full transform translate-x-1/2"></div>

  {/* Shimmer effect */}
  <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent w-[50%] animate-shimmer" style={{ animationDuration: '2s' }}></div>
  </div>
 </div>

 {/* Target Marker */}
 <div className="absolute top-[22px] right-0 flex flex-col items-center transform translate-x-1/2">
  <div className="w-0.5 h-4 bg-muted-foreground/50 mb-0.5"></div>
  <span className="text-[11px] font-medium text-muted-foreground">100%</span>
 </div>

 {/* Motivation Text based on score */}
 <div className="mt-2 text-center h-4">
  <span className="text-[11px] font-medium text-primary animate-pulse tracking-wide">
  {totalScore < 100 ? "Atteignez l'excellence opérationnelle" : "Conformité maximale atteinte !"}
  </span>
 </div>
 </div>
 </div>
 );
};
