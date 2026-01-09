
import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Html, Text, Line } from '@react-three/drei';
import { Group, Mesh, MeshPhysicalMaterial, DoubleSide, AdditiveBlending } from 'three';
import { animated, useSpring, config } from '@react-spring/three';
import { VoxelNode, Risk, Project, Incident } from '../../types';
import { VoxelDetailOverlay } from '../VoxelDetailOverlay';
import { useModelLibrary } from '../../hooks/useModelLibrary';
import { MODEL_LIBRARY_CONFIG } from '../../context/modelLibraryConstants';
import { GlassMaterial, EdgesWithColor } from './VoxelMaterials';

// Helper
const safeRender = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toLocaleDateString();
    if (typeof value === 'object' && value !== null) {
        const val = value as { seconds?: number; nanoseconds?: number };
        if (val.seconds !== undefined && val.nanoseconds !== undefined) {
            return new Date(val.seconds * 1000).toLocaleDateString();
        }
        return '';
    }
    return String(value);
};

const DynamicConnectorLine: React.FC<{
    startPos: [number, number, number];
    baseEndPos: [number, number, number];
    offset: { x: number; y: number };
}> = ({ startPos, baseEndPos }) => {
    return (
        <>
            <Line
                points={[startPos, baseEndPos]}
                color="white"
                opacity={0.3}
                transparent
                lineWidth={2}
            />
            <mesh position={baseEndPos}>
                <sphereGeometry args={[0.1]} />
                <meshBasicMaterial color="white" transparent opacity={0.7} />
            </mesh>
        </>
    );
};

