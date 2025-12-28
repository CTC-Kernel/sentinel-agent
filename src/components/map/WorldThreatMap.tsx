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

const colorScale = scaleLinear<string>()
    .domain([0, 10])
    .range(["hsl(var(--border))", "hsl(var(--destructive))"]); // Light grey to Red

export const WorldThreatMap: React.FC<MapProps> = memo(({ data, setTooltipContent }) => {
    return (
        <div className="w-full h-[500px] bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden relative">
            <ComposableMap projectionConfig={{ scale: 200 }} width={980} height={500} style={{ width: "100%", height: "100%" }}>
                <ZoomableGroup>
                    <Geographies geography={geoUrl}>
                        {({ geographies }) =>
                            geographies.map((geo) => {
                                // Try to match data by country name or properties
                                const countryName = geo.properties.name;
                                // Mock intensity for demo if not found
                                const cur = data.find((s) => s.country === countryName);
                                const intensity = cur ? cur.value : 0;

                                return (
                                    <Geography
                                        key={geo.rsmKey}
                                        geography={geo}
                                        fill={intensity > 0 ? colorScale(intensity) : "hsl(var(--muted) / 0.5)"}
                                        stroke="hsl(var(--card))"
                                        strokeWidth={0.5}
                                        style={{
                                            default: { outline: "none" },
                                            hover: { fill: "hsl(var(--destructive))", outline: "none", cursor: 'pointer' },
                                            pressed: { fill: "hsl(var(--destructive) / 0.8)", outline: "none" },
                                        }}
                                        onMouseEnter={() => {
                                            setTooltipContent(`${countryName} - Threat Level: ${intensity}`);
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
                    {data.flatMap(d => d.markers).map((marker) => (
                        <Marker key={marker.name} coordinates={marker.coordinates}>
                            <circle r={3} fill="hsl(var(--destructive))" stroke="hsl(var(--background))" strokeWidth={1} style={{ animation: 'pulse 2s infinite' }} className="animate-pulse" />
                            <text
                                textAnchor="middle"
                                y={-10}
                                className="font-sans fill-muted-foreground text-[8px] font-bold"
                            >
                                {marker.name}
                            </text>
                        </Marker>
                    ))}
                </ZoomableGroup>
            </ComposableMap>

            {/* Legend overlay */}
            <div className="absolute bottom-4 left-4 bg-white/80 dark:bg-black/50 backdrop-blur-md p-3 rounded-lg border border-slate-200 dark:border-white/10 text-xs">
                <div className="font-bold mb-2">Threat Intensity</div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-sm"></div> High
                    <div className="w-3 h-3 bg-slate-200 rounded-sm ml-2"></div> Low/None
                </div>
            </div>
        </div>
    );
});
