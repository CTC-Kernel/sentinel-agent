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

// Helper functions for LOD calculations
const getLODGeometryArgs = (nodeType: VoxelNode['type'], lodLevel: number, size: number) => {
    switch (nodeType) {
        case 'asset':
            switch (lodLevel) {
                case 0: return [size * 0.9, size * 0.25, size * 0.6];
                case 1: return [size * 0.7, size * 0.2, size * 0.5];
                case 2: return [size * 0.5, size * 0.15, size * 0.4];
                case 3: return [size * 0.3, size * 0.1, size * 0.3];
                default: return [size * 0.1, size * 0.05, size * 0.2];
            }
        case 'risk':
            switch (lodLevel) {
                case 0: return [size * 0.6];
                case 1: return [size * 0.4];
                case 2: return [size * 0.3];
                case 3: return [size * 0.2];
                default: return [size * 0.1];
            }
        case 'project':
            switch (lodLevel) {
                case 0: return [size * 0.7, size * 0.2, size * 0.7];
                case 1: return [size * 0.5, size * 0.15, size * 0.6];
                case 2: return [size * 0.3, size * 0.1, size * 0.5];
                case 3: return [size * 0.2, size * 0.05, size * 0.4];
                default: return [size * 0.1, size * 0.05, size * 0.3];
            }
        default:
            return [size * 0.5, size * 0.2, size * 0.5];
    }
};

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
    if (typeof value === 'string') return value;
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
    cameraPosition?: [number, number, number];
    lodLevel?: number;
}> = React.memo(({ node, libraryPrimitive, sharedMaterialProps, emissiveColor, opacity, xRayMode, cameraPosition, lodLevel = 0 }) => {
    // Calculer la distance depuis la caméra pour le LOD
    const distance = cameraPosition ? Math.sqrt(
        Math.pow(cameraPosition[0] - node.position[0], 2) +
        Math.pow(cameraPosition[1] - node.position[1], 2) +
        Math.pow(cameraPosition[2] - node.position[2], 2)
    ) : 50; // Distance par défaut

    const calculatedLODLevel = Math.floor(distance / 20);
    const finalLODLevel = lodLevel !== undefined ? lodLevel : calculatedLODLevel;

    if (libraryPrimitive) {
        return <primitive object={libraryPrimitive} />;
    }

    const geometryArgs = getLODGeometryArgs(node.type, finalLODLevel, node.size);

    switch (node.type) {
        case 'asset':
            return (
                <>
                    <mesh position={[0, -node.size * 0.2, 0]}>
                        <boxGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <boxGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <boxGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    {[0, 0.25, 0.5].map(offset => (
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
                        <octahedronGeometry args={[geometryArgs[0]]} />
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
                                <octahedronGeometry args={[geometryArgs[0]]} />
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
                </>
            );
        case 'project':
            return (
                <>
                    <mesh position={[0, -node.size * 0.18, 0]}>
                        <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial color="#fcd34d" emissive="#fbbf24" emissiveIntensity={0.8} opacity={opacity} transparent />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, node.size * 0.05, 0]}>
                        <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial color="#c084fc" emissive="#2dd4bf" emissiveIntensity={0.5} opacity={opacity} transparent />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, node.size * 0.05, 0]}>
                        <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial color="#c084fc" emissive="#2dd4bf" emissiveIntensity={0.5} opacity={opacity} transparent />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                </>
            );
        case 'audit':
            return (
                <>
                    <mesh position={[0, -node.size * 0.18, 0]}>
                        <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                </>
            );
        case 'supplier':
            return (
                <>
                    <mesh position={[0, -node.size * 0.12, 0]}>
                        <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                </>
            );
        default:
            return (
                <>
                    <mesh position={[0, -node.size * 0.2, 0]}>
                        <boxGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <boxGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                    <mesh position={[0, node.size * 0.18, 0]}>
                        <boxGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2]]} />
                        <GlassMaterial {...sharedMaterialProps} />
                        <EdgesWithColor color={emissiveColor} />
                    </mesh>
                </>
            );
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

    const safeSize = Number.isFinite(node.size) && node.size > 0 ? node.size : 1;

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
        if (!source || source.children.length === 0) return null;
        const clone = source.clone(true);
        const uniformScale = safeSize * config.scale;
        clone.scale.setScalar(uniformScale);
        const [px = 0, py = 0, pz = 0] = config.position ?? [0, 0, 0];
        clone.position.set(px * safeSize, py * safeSize, pz * safeSize);
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
    }, [modelLibrary, node.type, baseColor, emissiveColor, emissiveIntensity, xRayMode, isDimmed, safeSize]);

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
                    node={{ ...node, size: safeSize }}
                    libraryPrimitive={libraryPrimitive}
                    sharedMaterialProps={sharedMaterialProps}
                    emissiveColor={emissiveColor}
                    opacity={opacity !== undefined ? opacity : calculatedOpacity}
                    xRayMode={Boolean(xRayMode)}
                />
            </AnimatedGroup>

            {(hovered || isSelected || isHighlighted) && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -safeSize / 2, 0]}>
                    <ringGeometry args={[safeSize * 0.8, safeSize * 1.6, 64]} />
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
                    position={[0, safeSize + 1.2, 0]}
                    fontSize={0.45}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.06}
                    outlineColor="black"
                    maxWidth={2.8}
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