const VoxelModelGeometry: React.FC<{
    node: VoxelNode;
    libraryPrimitive: Group | null;
    sharedMaterialProps: React.ComponentProps<'meshPhysicalMaterial'>;
    emissiveColor: string;
    opacity: number;
    xRayMode: boolean;
}> = React.memo(({ node, libraryPrimitive, sharedMaterialProps, emissiveColor, opacity, xRayMode }) => {
    if (libraryPrimitive) {
        return <primitive object={libraryPrimitive} />;
    }

    // Fallback Geometries
    switch (node.type) {
        case 'asset':
            return (
                <>
                    <mesh position={[0, -node.size * 0.2, 0]}>
                        <boxGeometry args={[node.size * 0.9, node.size * 0.25, node.size * 0.6]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, 0, 0]}>
                        <boxGeometry args={[node.size * 0.75, node.size * 0.2, node.size * 0.5]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <boxGeometry args={[node.size * 0.55, node.size * 0.18, node.size * 0.4]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    {[-0.25, 0.25].map(offset => (
                        <mesh key={`asset-light-${node.id}-${offset}`} position={[offset * node.size, node.size * 0.28, node.size * 0.18]}>
                            <boxGeometry args={[node.size * 0.08, node.size * 0.06, node.size * 0.02]} />
                            <meshBasicMaterial color="#facc15" transparent opacity={0.8} />
                        </mesh>
                    ))}
                </>
            );
        case 'risk':
            return (
                <>
                    <mesh rotation={[0, 0, Math.PI / 4]}>
                        <octahedronGeometry args={[node.size * 0.6, 0]} />
                        <GlassMaterial {...sharedMaterialProps} metalness={0.2} roughness={0.35} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    {[0, 1, 2, 3].map(index => {
                        const angle = (Math.PI / 2) * index;
                        return (
                            <mesh
                                key={`risk-spike-${node.id}-${index}`}
                                position={[Math.cos(angle) * node.size * 0.55, 0, Math.sin(angle) * node.size * 0.55]}
                                rotation={[Math.PI / 2, angle, 0]}
                            >
                                <coneGeometry args={[node.size * 0.15, node.size * 0.45, 8]} />
                                <GlassMaterial
                                    color="#f97316"
                                    emissive="#fb923c"
                                    emissiveIntensity={0.8}
                                    opacity={opacity}
                                    transparent
                                    wireframe={Boolean(xRayMode)}
                                />
                                <EdgesWithColor color={emissiveColor} />
                            </mesh>
                        );
                    })}
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[node.size * 0.55, node.size * 0.05, 16, 32]} />
                        <GlassMaterial color="#f97316" emissive="#fb923c" emissiveIntensity={0.5} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
                    </mesh>
                </>
            );
        case 'project':
            return (
                <>
                    <mesh position={[0, -node.size * 0.18, 0]}>
                        <cylinderGeometry args={[node.size * 0.7, node.size * 0.7, node.size * 0.18, 24]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.05, 0]}>
                        <cylinderGeometry args={[node.size * 0.5, node.size * 0.5, node.size * 0.35, 24]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.32, 0]}>
                        <cylinderGeometry args={[node.size * 0.18, node.size * 0.18, node.size * 0.7, 12]} />
                        <GlassMaterial color="#fcd34d" emissive="#fbbf24" emissiveIntensity={0.8} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, node.size * 0.05, 0]}>
                        <ringGeometry args={[node.size * 0.55, node.size * 0.58, 32]} />
                        <meshBasicMaterial color="#c084fc" transparent opacity={0.6} side={DoubleSide} />
                    </mesh>
                </>
            );
        case 'audit':
            return (
                <>
                    <mesh rotation={[-Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[node.size * 0.6, node.size * 0.1, 24, 48]} />
                        <GlassMaterial {...sharedMaterialProps} metalness={0.5} roughness={0.2} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <boxGeometry args={[node.size * 0.75, node.size * 0.04, node.size * 0.55]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.06, 0]}>
                        <boxGeometry args={[node.size * 0.22, node.size * 0.25, node.size * 0.06]} />
                        <GlassMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.7} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[node.size * 0.35, node.size * 0.05, node.size * 0.2]}>
                        <torusGeometry args={[node.size * 0.12, node.size * 0.03, 16, 32]} />
                        <meshBasicMaterial color="#f8fafc" transparent opacity={0.6} />
                    </mesh>
                </>
            );
        case 'incident':
            return (
                <>
                    <mesh>
                        <sphereGeometry args={[node.size * 0.55, 28, 28]} />
                        <GlassMaterial {...sharedMaterialProps} metalness={0.15} roughness={0.35} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[node.size * 0.75, node.size * 0.08, 24, 48]} />
                        <GlassMaterial color="#fb7185" emissive="#f43f5e" emissiveIntensity={0.8} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
                    </mesh>
                    <mesh position={[0, node.size * 0.55, 0]}>
                        <coneGeometry args={[node.size * 0.2, node.size * 0.5, 12]} />
                        <GlassMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.9} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[node.size * 0.45, 0, 0]} rotation={[0, 0, Math.PI / 6]}>
                        <boxGeometry args={[node.size * 0.2, node.size * 0.4, node.size * 0.04]} />
                        <GlassMaterial color="#fee2e2" emissive="#fecaca" emissiveIntensity={0.6} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                </>
            );
        case 'supplier':
            return (
                <>
                    <mesh position={[0, -node.size * 0.12, 0]}>
                        <cylinderGeometry args={[node.size * 0.45, node.size * 0.45, node.size * 0.35, 20]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.22, 0]}>
                        <coneGeometry args={[node.size * 0.55, node.size * 0.75, 20]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    {[...Array(6)].map((_, index) => {
                        const angle = (Math.PI * 2 * index) / 6;
                        return (
                            <mesh key={`supplier-node-${node.id}-${index}`} position={[Math.cos(angle) * node.size * 0.8, node.size * 0.12, Math.sin(angle) * node.size * 0.8]}>
                                <sphereGeometry args={[node.size * 0.12, 16, 16]} />
                                <GlassMaterial color="#4ade80" emissive="#22c55e" emissiveIntensity={0.6} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
                            </mesh>
                        );
                    })}
                </>
            );
        default: {
            return (
                <mesh>
                    <boxGeometry args={[node.size || 1, node.size || 1, node.size || 1]} />
                    <GlassMaterial {...sharedMaterialProps} />
                    <EdgesWithColor color={emissiveColor} />
                </mesh>
            );
        }
    }
});

