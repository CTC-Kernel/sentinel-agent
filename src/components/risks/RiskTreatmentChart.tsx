import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Risk } from '../../types';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyChartState } from '../ui/EmptyChartState';
import { SENTINEL_PALETTE } from '../../theme/chartTheme';

interface RiskTreatmentChartProps {
 risks: Risk[];
}

export const RiskTreatmentChart: React.FC<RiskTreatmentChartProps> = ({ risks }) => {
 // Aggregation by Treatment Status
 const data = React.useMemo(() => {
 const map = { 'Planifié': 0, 'En cours': 0, 'Terminé': 0, 'Retard': 0, 'Non Traité': 0 };
 risks.forEach(r => {
 // Check treatment string
 const status = r.treatment?.status || (r.strategy === 'Accepter' ? 'Terminé' : 'Non Traité');
 if (map[status as keyof typeof map] !== undefined) {
 map[status as keyof typeof map]++;
 } else {
 map['Non Traité']++;
 }
 });

 // Colors for statuses (using centralized chartTheme)
 const COLORS: Record<string, string> = {
 'Planifié': SENTINEL_PALETTE.tertiary,
 'En cours': SENTINEL_PALETTE.primary,
 'Terminé': SENTINEL_PALETTE.success,
 'Retard': SENTINEL_PALETTE.danger,
 'Non Traité': SENTINEL_PALETTE.warning
 };

 return Object.entries(map)
 .filter(([, value]) => value > 0)
 .map(([name, value]) => ({
 name,
 value,
 color: COLORS[name] || SENTINEL_PALETTE.tertiary
 }));
 }, [risks]);

 if (data.length === 0) {
 return <EmptyChartState variant="pie" message="Aucun traitement" description="Définissez des plans de traitement." />;
 }

 return (
 <div className="h-[300px] w-full relative">
 <ResponsiveContainer width="100%" height="100%" >
 <PieChart>
  <Pie
  data={data}
  cx="50%"
  cy="50%"
  innerRadius={65}
  outerRadius={85}
  paddingAngle={4}
  dataKey="value"
  stroke="none"
  cornerRadius={4}
  >
  {data.map((entry, index) => (
  <Cell key={`cell-${index || 'unknown'}`} fill={entry.color} stroke="rgba(255,255,255,0.1)" strokeWidth={2} />
  ))}
  </Pie>
  <Tooltip content={<ChartTooltip />} wrapperStyle={{ outline: 'none' }} />
  <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs font-medium text-muted-foreground ml-1">{value}</span>} />
 </PieChart>
 </ResponsiveContainer>
 {/* Center Stat */}
 <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
 <div className="text-center">
  <span className="block text-2xl font-bold text-foreground dark:text-white">
  {risks.length > 0 ? Math.round((data.find(d => d.name === 'Terminé')?.value || 0) / risks.length * 100) : 0}%
  </span>
  <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Avancement</span>
 </div>
 </div>
 </div>
 );
};
