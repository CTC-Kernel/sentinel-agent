import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Sphere } from '@react-three/drei';
import { AlertTriangle } from '../ui/Icons';
import * as THREE from 'three';
import { EarthCountries } from './EarthCountries';

// --- THEME CONSTANTS (Tailwind Mapped) ---
// Extracted to avoid hardcoded magic strings and align with design system
const THEME = {
 colors: {
 slate950: '#020617', // bg-background
 slate900: '#0f172a', // bg-card
 slate500: '#64748b', // text-muted-foreground
 blue900: '#1e3a8a', // blue-900 (emissive)
 sky500: '#0ea5e9', // sky-500 (grid)
 sky400: '#38bdf8', // sky-400 (glow)
 purple400: '#c084fc', // purple-400 (light)
 red500: '#ef4444', // red-500 (critical)
 orange500: '#f97316' // orange-500 (warning)
 }
};

interface ThreatData {
 country: string;
 value: number;
 markers: Array<{ coordinates: [number, number], name: string, type?: string, severity?: string }>;
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

// Optimized Marker Component
const ThreatMarker = React.memo(({ position, name, intensity, country, type, severity, markerRef, beamRef }: {
 position: THREE.Vector3;
 name: string;
 intensity: number;
 country: string;
 type?: string;
 severity?: string;
 markerRef: React.Ref<THREE.Mesh>;
 beamRef: React.Ref<THREE.Mesh>;
}) => {
 const [hovered, setHovered] = useState(false);

 const isHigh = intensity > 5 || severity === 'Critical';
 const color = isHigh ? THEME.colors.red500 : THEME.colors.orange500;
 const beamHeight = 0.5 + (intensity / 10) * 2.5;

 // Orient group to face center (so Y axis points OUT)
 const lookAtPos = useMemo(() => new THREE.Vector3(0, 0, 0), []);

 return (
 <group position={position} lookAt={lookAtPos}>
 {/* Base Ring (Country Highlight Effect) - Static */}
 <mesh rotation={[Math.PI / 2, 0, 0]}>
 <ringGeometry args={[0.08, 0.12, 32]} />
 <meshBasicMaterial color={color} opacity={0.3} transparent side={THREE.DoubleSide} />
 </mesh>

 {/* Base Dot - Animated via Ref */}
 <mesh ref={markerRef}>
 <sphereGeometry args={[0.05, 16, 16]} />
 <meshBasicMaterial color={color} transparent opacity={0.9} />
 </mesh>

 {/* The Beam - Animated via Ref */}
 <mesh
 ref={beamRef}
 rotation={[Math.PI / 2, 0, 0]}
 position={[0, 0, beamHeight / 2 * -1]}
 >
 <cylinderGeometry args={[0.02, 0.01, beamHeight, 8]} />
 <meshBasicMaterial color={color} transparent opacity={0.6} blending={THREE.AdditiveBlending} />
 </mesh>

 {/* Tooltip - Managed via Html */}
 {hovered && (
 <Html distanceFactor={10} zIndexRange={[100, 0]}>
  <div
  role="tooltip"
  className="bg-card/95 text-white min-w-[240px] p-3 rounded-3xl border border-border/40 shadow-2xl backdrop-blur-xl select-none pointer-events-none transform -translate-x-1/2 -translate-y-[120%] mb-2"
  >
  {/* Header */}
  <div className="flex justify-between items-start mb-2 pb-2 border-b border-border/40">
  <div className="font-bold text-sm tracking-wide">{country}</div>
  <div className="flex items-center gap-1.5">
  <span className={`relative flex h-2 w-2`}>
   <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isHigh ? 'bg-red-500' : 'bg-orange-500'}`}></span>
   <span className={`relative inline-flex rounded-full h-2 w-2 ${isHigh ? 'bg-red-500' : 'bg-orange-500'}`}></span>
  </span>
  <span className={`text-[11px] font-mono font-bold tracking-wider ${isHigh ? 'text-red-400' : 'text-orange-400'}`}>{severity ? severity.toUpperCase() : (isHigh ? 'CRITICAL' : 'WARNING')}</span>
  </div>
  </div>

  {/* Content */}
  <div className="flex items-start gap-3 mb-2">
  <div className={`mt-0.5 p-1 rounded-md ${isHigh ? 'bg-red-50' : 'bg-orange-500/10'} border ${isHigh ? 'border-red-500/20' : 'border-orange-500/20'}`}>
  <AlertTriangle className={`w-3.5 h-3.5 ${isHigh ? 'text-red-500' : 'text-orange-500'}`} />
  </div>
  <div>
  <div className="text-[11px] uppercase text-muted-foreground font-bold mb-0.5">{type || 'Threat Detected'}</div>
  <div className="text-xs text-muted-foreground/60 font-medium leading-snug">{name}</div>
  </div>
  </div>

  {/* Footer Stats */}
  <div className="flex gap-2 mt-2 pt-2 border-t border-white/5 bg-white/5 -mx-3 -mb-3 px-3 pb-3 rounded-b-xl">
  <div className="flex-1">
  <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Intensity</div>
  <div className="text-sm font-mono font-bold text-white">{intensity.toFixed(1)}</div>
  </div>
  <div className="flex-1 text-right">
  <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Status</div>
  <div className="text-sm font-mono font-bold text-emerald-400">ACTIVE</div>
  </div>
  </div>
  </div>
 </Html>
 )}

 {/* Hitbox */}
 <mesh
 onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
 onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
 visible={false}
 >
 <sphereGeometry args={[0.3, 8, 8]} />
 </mesh>
 </group>
 );
});

const ThreatScene: React.FC<{ data: ThreatData[] }> = ({ data }) => {
 const groupRef = useRef<THREE.Group>(null);

 // Store refs for all markers to animate them in a single loop
 const markerRefs = useRef<Array<{ mesh: THREE.Mesh | null, beam: THREE.Mesh | null, position: THREE.Vector3 }>>([]);

 const markers = useMemo(() => {
 return data.flatMap(d => d.markers.map(m => ({
 ...m,
 intensity: d.value,
 country: d.country,
 vec3: latLonToVector3(m.coordinates[1], m.coordinates[0], 2.05)
 })));
 }, [data]);

 // Cleanup refs when markers change
 useEffect(() => {
 markerRefs.current = markerRefs.current.slice(0, markers.length);
 }, [markers]);

 useFrame((state) => {
 const t = state.clock.getElapsedTime();

 // Rotate Earth
 if (groupRef.current) {
 groupRef.current.rotation.y += 0.0005;
 }

 // Optimized Animation Loop:
 // Use for-loop instead of forEach for better performance with large arrays in render loop
 const refs = markerRefs.current;
 for (let i = 0; i < refs.length; i++) {
 const ref = refs[i];
 if (!ref) continue;

 const sineWave = Math.sin(t * 3);

 if (ref.mesh) {
 const scale = 1 + sineWave * 0.3;
 ref.mesh.scale.setScalar(scale);
 }
 if (ref.beam) {
 // Pulse beam height and opacity
 ref.beam.scale.y = 1 + Math.sin(t * 2 + ref.position.x) * 0.2;
 if (ref.beam.material instanceof THREE.MeshBasicMaterial) {
  ref.beam.material.opacity = 0.5 + Math.sin(t * 4) * 0.2;
 }
 }
 }
 });

 return (
 <group ref={groupRef}>
 {/* Core black void sphere to block background */}
 <Sphere args={[2, 64, 64]}>
 <meshBasicMaterial color={THEME.colors.slate950} />
 </Sphere>

 {/* Earth Surface Texture/Mesh */}
 <Sphere args={[2.01, 64, 64]}>
 <meshStandardMaterial
  color={THEME.colors.slate900}
  emissive={THEME.colors.blue900}
  emissiveIntensity={0.2}
  roughness={0.7}
  metalness={0.6}
 />
 </Sphere>

 {/* Wireframe / Grid Layer */}
 <Sphere args={[2.02, 32, 32]}>
 <meshBasicMaterial
  color={THEME.colors.sky500}
  wireframe
  transparent
  opacity={0.15}
  blending={THREE.AdditiveBlending}
 />
 </Sphere>

 {/* Country Borders */}
 <EarthCountries color={THEME.colors.sky400} />

 {/* Atmosphere Glow Halo */}
 <Sphere args={[2.2, 64, 64]}>
 <meshBasicMaterial
  color={THEME.colors.sky400}
  transparent
  opacity={0.05}
  side={THREE.BackSide}
  blending={THREE.AdditiveBlending}
 />
 </Sphere>

 {markers.map((m, i) => {
 return (
  <ThreatMarker
  key={i || 'unknown'}
  position={m.vec3}
  name={m.name}
  intensity={m.intensity}
  country={m.country}
  type={m.type}
  severity={m.severity}
  markerRef={(el) => {
  if (!markerRefs.current[i]) markerRefs.current[i] = { mesh: el, beam: null, position: m.vec3 };
  else markerRefs.current[i].mesh = el;
  if (markerRefs.current[i]) markerRefs.current[i].position = m.vec3;
  }}
  beamRef={(el) => {
  if (!markerRefs.current[i]) markerRefs.current[i] = { mesh: null, beam: el, position: m.vec3 };
  else markerRefs.current[i].beam = el;
  }}
  />
 );
 })}
 </group>
 );
};

export const ThreatPlanet: React.FC<ThreatPlanetProps> = ({ data }) => {
 return (
 <div
 className="w-full h-full bg-background rounded-3xl overflow-hidden relative isolate"
 role="region"
 aria-label="Interactive 3D Threat Map"
 >
 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950/80 to-slate-950 z-0 pointer-events-none" />

 {/* HUD Overlay */}
 <div className="absolute top-6 left-8 z-10 pointer-events-none" aria-hidden="true">
 <div className="text-cyan-500 text-xs font-mono mb-1 tracking-widest">SYSTEM STATUS</div>
 <div className="text-white text-xl font-bold tracking-tighter flex items-center gap-2">
  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
  ONLINE
 </div>
 </div>

 <Canvas camera={{ position: [0, 0, 7], fov: 45 }} aria-label="3D Globe showing active cyber threats">
 <ambientLight intensity={0.2} />
 <pointLight position={[15, 15, 15]} intensity={1} color={THEME.colors.sky400} />
 <pointLight position={[-10, -10, -5]} intensity={0.5} color={THEME.colors.purple400} />

 <Stars radius={150} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />

 <ThreatScene data={data} />
 <OrbitControls enablePan={false} minDistance={4} maxDistance={10} enableZoom={true} />
 </Canvas>

 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground font-mono pointer-events-none flex gap-4" aria-hidden="true">
 <span>ROTATION: AUTO</span>
 <span>GRID: ACTIVE</span>
 <span>THREATS: {data.reduce((acc, curr) => acc + curr.markers.length, 0)} DETECTED</span>
 </div>
 </div>
 );
};

