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

export const LandingMap: React.FC = memo(() => {
    const [rotation, setRotation] = React.useState(0);

    React.useEffect(() => {
        let animationFrameId: number;

        const animate = () => {
            setRotation(r => (r + 0.2) % 360);
            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return (
        <div className="w-full h-full absolute inset-0 opacity-40 pointer-events-none transition-opacity duration-1000">
            <ComposableMap
                projectionConfig={{ scale: 220, rotate: [rotation, -10, 0] }}
                style={{ width: "100%", height: "100%" }}
            >
                <ZoomableGroup center={[0, 0]} disablePanning disableZooming>
                    <Geographies geography={geoUrl}>
                        {({ geographies }) =>
                            geographies.map((geo) => (
                                <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    className="fill-slate-200 dark:fill-blue-500/5 stroke-slate-300 dark:stroke-blue-500/20 outline-none transition-colors duration-700"
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
                        <Marker key={i} coordinates={marker.coordinates as [number, number]}>
                            <circle r={2} fill="#3b82f6" className="animate-ping opacity-75" />
                            <circle r={1} fill="#ffffff" />
                        </Marker>
                    ))}
                </ZoomableGroup>
            </ComposableMap>

            {/* vignette overlay to blend edges */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(2,6,23,0.8)_100%)]" />
        </div>
    );
});
