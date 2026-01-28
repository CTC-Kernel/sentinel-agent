import React, { memo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Shield, Activity } from '../ui/Icons';
import {
    ComposableMap,
    Geographies,
    Geography,
    Marker,
    ZoomableGroup
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { motion, AnimatePresence } from "framer-motion";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Threat {
    name: string;
    type: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
}

interface MapProps {
    data: Array<{
        country: string;
        value: number;
        markers: Array<{ coordinates: [number, number]; name: string } & Threat>;
    }>;
    setTooltipContent?: (content: string) => void; // Keeping for compatibility, but unused
}

// Sentinel Color Scale: Dark Slate -> Blue -> Orange -> Red
const colorScale = scaleLinear<string>()
    .domain([0, 1, 5, 10]) // Adjusted domain for better sensitivity
    .range(["#1e293b", "#3b82f6", "#f97316", "#ef4444"]);

export const WorldThreatMap: React.FC<MapProps> = memo(({ data }) => {
    const [tooltipContent, setTooltip] = useState<{ x: number, y: number, content: React.ReactNode } | null>(null);

    return (
        <div
            className="w-full h-full bg-slate-950 rounded-3xl overflow-hidden relative isolate group"
            onMouseLeave={() => setTooltip(null)}
        >
            {/* Cyber Grid Background Effect */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.9)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)] z-0 pointer-events-none opacity-20" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-950/80 to-slate-950 z-0 pointer-events-none" />

            {/* HUD Overlay */}
            <div className="absolute top-6 left-8 z-10 pointer-events-none">
                <div className="text-cyan-500 text-xs font-mono mb-1 tracking-widest">TACTICAL VIEW</div>
                <div className="text-white text-xl font-bold tracking-tighter flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    LIVE FEED
                </div>
            </div>

            <div className="w-full h-full flex items-center justify-center relative z-1 p-8">
                <ComposableMap projectionConfig={{ scale: 200 }} width={980} height={500} style={{ width: "100%", height: "100%" }}>
                    <ZoomableGroup>
                        <Geographies geography={geoUrl}>
                            {({ geographies }) =>
                                geographies.map((geo) => {
                                    const countryName = geo.properties.name;
                                    const cur = data.find((s) => {
                                        // Fuzzy match country name (Case Insensitive)
                                        const sName = s.country.toLowerCase();
                                        const gName = countryName.toLowerCase();

                                        // Specific overrides for common mismatches
                                        if (sName === 'usa' && (gName.includes('united states') || gName.includes('america'))) return true;
                                        if (sName === 'uk' && (gName.includes('united kingdom') || gName.includes('britain'))) return true;
                                        if (sName === 'russia' && gName.includes('russian')) return true;

                                        return sName === gName || sName.includes(gName) || gName.includes(sName);
                                    });
                                    const intensity = cur ? cur.value : 0;
                                    const hasThreats = intensity > 0;

                                    return (
                                        <Geography
                                            key={geo.rsmKey}
                                            geography={geo}
                                            fill={hasThreats ? colorScale(intensity) : "#0f172a"}
                                            stroke={hasThreats ? "rgba(255,255,255,0.2)" : "#1e293b"}
                                            strokeWidth={0.5}
                                            style={{
                                                default: { outline: "none", transition: "all 0.3s ease" },
                                                hover: {
                                                    fill: hasThreats ? colorScale(intensity + 2) : "#1e293b",
                                                    outline: "none",
                                                    cursor: hasThreats ? 'pointer' : 'default',
                                                    stroke: "#38bdf8",
                                                    strokeWidth: 1,
                                                    filter: "drop-shadow(0 0 5px rgba(14, 165, 233, 0.3))"
                                                },
                                                pressed: { fill: "#0284c7", outline: "none" },
                                            }}
                                            onMouseEnter={(e) => {
                                                const { clientX, clientY } = e;
                                                const topThreats = cur ? cur.markers.slice(0, 3) : [];
                                                const threatCount = cur ? cur.markers.length : 0;

                                                setTooltip({
                                                    x: clientX,
                                                    y: clientY,
                                                    content: (
                                                        <div className="min-w-[220px]">
                                                            {/* Header */}
                                                            <div className="flex justify-between items-start mb-2 pb-2 border-b border-border/40">
                                                                <div className="font-bold text-white text-sm tracking-wide">{countryName}</div>
                                                                {hasThreats && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="relative flex h-2 w-2">
                                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                                        </span>
                                                                        <span className="text-[11px] font-mono text-red-500 font-bold tracking-wider">LIVE</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Stats Grid */}
                                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                                <div className="bg-white/5 rounded-lg p-2 text-center border border-white/5">
                                                                    <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-0.5">Score</div>
                                                                    <div className={`text-lg font-bold font-mono ${hasThreats ? 'text-orange-400' : 'text-emerald-400'}`}>
                                                                        {intensity.toFixed(0)}
                                                                    </div>
                                                                </div>
                                                                <div className="bg-white/5 rounded-lg p-2 text-center border border-white/5">
                                                                    <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-0.5">Events</div>
                                                                    <div className="text-lg font-bold font-mono text-white">
                                                                        {threatCount}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Active Threats List */}
                                                            {topThreats.length > 0 && (
                                                                <div className="space-y-2">
                                                                    <div className="text-[11px] uppercase text-slate-500 dark:text-slate-300 font-bold tracking-wider border-l-2 border-slate-700 pl-2">
                                                                        Latest Intelligence
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        {topThreats.map((t: Threat, idx) => (
                                                                            <div key={idx} className="flex items-start gap-2 text-xs text-slate-200 group">
                                                                                <div className={`mt-0.5 p-1 rounded flex-shrink-0 ${t.severity === 'Critical' ? 'bg-red-50 text-red-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                                                                    {t.type === 'Malware' ? <Activity size={10} /> :
                                                                                        t.type === 'Vulnerability' ? <Shield size={10} /> :
                                                                                            <AlertTriangle size={10} />}
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <div className="leading-tight opacity-90 group-hover:opacity-70 transition-opacity truncate font-medium">
                                                                                        {t.name}
                                                                                    </div>
                                                                                    <div className="text-[11px] text-slate-500 dark:text-slate-300 flex gap-2 mt-0.5">
                                                                                        <span>{t.type}</span>
                                                                                        <span>•</span>
                                                                                        <span className={t.severity === 'Critical' ? 'text-red-400' : 'text-orange-400'}>{t.severity}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    {threatCount > 3 && (
                                                                        <div className="text-[11px] text-center text-slate-500 dark:text-slate-300 italic pt-1">
                                                                            + {threatCount - 3} other active events
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {!hasThreats && (
                                                                <div className="flex items-center justify-center gap-2 text-xs text-emerald-400/80 italic py-2 bg-emerald-50 rounded-lg border border-emerald-500/10">
                                                                    <span>No active threats detected.</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                });
                                            }}
                                            onMouseMove={(e) => {
                                                setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                                            }}
                                            onMouseLeave={() => {
                                                setTooltip(null);
                                            }}
                                        />
                                    );
                                })
                            }
                        </Geographies>

                        {/* Markers for specific threats/events */}
                        {data.flatMap(d => d.markers).map((marker, i) => (
                            <Marker
                                key={`${marker.name}-${i}`}
                                coordinates={marker.coordinates}
                                onMouseEnter={() => {
                                    // Use native event to position
                                    // But markers in react-simple-maps don't pass MouseEvent easily in some versions?
                                    // Actually they do.
                                    // We need to approximate position or use a fixed one?
                                    // Let's rely on standard bubbling or specific logic
                                    // For simplicity, we might struggle to get exact screen coords from SVG marker event without a ref.
                                    // Actually checking docs/types... 
                                    // We will try to just show it "near cursor" via mouseMove on container? 
                                    // No, let's keep it simple: Markers get tooltips too.
                                }}
                            // Adding a "group" with onMouseEnter works
                            >
                                <g
                                    className="cursor-pointer group"
                                    onMouseEnter={(e) => {
                                        setTooltip({
                                            x: e.clientX,
                                            y: e.clientY,
                                            content: (
                                                <div className="max-w-[200px]">
                                                    <div className="font-bold text-red-500 text-xs mb-0.5">THREAT DETECTED</div>
                                                    <div className="text-white text-xs leading-tight">{marker.name}</div>
                                                </div>
                                            )
                                        });
                                    }}
                                    onMouseLeave={() => setTooltip(null)}
                                >
                                    {/* Radar Ping Effect */}
                                    <circle r={8} fill="none" stroke="hsl(var(--destructive))" strokeWidth={0.5} className="animate-[ping_3s_linear_infinite] opacity-60" />
                                    <circle r={3} fill="hsl(var(--destructive))" className="drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                </g>
                            </Marker>
                        ))}
                    </ZoomableGroup>
                </ComposableMap>
            </div>

            {/* Floating Tooltip Portal */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {tooltipContent && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            style={{
                                position: 'fixed',
                                left: tooltipContent.x + 15,
                                top: tooltipContent.y - 15,
                                zIndex: 9999,
                                pointerEvents: 'none'
                            }}
                            className="bg-slate-900/95 backdrop-blur-xl border border-border/40 p-3 rounded-3xl shadow-2xl min-w-[150px]"
                        >
                            {tooltipContent.content}
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Legend overlay */}
            <div className="absolute bottom-4 left-8 pointer-events-none">
                <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500 dark:text-slate-300 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/5 shadow-xl">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-800"></div> SAFE</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div> LOW</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500"></div> MED</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> CRIT</div>
                </div>
            </div>
        </div>
    );
});
