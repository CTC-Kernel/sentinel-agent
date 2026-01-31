import React, { memo } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Mock "Threat" points for visual ambiance
const visualThreats = [
    { coordinates: [2.3522, 48.8566], name: "Paris" }, // Paris
    { coordinates: [-74.006, 40.7128], name: "NY" }, // NY
    { coordinates: [139.6917, 35.6895], name: "Tokyo" }, // Tokyo
    { coordinates: [-0.1276, 51.5074], name: "London" }, // London
    { coordinates: [55.2708, 25.2048], name: "Dubai" }, // Dubai
    { coordinates: [103.8198, 1.3521], name: "Singapore" }, // Singapore
];

import { cn } from "../../lib/utils";

interface LandingMapProps {
    className?: string;
}

export const LandingMap: React.FC<LandingMapProps> = memo(({ className }) => {
    const [rotation, setRotation] = React.useState(0);

    React.useEffect(() => {
        let animationFrameId: number;

        const animate = () => {
            setRotation(r => (r + 0.04) % 360);
            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return (
        <div className={cn("w-full h-full absolute inset-0 opacity-40 pointer-events-none transition-opacity duration-1000", className)}>
            <ComposableMap
                projectionConfig={{ scale: 220, rotate: [rotation, -10, 0] }}
                style={{ width: "100%", height: "100%" }}
            >
                <ZoomableGroup center={[0, 0]}>
                    <Geographies geography={geoUrl}>
                        {({ geographies }) =>
                            geographies.map((geo) => (
                                <Geography
                                    key={geo.rsmKey || 'unknown'}
                                    geography={geo}
                                    className="fill-slate-300/80 dark:fill-slate-800/80 stroke-slate-400/60 dark:stroke-slate-700/60 outline-none transition-colors duration-700"
                                    style={{
                                        default: { outline: "none" },
                                        hover: { outline: "none" },
                                        pressed: { outline: "none" },
                                    }}
                                />
                            ))
                        }
                    </Geographies>

                    {/* Animated "Pulse" Markers */}
                    {visualThreats.map((marker, i) => (
                        <Marker key={`marker-${i || 'unknown'}`} coordinates={marker.coordinates as [number, number]}>
                            <circle r={2} fill="#94a3b8" className="animate-ping opacity-75" />
                            <circle r={1} fill="#e2e8f0" />
                        </Marker>
                    ))}
                </ZoomableGroup>
            </ComposableMap>

            {/* vignette overlay to blend edges - Reduced opacity for clarity */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(248,250,252,0)_100%)] dark:bg-[radial-gradient(circle_at_center,transparent_20%,rgba(2,6,23,0.8)_100%)] pointer-events-none" />
        </div>
    );
});
