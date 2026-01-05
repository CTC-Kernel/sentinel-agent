import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Sphere } from '@react-three/drei';
import * as THREE from 'three';

interface ThreatData {
    country: string;
    value: number;
    markers: Array<{ coordinates: [number, number], name: string }>;
}

interface ThreatPlanetProps {
    data: ThreatData[];
}

// Convert Lat/Lon to 3D position on sphere
const latLonToVector3 = (lat: number, lon: number, radius: number): THREE.Vector3 => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));
    return new THREE.Vector3(x, y, z);
};

const ThreatMarker: React.FC<{ position: THREE.Vector3; name: string; intensity: number }> = ({ position, name, intensity }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const beamRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (meshRef.current) {
            // Pulse base
            const scale = 1 + Math.sin(t * 3) * 0.3;
            meshRef.current.scale.setScalar(scale);
        }
        if (beamRef.current) {
            // Pulse beam height and opacity
            beamRef.current.scale.y = 1 + Math.sin(t * 2 + position.x) * 0.2;
            (beamRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 4) * 0.2;
        }
    });

    const color = intensity > 7 ? "#ef4444" : intensity > 4 ? "#f97316" : "#3b82f6";
    // Beam height proportional to intensity
    const beamHeight = 0.5 + (intensity / 10) * 1.5;

    // Look at center to orient the beam effectively outwards
    const lookAtPos = new THREE.Vector3(0, 0, 0);

    return (
        <group position={position} lookAt={lookAtPos}>
            {/* Rotate beam to point OUTWARDS from the sphere surface. 
                Default cylinder is Y-up. If we place it at surface and `lookAt(0,0,0)`, 
                the negative Z axis points to center. 
                We need positive Y axis to point AWAY from center.
                Actually simpler: Just place it, and rotate it locally if needed. 
                But `lookAt` with a group is easier. 
                However, `group.lookAt(0,0,0)` makes the group's positive Z point to 0,0,0. 
                So the "back" of the group points to center. 
                This means positive Z is "Inwards". Negative Z is "Outwards".
                We want the beam (Y-axis cylinder) to align with the normal.
                Wait, cleaner approach: Use a helper or just Quaternions.
                Or simpler: Just rely on position and `lookAt` logic is messy in head.
                
                Let's stick to world rotation approach in `ThreatScene` or just standard quaternion magic.
                Actually, simpler: Position is correct. Direction is Position.normalized().
            */}

            {/* Base Dot */}
            <mesh ref={meshRef}>
                <sphereGeometry args={[0.04, 16, 16]} />
                <meshBasicMaterial color={color} transparent opacity={0.9} />
            </mesh>

            {/* The Beam - We rotate it 90deg X to align with Z axis, then lookAt handles the rest? 
                No, let's just manually orient it. 
                position is the normal vector (normalized * radius).
            */}
            <mesh
                ref={beamRef}
                position={[0, 0, 0]} // Relative to group
                rotation={[Math.PI / 2, 0, 0]} // Align cylinder Y with Local Z (which points to center if we lookAt center?)
            // Actually let's use the lookAt hack:
            // If group looks at 0,0,0, its Z axis points TO the center.
            // So -Z points AWAY.
            // We want the cylinder along Z axis? No, cylinder is Y axis.
            // Rotate cylinder X=90 -> Cylinder is now along Z. 
            // So it points In/Out. 
            >
                <cylinderGeometry args={[0.02, 0.005, beamHeight, 8]} />
                <meshBasicMaterial color={color} transparent opacity={0.6} blending={THREE.AdditiveBlending} />
            </mesh>

            {hovered && (
                <Html distanceFactor={15}>
                    <div className="bg-slate-900/90 text-cyan-500 text-xs px-3 py-2 rounded-lg border border-cyan-500/30 whitespace-nowrap backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                        <div className="font-bold border-b border-cyan-500/30 mb-1 pb-0.5">{name}</div>
                        <div className="text-white font-mono text-[10px]">INTENSITY: {intensity.toFixed(1)}</div>
                        <div className="text-red-400 font-mono text-[10px] animate-pulse">LIVE SIGNAL</div>
                    </div>
                </Html>
            )}

            {/* Hitbox for hover */}
            <mesh onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)} visible={false}>
                <sphereGeometry args={[0.2, 8, 8]} />
            </mesh>
        </group>
    );
};

const ThreatScene: React.FC<{ data: ThreatData[] }> = ({ data }) => {
    const groupRef = useRef<THREE.Group>(null);

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.rotation.y += 0.0005; // Slow majestic rotation
        }
    });

    const markers = useMemo(() => {
        return data.flatMap(d => d.markers.map(m => ({
            ...m,
            intensity: d.value,
            vec3: latLonToVector3(m.coordinates[1], m.coordinates[0], 2.05)
        })));
    }, [data]);

    return (
        <group ref={groupRef}>
            {/* Core black void sphere to block background */}
            <Sphere args={[2, 64, 64]}>
                <meshBasicMaterial color="#000000" />
            </Sphere>

            {/* Earth Surface Texture/Mesh */}
            <Sphere args={[2.01, 64, 64]}>
                <meshStandardMaterial
                    color="#0f172a" // Slate-900
                    emissive="#1e3a8a" // Blue-900 glow
                    emissiveIntensity={0.2}
                    roughness={0.7}
                    metalness={0.6}
                />
            </Sphere>

            {/* Wireframe / Grid Layer */}
            <Sphere args={[2.02, 32, 32]}>
                <meshBasicMaterial
                    color="#0ea5e9" // Sky-500
                    wireframe
                    transparent
                    opacity={0.15}
                    blending={THREE.AdditiveBlending}
                />
            </Sphere>

            {/* Atmosphere Glow Halo */}
            <Sphere args={[2.2, 64, 64]}>
                <meshBasicMaterial
                    color="#38bdf8" // Sky-400
                    transparent
                    opacity={0.05}
                    side={THREE.BackSide}
                    blending={THREE.AdditiveBlending}
                />
            </Sphere>

            {markers.map((m, i) => (
                <ThreatMarker key={i} position={m.vec3} name={m.name} intensity={m.intensity} />
            ))}
        </group>
    );
};

export const ThreatPlanet: React.FC<ThreatPlanetProps> = ({ data }) => {
    return (
        <div className="w-full h-full bg-slate-950 rounded-[2.5rem] overflow-hidden relative isolate">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950/80 to-slate-950 z-0 pointer-events-none" />

            {/* HUD Overlay */}
            <div className="absolute top-6 left-8 z-10 pointer-events-none">
                <div className="text-cyan-500 text-xs font-mono mb-1 tracking-widest">SYSTEM STATUS</div>
                <div className="text-white text-xl font-bold tracking-tighter flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    ONLINE
                </div>
            </div>

            <Canvas camera={{ position: [0, 0, 7], fov: 45 }}>
                <ambientLight intensity={0.2} />
                <pointLight position={[15, 15, 15]} intensity={1} color="#38bdf8" />
                <pointLight position={[-10, -10, -5]} intensity={0.5} color="#c084fc" />

                <Stars radius={150} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />

                <ThreatScene data={data} />
                <OrbitControls enablePan={false} minDistance={4} maxDistance={10} enableZoom={true} />
            </Canvas>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 font-mono pointer-events-none flex gap-4">
                <span>ROTATION: AUTO</span>
                <span>GRID: ACTIVE</span>
                <span>THREATS: {data.reduce((acc, curr) => acc + curr.markers.length, 0)} DETECTED</span>
            </div>
        </div>
    );
};

