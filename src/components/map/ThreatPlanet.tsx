import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
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
    const [hovered, setHovered] = useState(false);

    useFrame((state) => {
        if (meshRef.current) {
            // Pulse effect
            const t = state.clock.getElapsedTime();
            const scale = 1 + Math.sin(t * 3) * 0.3;
            meshRef.current.scale.setScalar(scale);
        }
    });

    return (
        <group position={position}>
            <mesh ref={meshRef} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshBasicMaterial color={intensity > 7 ? "#ef4444" : "#f59e0b"} transparent opacity={0.8} />
            </mesh>
            <mesh position={[0, 0, 0]}>
                <ringGeometry args={[0.1, 0.12, 32]} />
                <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.3} />
            </mesh>
            {/* Beam effect pointing out */}
            <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0]}>
                <cylinderGeometry args={[0.01, 0.01, 1, 8]} />
                <meshBasicMaterial color={intensity > 7 ? "#ef4444" : "#f59e0b"} transparent opacity={0.4} blending={THREE.AdditiveBlending} />
            </mesh>

            {hovered && (
                <Html distanceFactor={10}>
                    <div className="bg-black/80 text-white text-xs px-2 py-1 rounded border border-white/20 whitespace-nowrap backdrop-blur-md">
                        {name}
                    </div>
                </Html>
            )}
        </group>
    );
};



// We need a scene container that holds the planet and markers in the same coordinate system.
const ThreatScene: React.FC<{ data: ThreatData[] }> = ({ data }) => {
    const groupRef = useRef<THREE.Group>(null);

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.rotation.y += 0.001;
        }
    });

    const markers = useMemo(() => {
        return data.flatMap(d => d.markers.map(m => ({
            ...m,
            intensity: d.value,
            vec3: latLonToVector3(m.coordinates[1], m.coordinates[0], 2.05) // Radius slightly larger than planet
        })));
    }, [data]);

    return (
        <group ref={groupRef}>
            <mesh>
                <sphereGeometry args={[2, 64, 64]} />
                <meshStandardMaterial
                    color="#1e293b"
                    metalness={0.5}
                    roughness={0.7}
                    wireframe={false}
                />
                {/* Tech lines texture could be cool, for now simple dark globe */}
            </mesh>
            <mesh scale={[2.01, 2.01, 2.01]}>
                <sphereGeometry args={[1, 64, 64]} />
                <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.05} />
            </mesh>

            {markers.map((m) => (
                <ThreatMarker key={m.name} position={m.vec3} name={m.name} intensity={m.intensity} />
            ))}
        </group>
    );
};

export const ThreatPlanet: React.FC<ThreatPlanetProps> = ({ data }) => {
    return (
        <div className="w-full h-[500px] bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden relative cursor-move">
            <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                <ThreatScene data={data} />

                <OrbitControls enablePan={false} minDistance={3} maxDistance={10} autoRotate={false} />
            </Canvas>
            <div className="absolute bottom-4 left-4 text-xs text-slate-400 pointer-events-none">
                Double-click to reset view • Drag to rotate
            </div>
        </div>
    );
};
