import React, { useId } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { EmptyChartState } from '../../ui/EmptyChartState';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { PremiumCard } from '../../ui/PremiumCard';
import { DONUT_COLORS } from '../../../theme/chartTheme';
import { useLocale } from '@/hooks/useLocale';

interface IncidentChartsProps {
 categoryData: { name: string; value: number }[];
 timelineData: { name: string; date: Date; count: number }[];
}

export const IncidentCharts: React.FC<IncidentChartsProps> = ({ categoryData, timelineData }) => {
 const uid = useId();
 const { t } = useLocale();
 const incidentGradientId = `incidentGradient-${uid}`;

 return (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Incidents by Category */}
 <PremiumCard glass className="p-6 rounded-xl relative overflow-hidden group hover:shadow-premium hover:-translate-y-1 transition-all duration-normal ease-apple">
 <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 px-2">{t('incidents.charts.byCategory', { defaultValue: 'Par Catégorie' })}</h4>
 <div className="h-[250px] w-full">
  {categoryData.length === 0 ? (
  <EmptyChartState variant="pie" message={t('incidents.charts.noCategory', { defaultValue: 'Aucune catégorie' })} />
  ) : (
  <ResponsiveContainer width="100%" height="100%" >
  <PieChart>
  <Pie
   data={categoryData}
   cx="50%"
   cy="50%"
   innerRadius={65}
   outerRadius={85}
   paddingAngle={4}
   dataKey="value"
   stroke="none"
   cornerRadius={6}
  >
   {categoryData.map((_, index) => (
   <Cell key={`cell-${index || 'unknown'}`} fill={DONUT_COLORS.category[index % DONUT_COLORS.category.length]} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />
   ))}
  </Pie>
  <Tooltip content={<ChartTooltip />} wrapperStyle={{ outline: 'none' }} />
  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
  </PieChart>
  </ResponsiveContainer>
  )}
 </div>
 </PremiumCard>

 {/* Incidents Timeline (Last 6 Months) */}
 <PremiumCard glass className="p-6 rounded-xl relative overflow-hidden group hover:shadow-premium hover:-translate-y-1 transition-all duration-normal ease-apple">
 <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 px-2">{t('incidents.charts.timeline', { defaultValue: 'Historique (6 mois)' })}</h4>
 <div className="h-[250px] w-full">
  {timelineData.length === 0 ? (
  <EmptyChartState variant="bar" message={t('incidents.charts.noHistory', { defaultValue: 'Aucun historique récent' })} />
  ) : (
  <ResponsiveContainer width="100%" height="100%" >
  <BarChart
  data={timelineData}
  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
  >
  <defs>
   <linearGradient id={incidentGradientId} x1="0" y1="0" x2="0" y2="1">
   <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
   <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
   </linearGradient>
  </defs>
  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.2} />
  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} dy={10} />
  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} allowDecimals={false} />
  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--primary))', opacity: 0.05 }} wrapperStyle={{ outline: 'none' }} />
  <Bar dataKey="count" fill={`url(#${incidentGradientId})`} radius={[6, 6, 0, 0]} barSize={24} />
  </BarChart>
  </ResponsiveContainer>
  )}
 </div>
 </PremiumCard>
 </div>
 );
};
