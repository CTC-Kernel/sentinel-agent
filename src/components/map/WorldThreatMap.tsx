import React, { memo } from "react";
import {
    ComposableMap,
    Geographies,
    Geography,
    Marker,
    ZoomableGroup
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface MapProps {
    data: Array<{
        country: string; // ISO 3166-1 alpha-3 code or Name
        value: number; // Intensity
        markers: Array<{ coordinates: [number, number], name: string }>;
    }>;
    setTooltipContent: (content: string) => void;
}

// Sentinel Color Scale: Slate (Base) -> Blue (Mid) -> Orange (High) -> Red (Crit)
const colorScale = scaleLinear<string>()
    .domain([0, 2, 5, 10])
    .range(["#1e293b", "#3b82f6", "#f97316", "#ef4444"]);

export const WorldThreatMap: React.FC<MapProps> = memo(({ data, setTooltipContent }) => {
    return (
        <div className="w-full h-full bg-slate-950 rounded-[2.5rem] overflow-hidden relative isolate group">
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
                                    const cur = data.find((s) => s.country === countryName);
                                    const intensity = cur ? cur.value : 0;

                                    return (
                                        <Geography
                                            key={geo.rsmKey}
                                            geography={geo}
                                            fill={intensity > 0 ? colorScale(intensity) : "#0f172a"}
                                            stroke="#1e293b" // Grid lines
                                            strokeWidth={0.5}
                                            style={{
                                                default: { outline: "none", transition: "all 0.3s ease" },
                                                hover: { fill: "#0ea5e9", outline: "none", cursor: 'pointer', stroke: "#38bdf8", strokeWidth: 1, filter: "drop-shadow(0 0 5px rgba(14, 165, 233, 0.5))" },
                                                pressed: { fill: "#0284c7", outline: "none" },
                                            }}
                                            onMouseEnter={() => {
                                                setTooltipContent(`${countryName} • Threat Factor: ${intensity.toFixed(1)}`);
                                            }}
                                            onMouseLeave={() => {
                                                setTooltipContent("");
                                            }}
                                        />
                                    );
                                })
                            }
                        </Geographies>

                        {/* Markers for specific threats/events */}
                        {data.flatMap(d => d.markers).map((marker, i) => (
                            <Marker key={`${marker.name}-${i}`} coordinates={marker.coordinates} onMouseEnter={() => setTooltipContent(`THREAT: ${marker.name}`)} onMouseLeave={() => setTooltipContent("")}>
                                <g className="cursor-pointer group">
                                    {/* Radar Ping Effect */}
                                    <circle r={8} fill="none" stroke="hsl(var(--destructive))" strokeWidth={0.5} className="animate-[ping_3s_linear_infinite] opacity-50" />
                                    <circle r={4} fill="hsl(var(--destructive))" className="drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                </g>
                            </Marker>
                        ))}
                    </ZoomableGroup>
                </ComposableMap>
            </div>

            {/* Legend overlay */}
            <div className="absolute bottom-4 left-8 pointer-events-none">
                <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/5 shadow-xl">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-800"></div> SAFE</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div> LOW</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500"></div> MED</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> CRIT</div>
                </div>
            </div>
        </div>
    );
});
