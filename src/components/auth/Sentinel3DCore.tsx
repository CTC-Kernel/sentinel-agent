import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float } from '@react-three/drei';
import * as THREE from 'three';

const PARTICLE_COUNT = 6000;

// Seeded random number generator for consistent particle generation
class SeededRandom {
    private seed: number;

    constructor(seed: number = 12345) {
        this.seed = seed;
    }

    next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}

const CyberneticBrain: React.FC = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const glowRef = useRef<THREE.PointLight>(null!);

    const particles = useMemo(() => {
        const temp: { x: number; y: number; z: number; scale: number; type: 'surface' | 'sulci' | 'internal' }[] = [];
        const random = new SeededRandom();

        // Realistic brain shape using superellipsoid with anatomical modifications
        const brainShape = (u: number, v: number, side: 1 | -1): [number, number, number] => {
            // Spherical base coordinates
            const theta = u * Math.PI; // 0 to PI (top to bottom)
            const phi = v * Math.PI * 2; // 0 to 2*PI (full rotation around)

            // Base ellipsoid for brain shape
            let x = Math.sin(theta) * Math.cos(phi);
            let y = Math.cos(theta);
            let z = Math.sin(theta) * Math.sin(phi);

            // Scale to brain proportions
            x *= 1.35; // Width
            y *= 1.0;  // Height
            z *= 1.55; // Depth (front to back)

            // Apply hemisphere side
            x = Math.abs(x) * side;

            // Central longitudinal fissure - the gap between hemispheres
            const fissureWidth = 0.12;
            x += fissureWidth * side;

            // Deepen fissure at top
            if (y > 0 && Math.abs(x) < 0.3) {
                y -= 0.15 * (1 - Math.abs(x) / 0.3) * (y / 1.0);
            }

            // FRONTAL LOBE - rounded bulge at front
            if (z > 0.6) {
                const frontalFactor = Math.exp(-((x * x) / 0.8 + (y - 0.1) * (y - 0.1) / 0.6));
                z += 0.25 * frontalFactor;
                // Round the front
                x *= 1 - 0.1 * frontalFactor;
            }

            // TEMPORAL LOBES - bulges on the sides, below and forward
            if (y < 0.1 && y > -0.8) {
                const temporalZ = z > -0.2 && z < 1.0;
                if (temporalZ) {
                    const temporalFactor = Math.exp(-((y + 0.35) * (y + 0.35)) / 0.12);
                    const zFactor = Math.exp(-((z - 0.3) * (z - 0.3)) / 0.5);
                    x += side * 0.2 * temporalFactor * zFactor;
                    // Temporal pole - forward extension
                    if (z > 0.5 && y < -0.1) {
                        z += 0.15 * temporalFactor;
                    }
                }
            }

            // PARIETAL LOBE - top back area, slight dome
            if (y > 0.2 && z < 0.3 && z > -0.8) {
                const parietalFactor = Math.exp(-((z + 0.2) * (z + 0.2)) / 0.4);
                y += 0.08 * parietalFactor;
            }

            // OCCIPITAL LOBE - back of brain, slightly pointed
            if (z < -0.7) {
                const occipitalFactor = Math.exp(-((x * x) / 0.3 + (y * y) / 0.4));
                z -= 0.2 * occipitalFactor;
                // Slight vertical compression at back
                y *= 1 - 0.1 * occipitalFactor;
            }

            // CEREBELLUM - smaller structure at back bottom
            if (y < -0.4 && z < -0.3) {
                const cerebellumFactor = Math.exp(-((y + 0.7) * (y + 0.7) + (z + 0.7) * (z + 0.7)) / 0.2);
                y -= 0.18 * cerebellumFactor;
                x *= 1 + 0.15 * cerebellumFactor;
                // Separate from main brain slightly
                if (y > -0.6) {
                    y -= 0.05 * cerebellumFactor;
                }
            }

            // BRAIN STEM hint - connects at bottom center back
            if (y < -0.6 && Math.abs(x) < 0.25 && z < 0 && z > -0.6) {
                const stemFactor = (1 - Math.abs(x) / 0.25) * Math.exp(-((z + 0.3) * (z + 0.3)) / 0.15);
                y -= 0.2 * stemFactor;
            }

            // GYRI AND SULCI - brain wrinkles
            // Multiple overlapping sine waves for realistic folding pattern
            const wrinkle1 = Math.sin(theta * 16 + phi * 6) * 0.04;
            const wrinkle2 = Math.sin(theta * 10 - phi * 8) * 0.035;
            const wrinkle3 = Math.sin(theta * 22 + phi * 14) * 0.02;
            const wrinkle4 = Math.sin(theta * 7 + phi * 4) * 0.025;

            // Reduce wrinkles at poles
            const wrinkleFade = Math.sin(theta) * (0.3 + 0.7 * Math.sin(phi));
            const totalWrinkle = (wrinkle1 + wrinkle2 + wrinkle3 + wrinkle4) * wrinkleFade;

            // Apply wrinkles radially outward
            const dist = Math.sqrt(x * x + y * y + z * z);
            if (dist > 0.1) {
                x += (x / dist) * totalWrinkle;
                y += (y / dist) * totalWrinkle;
                z += (z / dist) * totalWrinkle;
            }

            // LATERAL SULCUS (Sylvian fissure) - major groove on sides
            if (Math.abs(x) > 0.5 && y < 0.15 && y > -0.4 && z > -0.4 && z < 0.7) {
                const sylvianDepth = 0.06 * Math.exp(-((y + 0.1) * (y + 0.1)) / 0.03);
                const sylvianZ = Math.exp(-((z - 0.15) * (z - 0.15)) / 0.3);
                x -= side * sylvianDepth * sylvianZ;
            }

            // CENTRAL SULCUS - vertical groove separating frontal and parietal
            if (y > -0.2 && Math.abs(z) < 0.25) {
                const centralDepth = 0.05 * Math.exp(-(z * z) / 0.04);
                y -= centralDepth * Math.abs(Math.sin(theta * 2));
            }

            return [x, y, z];
        };

        // Generate dense surface particles
        for (let i = 0; i < PARTICLE_COUNT * 0.85; i++) {
            const side = (i % 2 === 0 ? 1 : -1) as 1 | -1;

            // Better distribution using stratified sampling
            const gridSize = Math.sqrt(PARTICLE_COUNT * 0.85 / 2);
            const ui = Math.floor(i / 2 / gridSize) / gridSize;
            const vi = (i / 2 % gridSize) / gridSize;

            const u = ui + (random.next() - 0.5) * (1 / gridSize);
            const v = vi + (random.next() - 0.5) * (1 / gridSize);

            const [x, y, z] = brainShape(
                Math.max(0.02, Math.min(0.98, u)),
                Math.max(0.02, Math.min(0.98, v)),
                side
            );

            // Small random offset for organic look
            const noise = 0.012;
            temp.push({
                x: x + (random.next() - 0.5) * noise,
                y: y + (random.next() - 0.5) * noise,
                z: z + (random.next() - 0.5) * noise,
                scale: 0.032 + random.next() * 0.018,
                type: 'surface'
            });
        }

        // Add particles in sulci (grooves) for depth
        for (let i = 0; i < PARTICLE_COUNT * 0.1; i++) {
            const side = (random.next() > 0.5 ? 1 : -1) as 1 | -1;
            const u = random.next();
            const v = random.next();

            const [x, y, z] = brainShape(u, v, side);

            // Push slightly inward to create depth in grooves
            const inwardFactor = 0.92 + random.next() * 0.04;
            temp.push({
                x: x * inwardFactor,
                y: y * inwardFactor,
                z: z * inwardFactor,
                scale: 0.022 + random.next() * 0.012,
                type: 'sulci'
            });
        }

        // Internal glow particles
        for (let i = 0; i < PARTICLE_COUNT * 0.05; i++) {
            const side = (random.next() > 0.5 ? 1 : -1) as 1 | -1;
            const r = Math.pow(random.next(), 0.6) * 0.6;
            const theta = random.next() * Math.PI;
            const phi = random.next() * Math.PI;

            const x = (r * Math.sin(theta) * Math.cos(phi) * 0.8 + 0.15) * side;
            const y = r * Math.cos(theta) * 0.7;
            const z = r * Math.sin(theta) * Math.sin(phi) * 1.0;

            temp.push({
                x,
                y,
                z,
                scale: 0.025 + random.next() * 0.02,
                type: 'internal'
            });
        }

        return temp;
    }, []);

    const dummy = useMemo(() => new THREE.Object3D(), []);
    const colors = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

    useLayoutEffect(() => {
        if (!meshRef.current) return;

        const color = new THREE.Color();
        const random = new SeededRandom();

        // Initialize all to invisible
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }

        // Set particles
        particles.forEach((particle, i) => {
            dummy.position.set(particle.x, particle.y, particle.z);
            dummy.scale.set(particle.scale, particle.scale, particle.scale);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);

            // Anatomically-inspired coloring
            if (particle.type === 'internal') {
                // Neural activity - blues and cyans
                const r = random.next();
                if (r > 0.6) color.set('#38bdf8'); // Sky blue
                else if (r > 0.3) color.set('#818cf8'); // Indigo
                else color.set('#c084fc'); // Purple
            } else if (particle.type === 'sulci') {
                // Deeper tissue - darker pinks/mauves
                const r = random.next();
                if (r > 0.5) color.set('#a78bfa'); // Violet
                else color.set('#c4b5fd'); // Light violet
            } else {
                // Brain surface - realistic pinkish-gray tones
                const r = random.next();
                if (r > 0.75) color.set('#fda4af'); // Rose
                else if (r > 0.5) color.set('#f9a8d4'); // Pink
                else if (r > 0.25) color.set('#f0abfc'); // Fuchsia light
                else color.set('#e9d5ff'); // Purple light
            }

            color.toArray(colors, i * 3);
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
    }, [particles, dummy, colors]);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();

        if (meshRef.current) {
            meshRef.current.rotation.y = time * 0.1;
            meshRef.current.rotation.x = Math.sin(time * 0.2) * 0.05;
        }

        if (glowRef.current) {
            glowRef.current.intensity = 1.0 + Math.sin(time * 2) * 0.3;
        }
    });

    return (
        <group scale={0.75}>
            <Float speed={0.8} rotationIntensity={0.05} floatIntensity={0.1}>
                <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial
                        vertexColors
                        toneMapped={false}
                        emissive="#ec4899"
                        emissiveIntensity={0.2}
                        roughness={0.5}
                        metalness={0.1}
                    />
                </instancedMesh>
            </Float>

            {/* Lighting */}
            <pointLight ref={glowRef} position={[0, 0, 0]} color="#f472b6" intensity={1.0} distance={4} decay={2} />
            <pointLight position={[1.5, 1, 1]} color="#fda4af" intensity={0.6} distance={4} decay={2} />
            <pointLight position={[-1.5, 1, 1]} color="#c4b5fd" intensity={0.6} distance={4} decay={2} />
            <pointLight position={[0, -1, -1]} color="#38bdf8" intensity={0.4} distance={3} decay={2} />
        </group>
    );
};

const Sentinel3DCore: React.FC = () => {
    return (
        <div className="w-full h-full absolute inset-0 z-0">
            <Canvas
                camera={{ position: [0, 0.2, 4.8], fov: 42 }}
                dpr={[1, 2]}
                gl={{ alpha: true, antialias: true }}
                style={{ background: 'transparent' }}
            >
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
                <directionalLight position={[-3, 2, -3]} intensity={0.4} color="#fce7f3" />

                <CyberneticBrain />

                <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    autoRotate
                    autoRotateSpeed={0.3}
                    minPolarAngle={Math.PI / 2.8}
                    maxPolarAngle={Math.PI / 1.8}
                    enableDamping
                    dampingFactor={0.05}
                />
            </Canvas>
        </div>
    );
};

export default Sentinel3DCore;
