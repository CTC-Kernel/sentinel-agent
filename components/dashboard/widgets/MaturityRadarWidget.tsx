import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltip } from '../../ui/ChartTooltip';

interface MaturityRadarWidgetProps {
    radarData: any[]; // Replace 'any' with specific type if available, typically { subject: string, A: number, fullMark: number }[]
    t: (key: string) => string;
    theme: string;
    navigate: (path: string) => void;
}

export const MaturityRadarWidget: React.FC<MaturityRadarWidgetProps> = ({ radarData, t, theme, navigate }) => {
    return (
        <div className="relative group/chart flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-2xl opacity-0 group-hover/chart:opacity-100 transition-opacity duration-700"></div>
            <div
                className="relative w-[260px] h-[260px] sm:w-[280px] sm:h-[280px] md:w-[320px] md:h-[320px] shrink-0 cursor-pointer transition-all duration-500 hover:scale-[1.02] bg-white/40 dark:bg-white/5 backdrop-blur-sm rounded-full border border-slate-200/50 dark:border-white/5 shadow-inner p-4 flex items-center justify-center"
                onClick={() => navigate('/compliance')}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <defs>
                            <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={theme === 'dark' ? '#3b82f6' : '#0f172a'} stopOpacity={0.5} />
                                <stop offset="95%" stopColor={theme === 'dark' ? '#3b82f6' : '#0f172a'} stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <PolarGrid
                            stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)'}
                            strokeDasharray="4 4"
                        />
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{
                                fill: theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.9)',
                                fontSize: 11,
                                fontWeight: 700,
                                fontFamily: 'var(--font-sans)'
                            }}
                        />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <RechartsRadar
                            name={t('dashboard.maturity')}
                            dataKey="A"
                            stroke={theme === 'dark' ? '#60a5fa' : '#0f172a'}
                            strokeWidth={3}
                            fill="url(#radarFill)"
                            fillOpacity={1}
                            isAnimationActive={true}
                        />
                        <Tooltip
                            content={<ChartTooltip />}
                            cursor={{ stroke: theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.2)', strokeWidth: 1 }}
                        />
                    </RadarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/70 dark:bg-black/30 backdrop-blur-md border border-slate-200/60 dark:border-white/10 text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest shadow-sm whitespace-nowrap">
                        {t('dashboard.isoMaturity')}
                    </span>
                </div>
            </div>
        </div>
    );
};