export const VoxelMesh: React.FC<{
    node: VoxelNode;
    onClick: (node: VoxelNode) => void;
    isSelected: boolean;
    isDimmed: boolean;
    isHighlighted: boolean;
    highlightCritical?: boolean;
    xRayMode?: boolean;
    opacity?: number;
    overlayProps?: React.ComponentProps<typeof VoxelDetailOverlay>;
    overlayOffset?: { x: number; y: number };
    isImpacted?: boolean;
}> = React.memo(({
    node,
    onClick,
    isSelected,
    isDimmed,
    isHighlighted,
    highlightCritical,
    xRayMode,
    opacity,
    overlayProps,
    overlayOffset = { x: 0, y: 0 },
    isImpacted,
}) => {
    const modelLibrary = useModelLibrary();
    const meshRef = useRef<Group>(null);
    const [hovered, setHovered] = useState(false);

    const isCritical = useMemo(() => {
        if (node.type === 'risk') {
            return (node.data as Risk).score >= 15;
        }
        if (node.type === 'incident') {
            return (node.data as Incident).severity === 'Critique';
        }
        if (node.type === 'project') {
            return ((node.data as Project).status || '').toLowerCase().includes('retard');
        }
        return false;
    }, [node]);

    const usesLibraryModel = Boolean(MODEL_LIBRARY_CONFIG[node.type]);
    const labelVisible = hovered || isSelected || isHighlighted;
    const targetScale = isSelected ? 1.3 : (hovered || isHighlighted || isImpacted) ? 1.15 : 1;

    // Spring animation for smooth scale transitions without managing state manually in useFrame
    const { scale } = useSpring({
        scale: targetScale,
        config: config.wobbly
    });

    useFrame(() => {
        // Only keep rotation for non-assets
        if (meshRef.current && node.type !== 'asset') {
            meshRef.current.rotation.y += 0.005;
        }
    });

    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick(node);
    };

    const handlePointerOver = useCallback((e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        setHovered(true);
        if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
    }, []);
    const handlePointerOut = useCallback(() => {
        setHovered(false);
        if (typeof document !== 'undefined') document.body.style.cursor = 'auto';
    }, []);

    let baseColor = isSelected ? '#fde047' : hovered ? '#4ecdc4' : node.color;
    let emissiveColor = isSelected ? '#fbbf24' : hovered ? '#4ecdc4' : node.color;

    if (node.type === 'risk' && usesLibraryModel) {
        baseColor = isSelected ? '#fdba74' : hovered ? '#fb923c' : '#f97316';
        emissiveColor = isSelected ? '#fb923c' : hovered ? '#f97316' : '#ea580c';
    }

    if (isImpacted) {
        baseColor = '#ef4444';
        emissiveColor = '#dc2626';
    }

    const baseOpacity = isDimmed ? 0.4 : highlightCritical && !isCritical ? 0.7 : 0.95;
    const calculatedOpacity = usesLibraryModel ? Math.max(baseOpacity, 0.85) : baseOpacity;
    const emissiveIntensity = (isCritical && highlightCritical) || isImpacted ? 1.2 : 0.35;

    const sharedMaterialProps = useMemo(() => ({
        color: baseColor,
        emissive: emissiveColor,
        emissiveIntensity,
        metalness: 0.35,
        roughness: 0.25,
        opacity: opacity !== undefined ? opacity : calculatedOpacity,
        transparent: true,
        wireframe: Boolean(xRayMode),
        isHighlighted,
        isDimmed
    }), [baseColor, emissiveColor, emissiveIntensity, opacity, calculatedOpacity, xRayMode, isHighlighted, isDimmed]);

    const libraryPrimitive = useMemo(() => {
        const config = MODEL_LIBRARY_CONFIG[node.type];
        if (!config) return null;
        const source = modelLibrary[config.key];
        if (!source) return null;
        const clone = source.clone(true);
        const uniformScale = node.size * config.scale;
        clone.scale.setScalar(uniformScale);
        const [px = 0, py = 0, pz = 0] = config.position ?? [0, 0, 0];
        clone.position.set(px * node.size, py * node.size, pz * node.size);
        const [rx = 0, ry = 0, rz = 0] = config.rotation ?? [0, 0, 0];
        clone.rotation.set(rx, ry, rz);

        // Apply materials to cloned model
        clone.traverse(child => {
            if ((child as Mesh).isMesh) {
                child.frustumCulled = false;
                (child as Mesh).material = new MeshPhysicalMaterial({
                    color: isDimmed ? '#1e293b' : baseColor,
                    emissive: isDimmed ? '#000000' : emissiveColor,
                    emissiveIntensity: isDimmed ? 0 : emissiveIntensity,
                    metalness: isDimmed ? 0.1 : 0.1,
                    roughness: isDimmed ? 0.9 : 0.15,
                    transmission: isDimmed ? 0 : 0.9,
                    thickness: isDimmed ? 0 : 2,
                    ior: 1.5,
                    clearcoat: isDimmed ? 0 : 1,
                    transparent: true,
                    opacity: isDimmed ? 0.1 : 1,
                    wireframe: Boolean(xRayMode),
                    side: DoubleSide
                });
            }
        });
        return clone;
    }, [modelLibrary, node.type, node.size, baseColor, emissiveColor, emissiveIntensity, xRayMode, isDimmed]);

    const getDataLabel = useCallback((data: VoxelNode['data']): string => {
        if (!data) return 'Élément';
        if ('name' in data) return String(data.name);
        if ('title' in data) return String(data.title);
        if ('threat' in data) return String(data.threat);
        return 'Élément';
    }, []);

    const rawLabel = getDataLabel(node.data) || 'Élément';
    const label = rawLabel.length > 24 ? `${rawLabel.slice(0, 21)}…` : rawLabel;
    const safeLabel = safeRender(label);

    // @ts-expect-error: react-spring types might be missing group proxy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AnimatedGroup = animated.group as any;

    return (
        <group position={node.position}>
            <AnimatedGroup
                ref={meshRef}
                onClick={handleClick}
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
                scale={scale}
            >
                <VoxelModelGeometry
                    node={node}
                    libraryPrimitive={libraryPrimitive}
                    sharedMaterialProps={sharedMaterialProps}
                    emissiveColor={emissiveColor}
                    opacity={opacity !== undefined ? opacity : calculatedOpacity}
                    xRayMode={Boolean(xRayMode)}
                />
            </AnimatedGroup>

            {(hovered || isSelected || isHighlighted) && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -node.size / 2, 0]}>
                    <ringGeometry args={[node.size * 0.8, node.size * 1.6, 64]} />
                    <meshBasicMaterial
                        color={node.color}
                        transparent
                        opacity={isSelected ? 0.8 : 0.4}
                        blending={AdditiveBlending}
                    />
                </mesh>
            )}

            {/* Label */}
            {labelVisible && (
                <Text
                    position={[0, node.size + 0.8, 0]}
                    fontSize={0.55}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.08}
                    outlineColor="black"
                    maxWidth={3.5}
                    lineHeight={1.1}
                    font="https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff"
                >
                    {safeLabel}
                </Text>
            )}

            {isSelected && overlayProps && (
                <group>
                    {(overlayOffset.x === 0 && overlayOffset.y === 0) && (
                        <DynamicConnectorLine
                            startPos={[0, 0, 0]}
                            baseEndPos={[-5 + overlayOffset.x * 0.01, 1 - overlayOffset.y * 0.01, 0]}
                            offset={overlayOffset}
                        />
                    )}
                    <Html
                        position={[-5 + overlayOffset.x * 0.01, 1 - overlayOffset.y * 0.01, 0]}
                        distanceFactor={10}
                        occlude={false}
                        transform={false}
                        style={{ pointerEvents: 'none', zIndex: 10 }}
                    >
                        <div className="pointer-events-auto transform-gpu translate-z-0">
                            <VoxelDetailOverlay {...overlayProps} />
                        </div>
                    </Html>
                </group>
            )}
        </group>
    );

}, (prev, next) => {
    return (
        prev.isSelected === next.isSelected &&
        prev.isDimmed === next.isDimmed &&
        prev.isHighlighted === next.isHighlighted &&
        prev.highlightCritical === next.highlightCritical &&
        prev.xRayMode === next.xRayMode &&
        prev.isImpacted === next.isImpacted &&
        prev.node.id === next.node.id &&
        prev.node.position[0] === next.node.position[0] &&
        prev.node.position[1] === next.node.position[1] &&
        prev.node.position[2] === next.node.position[2] &&
        prev.node.color === next.node.color
    );
});
