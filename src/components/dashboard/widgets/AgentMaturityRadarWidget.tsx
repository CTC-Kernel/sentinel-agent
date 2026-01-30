import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { EmptyChartState } from '../../ui/EmptyChartState';
import { SENTINEL_PALETTE } from '../../../theme/chartTheme';
import { useAgentData } from '../../../hooks/useAgentData';
import { Sparkles, BrainCircuit, Activity, Target, ChevronRight } from '../../ui/Icons';

interface AgentMaturityRadarWidgetProps {
    t: (key: string) => string;
    navigate: (path: string) => void;
}

export const AgentMaturityRadarWidget: React.FC<AgentMaturityRadarWidgetProps> = ({ t, navigate }) => {
    const { agents, loading } = useAgentData();
    const radarGradientId = React.useId();
    const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
    const [hoveredAxis, setHoveredAxis] = React.useState<string | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            setMousePos({
                x: ((e.clientX - rect.left) / rect.width) * 100,
                y: ((e.clientY - rect.top) / rect.height) * 100,
            });
        };

        const el = containerRef.current;
        if (el) {
            el.addEventListener('mousemove', handleMouseMove);
            return () => el.removeEventListener('mousemove', handleMouseMove);
        }
    }, []);

    const [mountTime] = React.useState(() => Date.now());

    const radarData = React.useMemo(() => {
        if (!agents || agents.length === 0) return [];

        const total = agents.length;
        const active = agents.filter(a => a.status === 'active').length;
        const healthy = agents.filter(a => a.status !== 'error').length;

        const agentsWithScore = agents.filter(a => a.complianceScore !== null && a.complianceScore !== undefined);
        const avgCompliance = agentsWithScore.length > 0
            ? Math.round(agentsWithScore.reduce((sum, a) => sum + (a.complianceScore || 0), 0) / agentsWithScore.length)
            : 0;

        const latestVersion = '1.0.0';
        const upToDate = agents.filter(a => a.version === latestVersion).length;

        const tenMinAgo = mountTime - 10 * 60 * 1000;
        const supervised = agents.filter(a => new Date(a.lastHeartbeat).getTime() > tenMinAgo).length;

        return [
            { subject: t('dashboard.agentMaturity.compliance'), A: avgCompliance, fullMark: 100 },
            { subject: t('dashboard.agentMaturity.availability'), A: Math.round((active / total) * 100), fullMark: 100 },
            { subject: t('dashboard.agentMaturity.modernity'), A: Math.round((upToDate / total) * 100), fullMark: 100 },
            { subject: t('dashboard.agentMaturity.health'), A: Math.round((healthy / total) * 100), fullMark: 100 },
            { subject: t('dashboard.agentMaturity.monitoring'), A: Math.round((supervised / total) * 100), fullMark: 100 },
        ];
    }, [agents, t, mountTime]);

    const totalScore = radarData.length > 0
        ? Math.round(radarData.reduce((acc, curr) => acc + curr.A, 0) / radarData.length)
        : 0;

    const worstMetric = React.useMemo(() => {
        if (radarData.length === 0) return null;
        return [...radarData].sort((a, b) => a.A - b.A)[0];
    }, [radarData]);

    const getRecommendation = (subject: string) => {
        const recommendations: Record<string, string> = {
            [t('dashboard.agentMaturity.compliance')]: "Planifier un audit des accès sur les endpoints non-conformes.",
            [t('dashboard.agentMaturity.availability')]: "Vérifier la connectivité réseau des agents 'Offline'.",
            [t('dashboard.agentMaturity.modernity')]: "Mettre à jour les agents vers la version v1.0.1 (Critique).",
            [t('dashboard.agentMaturity.health')]: "Analyser les logs système des agents en erreur.",
            [t('dashboard.agentMaturity.monitoring')]: "Réactiver les heartbeats sur le segment production."
        };
        return recommendations[subject] || "Maintenir la vigilance sur la flotte d'agents.";
    };

    const [blips] = React.useState(() => {
        return Array.from({ length: 6 }).map((_, i) => ({
            id: i,
            x: 40 + Math.random() * 20,
            y: 40 + Math.random() * 20,
            delay: Math.random() * 5
        }));
    });

    if (loading) {
        return (
            <div className="w-full h-full min-h-[420px] flex items-center justify-center animate-pulse">
                <div className="w-64 h-64 rounded-full bg-muted/20 flex items-center justify-center">
                    <Activity className="w-12 h-12 text-muted-foreground/20 animate-bounce" />
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative group/radar flex flex-col items-center pt-2 w-full h-full min-h-[420px] overflow-hidden select-none"
        >
            <div
                className="absolute inset-0 opacity-20 pointer-events-none transition-transform duration-1000 ease-out"
                style={{
                    background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, hsl(var(--primary)/0.15) 0%, transparent 50%)`,
                    transform: `translate(${(mousePos.x - 50) / 10}px, ${(mousePos.y - 50) / 10}px)`
                }}
            />

            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

            <div
                className="relative w-[280px] h-[280px] md:w-[320px] md:h-[320px] shrink-0 cursor-pointer transition-all duration-300 hover:scale-[1.05] z-10"
                style={{
                    transform: `perspective(1000px) rotateX(${(mousePos.y - 50) / -15}deg) rotateY(${(mousePos.x - 50) / 15}deg)`,
                }}
                onClick={() => navigate('/agents')}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate('/agents');
                    }
                }}
                role="button"
                tabIndex={0}
                aria-label={t('agents.widget.viewDetails')}
            >
                <div className="absolute inset-0 rounded-full border border-primary/10 animate-pulse" />
                <div className="absolute inset-4 rounded-full border border-primary/5 animate-ping opacity-20" style={{ animationDuration: '4s' }} />

                <div className="absolute inset-0 rounded-full bg-card/30 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.2)_50%)] bg-[length:100%_4px] animate-scanline" />

                    <div className="absolute inset-0 rounded-full animate-spin pointer-events-none" style={{ animationDuration: '6s' }}>
                        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_300deg,hsl(var(--primary)/0.3)_360deg)]" />
                        <div className="absolute right-1/2 top-0 h-1/2 w-0.5 bg-gradient-to-b from-primary to-transparent blur-[2px]" />
                        <div className="absolute right-1/2 top-0 h-1/2 w-[1px] bg-white shadow-[0_0_10px_#fff]" />
                    </div>

                    {blips.map(blip => (
                        <div
                            key={blip.id}
                            className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping"
                            style={{
                                left: `${blip.x}%`,
                                top: `${blip.y}%`,
                                animationDelay: `${blip.delay}s`,
                                animationDuration: '3s'
                            }}
                        />
                    ))}

                    <div className="w-full h-full relative z-10 flex items-center justify-center">
                        {radarData.length === 0 ? (
                            <EmptyChartState variant="radar" message={t('agents.widget.title')} />
                        ) : (
                            <ResponsiveContainer width="95%" height="95%" minWidth={0} minHeight={undefined}>
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                    <defs>
                                        <radialGradient id={`holoGradient-${radarGradientId}`}>
                                            <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.6} />
                                            <stop offset="100%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.1} />
                                        </radialGradient>
                                        <filter id="glow">
                                            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                                            <feMerge>
                                                <feMergeNode in="coloredBlur" />
                                                <feMergeNode in="SourceGraphic" />
                                            </feMerge>
                                        </filter>
                                    </defs>
                                    <PolarGrid
                                        stroke="rgba(255,255,255,0.1)"
                                        radialLines={true}
                                        gridType="polygon"
                                    />
                                    <PolarAngleAxis
                                        dataKey="subject"
                                        tick={{
                                            fill: 'rgba(255,255,255,0.6)',
                                            fontSize: 9,
                                            fontWeight: 600,
                                            fontFamily: 'var(--font-mono)',
                                            letterSpacing: '0.05em'
                                        }}
                                        onMouseEnter={(data) => setHoveredAxis(data.value)}
                                        onMouseLeave={() => setHoveredAxis(null)}
                                    />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <RechartsRadar
                                        name={t('dashboard.maturity')}
                                        dataKey="A"
                                        stroke={SENTINEL_PALETTE.primary}
                                        strokeWidth={1.5}
                                        fill={`url(#holoGradient-${radarGradientId})`}
                                        fillOpacity={0.8}
                                        filter="url(#glow)"
                                        isAnimationActive={true}
                                        animationDuration={1500}
                                    />
                                    <Tooltip content={<ChartTooltip />} />
                                </RadarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover/radar:scale-110 transition-transform duration-500">
                    <div className="flex flex-col items-center">
                        <span className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] font-display animate-in fade-in zoom-in duration-500" key={hoveredAxis || 'total'}>
                            {hoveredAxis ? radarData.find(d => d.subject === hoveredAxis)?.A : totalScore}
                        </span>
                        <span className="text-[10px] font-bold text-primary tracking-[0.2em] uppercase -mt-2 opacity-80 whitespace-nowrap">
                            {hoveredAxis ? hoveredAxis : 'MATURITY'}
                        </span>
                    </div>
                </div>
            </div>

            {worstMetric && (
                <div className="w-[90%] mt-6 p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 backdrop-blur-md group/insight cursor-pointer transition-all hover:translate-y-[-2px] hover:shadow-lg"
                    onClick={() => navigate('/agents')}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate('/agents');
                        }
                    }}
                    role="button"
                    tabIndex={0}>
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-primary/20 text-primary animate-pulse">
                            <BrainCircuit className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Recommandation IA
                                </span>
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/insight:translate-x-1 transition-transform" />
                            </div>
                            <p className="text-xs font-semibold text-foreground/90 leading-tight italic">
                                "{getRecommendation(worstMetric.subject)}"
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                                <div className="h-1 flex-1 bg-muted/40 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${worstMetric.A}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                                    Impact: <span className="text-primary">High</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-4 flex gap-4 opacity-60 group-hover/radar:opacity-100 transition-opacity">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{agents.filter(a => a.status === 'active').length} Ligne</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444]" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{agents.filter(a => a.status === 'error').length} Alerte</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Target className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Target 90%</span>
                </div>
            </div>

            <style>{`
                @keyframes scanline {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }
                .animate-scanline {
                    animation: scanline 8s linear infinite;
                }
            `}</style>
        </div>
    );
};
