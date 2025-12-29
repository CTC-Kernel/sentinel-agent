import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { EmptyChartState } from '../../ui/EmptyChartState';

interface MaturityRadarWidgetProps {
    radarData: { subject: string; A: number; fullMark?: number }[];
    t: (key: string) => string;
    navigate: (path: string) => void;
    theme: string;
}

export const MaturityRadarWidget: React.FC<MaturityRadarWidgetProps> = ({ radarData, t, navigate, theme }) => {
    const radarGradientId = React.useId();
    const isDark = theme === 'dark';

    const chartColors = {
        stroke: 'hsl(var(--primary))',
        fill: 'hsl(var(--primary))',
        grid: isDark ? '#334155' : 'hsl(var(--border) / 0.3)', // slate-700 vs border
        text: isDark ? '#94a3b8' : 'hsl(var(--muted-foreground))', // slate-400 vs muted
        cursor: isDark ? 'hsl(var(--foreground) / 0.1)' : 'hsl(var(--muted-foreground) / 0.1)'
    };

    return (
        <div className="relative group/chart flex items-center justify-center w-full h-full min-h-[320px]">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-purple-500/5 rounded-full blur-2xl opacity-0 group-hover/chart:opacity-100 transition-opacity duration-700"></div>
            <div
                className="relative w-[260px] h-[260px] sm:w-[280px] sm:h-[280px] md:w-[320px] md:h-[320px] shrink-0 cursor-pointer transition-all duration-500 hover:scale-[1.02] bg-card/40 backdrop-blur-sm rounded-full border border-border shadow-inner p-4 flex items-center justify-center overflow-hidden"
                onClick={() => navigate('/compliance')}
            >
                {/* Radar Sweep Effect */}
                <div className="absolute inset-0 rounded-full animate-spin-slow pointer-events-none opacity-20 dark:opacity-10 bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,hsl(var(--primary))_360deg)]" style={{ animationDuration: '4s' }}></div>

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
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                <defs>
                                    <linearGradient id={radarGradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={chartColors.fill} stopOpacity={0.5} />
                                        <stop offset="95%" stopColor={chartColors.fill} stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <PolarGrid
                                    stroke={chartColors.grid}
                                    strokeDasharray="4 4"
                                />
                                <PolarAngleAxis
                                    dataKey="subject"
                                    tick={{
                                        fill: chartColors.text,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        fontFamily: 'var(--font-sans)'
                                    }}
                                />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <RechartsRadar
                                    name={t('dashboard.maturity')}
                                    dataKey="A"
                                    stroke={chartColors.stroke}
                                    strokeWidth={3}
                                    fill={`url(#${radarGradientId})`}
                                    fillOpacity={1}
                                    isAnimationActive={true}
                                />
                                <Tooltip
                                    content={<ChartTooltip />}
                                    cursor={{ stroke: chartColors.cursor, strokeWidth: 1 }}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    )}
                </div>
                {!radarData.every(d => d.A === 0) && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center z-20">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-background/70 backdrop-blur-md border border-border text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest shadow-sm whitespace-nowrap">
                            {t('dashboard.isoMaturity')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};
