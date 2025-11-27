import React, { useRef, useState, useMemo, useEffect, createContext, useContext, useCallback } from 'react';
import { Canvas, useFrame, ThreeEvent, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Text, Line, Points, PointMaterial, Float, Edges, Environment, Html, Billboard } from '@react-three/drei';
import { Vector3, Color, AdditiveBlending, Mesh, MeshBasicMaterial, Group, DoubleSide, CatmullRomCurve3, MeshPhysicalMaterial } from 'three';
import { OrbitControls as OrbitControlsImpl, OBJLoader } from 'three-stdlib';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Asset, Risk, Project, Audit, Incident, Supplier, AISuggestedLink } from '../types';
import { VoxelDetailOverlay } from './VoxelDetailOverlay';

interface VoxelNode {
  id: string;
  type: 'asset' | 'risk' | 'project' | 'audit' | 'incident' | 'supplier';
  position: [number, number, number];
  color: string;
  size: number;
  data: Asset | Risk | Project | Audit | Incident | Supplier;
  connections: string[];
}

interface VoxelStudioProps {
  assets: Asset[];
  risks: Risk[];
  projects: Project[];
  audits: Audit[];
  incidents: Incident[];
  suppliers: Supplier[];
  onNodeClick?: (node: VoxelNode | null) => void;
  className?: string;
  visibleTypes?: VoxelNode['type'][];
  focusNodeId?: string | null;
  highlightCritical?: boolean;
  summaryStats?: {
    assets: number;
    risks: number;
    projects: number;
    incidents: number;
  };
  xRayMode?: boolean;
  autoRotatePreference?: boolean | null;
  releaseToken?: number | null;
  suggestedLinks?: AISuggestedLink[];
  presentationMode?: boolean;
  // Overlay props
  selectedNodeDetails?: any;
  isDetailMinimized?: boolean;
  setIsDetailMinimized?: (v: boolean | ((prev: boolean) => boolean)) => void;
  handleSelectionClear?: () => void;
  relatedElements?: any[];
  applyFocus?: (id: string, type: any) => void;
  handleOpenSelected?: () => void;
}

const safeRender = (value: any): React.ReactNode => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    if ('seconds' in value && 'nanoseconds' in value) {
      return new Date(value.seconds * 1000).toLocaleDateString();
    }
    return ''; // Safely ignore other objects to prevent crashes
  }
  return value;
};

const SCENE_OFFSET: [number, number, number] = [5.5, 0, 0];

const applySceneOffset = (x: number, y: number, z: number): [number, number, number] => [
  x + SCENE_OFFSET[0],
  y + SCENE_OFFSET[1],
  z + SCENE_OFFSET[2]
];

const assetModelUrl = new URL('../3D/w2yurp9pjcow-ServerV2console/ServerV2+console.obj', import.meta.url).href;
const riskModelUrl = new URL('../3D/A_Shield_with_a_Raised_Star_v1_L1.123c9f2a1173-8c93-4a8d-a572-89acfb9632eb/19329_A_Shield_with_a_Raised_Star_v1.obj', import.meta.url).href;
const incidentModelUrl = new URL('../3D/Flame_v1_L1.123c9492eea4-9564-46cc-bdc9-fe01a6e3b117/21330_Flame_v1.obj', import.meta.url).href;
const supplierModelUrl = new URL('../3D/i8cotix2ujuo-Cap/Cap.obj', import.meta.url).href;
const projectModelUrl = new URL('../3D/Models and Textures/Cardboard box.obj', import.meta.url).href;

type ModelLibrary = {
  asset: Group;
  risk: Group;
  incident: Group;
  supplier: Group;
  project: Group;
};

const ModelLibraryContext = createContext<ModelLibrary | null>(null);

const useModelLibrary = (): ModelLibrary => {
  const context = useContext(ModelLibraryContext);
  if (!context) {
    throw new Error('ModelLibraryContext must be used within ModelLibraryProvider');
  }
  return context;
};

const ModelLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const asset = useLoader(OBJLoader, assetModelUrl);
  const risk = useLoader(OBJLoader, riskModelUrl);
  const incident = useLoader(OBJLoader, incidentModelUrl);
  const supplier = useLoader(OBJLoader, supplierModelUrl);
  const project = useLoader(OBJLoader, projectModelUrl);
  const value = useMemo(() => ({ asset, risk, incident, supplier, project }), [asset, risk, incident, supplier, project]);
  return <ModelLibraryContext.Provider value={value}>{children}</ModelLibraryContext.Provider>;
};

const MODEL_LIBRARY_CONFIG: Partial<Record<VoxelNode['type'], { key: keyof ModelLibrary; scale: number; position?: [number, number, number]; rotation?: [number, number, number]; }>> = {
  asset: { key: 'asset', scale: 0.28, position: [0, -0.28, 0], rotation: [0, Math.PI, 0] },
  risk: { key: 'risk', scale: 0.25, position: [0, -0.22, 0], rotation: [-Math.PI / 2, 0, Math.PI] },
  incident: { key: 'incident', scale: 0.22, position: [0, -0.2, 0], rotation: [-Math.PI / 2, 0, 0] },
  supplier: { key: 'supplier', scale: 0.0045, position: [0, -0.004, 0], rotation: [-Math.PI / 2, Math.PI, 0] },
  project: { key: 'project', scale: 0.35, position: [0, -0.25, 0], rotation: [0, Math.PI, 0] },
};

const StarField: React.FC = () => {
  const starsRef = useRef<any>(null);
  const positions = useMemo(() => {
    const starCount = 1200;
    const array = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r1 = Math.sin(i * 12.9898) * 43758.5453;
      const r2 = Math.sin(i * 78.233) * 43758.5453;
      const r3 = Math.sin(i * 37.312) * 43758.5453;

      array[i * 3] = ((r1 - Math.floor(r1)) - 0.5) * 200;
      array[i * 3 + 1] = ((r2 - Math.floor(r2)) - 0.5) * 80;
      array[i * 3 + 2] = ((r3 - Math.floor(r3)) - 0.5) * 200;
    }
    return array;
  }, []);

  useFrame((_, delta) => {
    if (starsRef.current) {
      starsRef.current.rotation.y += delta * 0.015;
      starsRef.current.rotation.x += delta * 0.005;
    }
  });

  return (
    <Points ref={starsRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#94a3b8"
        size={0.3}
        sizeAttenuation
        depthWrite={false}
        opacity={0.6}
      />
    </Points>
  );
};

// Dynamic connector line that follows the overlay
const DynamicConnectorLine: React.FC<{
  startPos: [number, number, number];
  baseEndPos: [number, number, number];
  offset: { x: number; y: number };
}> = ({ startPos, baseEndPos }) => {
  // The baseEndPos already includes the offset, so we just connect the two points
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

const TargetReticle: React.FC<{ position: [number, number, number]; size: number; color: string }> = ({ position, size, color }) => {
  const ref1 = useRef<Mesh>(null);
  const ref2 = useRef<Mesh>(null);
  const ref3 = useRef<Group>(null);

  useFrame((_, delta) => {
    if (ref1.current) ref1.current.rotation.z -= delta * 0.5;
    if (ref2.current) ref2.current.rotation.z += delta * 0.3;
    if (ref3.current) {
      ref3.current.rotation.x += delta * 0.2;
      ref3.current.rotation.y += delta * 0.2;
    }
  });

  const scale = size * 1.8;

  return (
    <group position={position}>
      {/* Inner dashed ring */}
      <mesh ref={ref1} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[scale * 0.9, scale * 0.95, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={DoubleSide} />
      </mesh>

      {/* Outer bracket ring */}
      <mesh ref={ref2} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[scale * 1.1, scale * 1.15, 4, 1, 0, Math.PI / 2]} />
        <meshBasicMaterial color="white" transparent opacity={0.6} side={DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI]}>
        <ringGeometry args={[scale * 1.1, scale * 1.15, 4, 1, 0, Math.PI / 2]} />
        <meshBasicMaterial color="white" transparent opacity={0.6} side={DoubleSide} />
      </mesh>

      {/* Orbital atom-like rings */}
      <group ref={ref3}>
        <mesh rotation={[0, 0, 0]}>
          <torusGeometry args={[scale * 1.4, 0.02, 8, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[scale * 1.4, 0.02, 8, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} />
        </mesh>
      </group>
    </group>
  );
};

const FocusController: React.FC<{ target: VoxelNode | null; controlsRef: React.RefObject<OrbitControlsImpl | null>; setAutoRotate: (value: boolean) => void; userInteractingRef: React.MutableRefObject<boolean>; shouldSnapRef: React.MutableRefObject<boolean>; focusOnCardRef: React.MutableRefObject<boolean>; overlayOffset: { x: number; y: number }; }> = ({ target, controlsRef, setAutoRotate, userInteractingRef, shouldSnapRef, focusOnCardRef, overlayOffset }) => {
  const { camera } = useThree();
  const focusVec = useRef(new Vector3(0, 0, 0));
  const desiredPos = useRef(camera.position.clone());
  const defaultPos = useRef(new Vector3(22, 12, 22)); // Global view position
  const defaultTarget = useRef(new Vector3(0, 0, 0));
  const offsetVec = useRef(new Vector3(6, 4, 6));
  const isResetting = useRef(false);

  useEffect(() => {
    if (target) {
      setAutoRotate(false);
      isResetting.current = false;
    } else {
      isResetting.current = true;
    }
  }, [target, setAutoRotate]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (target) {
      focusVec.current.set(...target.position);
      if (focusOnCardRef.current) {
        const cardOffsetX = -5 + overlayOffset.x * 0.01;
        const cardOffsetY = 1 - overlayOffset.y * 0.01;
        focusVec.current.x += cardOffsetX;
        focusVec.current.y += cardOffsetY;
      }
      let magnitude = Math.max(4, target.size * 5);
      let verticalFactor = 0.6;
      if (focusOnCardRef.current) {
        magnitude = 8;
        verticalFactor = 0.2;
      }
      const horizontalDir = focusVec.current.clone().setY(0);
      if (horizontalDir.lengthSq() < 1e-3) {
        horizontalDir.set(0, 0, 1);
      }
      horizontalDir.normalize().multiplyScalar(-1);
      offsetVec.current.copy(horizontalDir.multiplyScalar(magnitude * 1.2));
      offsetVec.current.y = magnitude * verticalFactor + 2;
      desiredPos.current.copy(focusVec.current).add(offsetVec.current);
      if (!userInteractingRef.current && shouldSnapRef.current) {
        camera.position.lerp(desiredPos.current, 0.04);
        if (camera.position.distanceTo(desiredPos.current) < 0.05) {
          shouldSnapRef.current = false;
        }
      }
      controls.target.lerp(focusVec.current, 0.08);
    } else if (isResetting.current) {
      // Fly back to global view
      if (userInteractingRef.current) {
        isResetting.current = false; // User took control
      } else {
        camera.position.lerp(defaultPos.current, 0.03);
        controls.target.lerp(defaultTarget.current, 0.05);

        // Stop resetting when close enough
        if (camera.position.distanceTo(defaultPos.current) < 0.5) {
          isResetting.current = false;
        }
      }
    }
    // Else: Free mode (do nothing, let OrbitControls handle it)

    controls.update();
  });

  return null;
};

const ScanRing: React.FC<{ radius: number; color: string; y?: number; speed?: number }> = ({ radius, color, y = -9.5, speed = 0.4 }) => {
  const ringRef = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z += delta * speed;
    const material = ringRef.current.material;
    if (Array.isArray(material)) return;
    (material as MeshBasicMaterial).opacity = 0.25 + Math.sin(Date.now() * 0.001 + radius) * 0.1;
  });

  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <ringGeometry args={[radius - 0.2, radius, 128]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.35}
        blending={AdditiveBlending}
      />
    </mesh>
  );
};

const NeonGrid: React.FC = () => {
  const gridRef = useRef<Mesh>(null);
  const grid2Ref = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (gridRef.current) {
      gridRef.current.rotation.z += delta * 0.02;
      (gridRef.current.material as MeshBasicMaterial).opacity = 0.15 + (Math.sin(state.clock.elapsedTime * 0.5) + 1) * 0.05;
    }
    if (grid2Ref.current) {
      grid2Ref.current.rotation.z -= delta * 0.01;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
      grid2Ref.current.scale.set(scale, scale, 1);
    }
  });

  return (
    <group position={[0, -10.2, 0]}>
      <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[140, 140, 40, 40]} />
        <meshBasicMaterial color="#1d4ed8" wireframe transparent opacity={0.2} />
      </mesh>
      <mesh ref={grid2Ref} rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, -0.1, 0]}>
        <planeGeometry args={[100, 100, 20, 20]} />
        <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.1} />
      </mesh>
    </group>
  );
};

const PulseCore: React.FC = () => {
  const coreRef = useRef<Mesh>(null);
  useFrame(() => {
    if (!coreRef.current) return;
    const t = Date.now() * 0.0015;
    const scale = 1 + Math.sin(t) * 0.08;
    coreRef.current.scale.set(scale, scale, scale);
    const material = coreRef.current.material;
    if (Array.isArray(material)) return;
    (material as MeshBasicMaterial).opacity = 0.1 + (Math.sin(t) + 1) * 0.05;
  });

  return (
    <mesh ref={coreRef} position={[0, -1, 0]}>
      <sphereGeometry args={[1.2, 32, 32]} />
      <meshBasicMaterial
        color="#38bdf8"
        transparent
        opacity={0.12}
        blending={AdditiveBlending}
      />
    </mesh>
  );
};

const DataFlowParticles: React.FC<{ start: Vector3; end: Vector3; color: string; speed?: number; opacity?: number; showParticles?: boolean; particleSize?: number }> = ({ start, end, color, speed = 1, opacity = 0.5, showParticles = true, particleSize = 0.08 }) => {
  const curve = useMemo(() => {
    const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y += 2; // Arc height
    return new CatmullRomCurve3([start, mid, end]);
  }, [start, end]);

  const particleCount = Math.max(3, Math.floor(8 * speed)); // More particles for faster flows
  const points = useMemo(() => curve.getPoints(50), [curve]);

  return (
    <group>
      <Line points={points} color={color} opacity={opacity * 0.6} transparent lineWidth={1.5} />
      {showParticles && [...Array(particleCount)].map((_, i) => (
        <MovingParticle
          key={i}
          curve={curve}
          offset={i / particleCount}
          color={color}
          speed={speed}
          size={particleSize}
        />
      ))}
    </group>
  );
};

const MovingParticle: React.FC<{ curve: CatmullRomCurve3; offset: number; color: string; speed: number; size: number }> = ({ curve, offset, color, speed, size }) => {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = (state.clock.getElapsedTime() * speed * 0.2 + offset) % 1;
    const pos = curve.getPoint(t);
    meshRef.current.position.copy(pos);
    const tangent = curve.getTangent(t);
    meshRef.current.lookAt(pos.clone().add(tangent));
    const scale = 1 + Math.sin(state.clock.getElapsedTime() * 10) * 0.3;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
};

const GlassMaterial: React.FC<any> = ({ color, emissive, opacity, isDimmed, isHighlighted, ...props }) => (
  <meshPhysicalMaterial
    color={isDimmed ? '#1e293b' : isHighlighted ? '#ffffff' : color}
    emissive={isDimmed ? '#000000' : isHighlighted ? color : emissive}
    emissiveIntensity={isDimmed ? 0 : isHighlighted ? 2.0 : 0.4}
    roughness={isDimmed ? 0.9 : isHighlighted ? 0.1 : 0.15}
    metalness={isDimmed ? 0.1 : isHighlighted ? 0.5 : 0.3}
    transmission={isDimmed ? 0 : 0.45}
    thickness={isDimmed ? 0 : 1.5}
    clearcoat={isDimmed ? 0 : 1}
    clearcoatRoughness={0.1}
    transparent
    opacity={isDimmed ? 0.1 : Math.max(opacity, 0.6)}
    side={DoubleSide}
    {...props}
  />
);

const VoxelMesh: React.FC<{
  node: VoxelNode;
  onClick: (node: VoxelNode) => void;
  isSelected: boolean;
  isDimmed: boolean;
  isHighlighted: boolean;
  highlightCritical?: boolean;
  xRayMode?: boolean;
  opacity?: number;
  overlayProps?: any;
  overlayOffset?: { x: number; y: number };
  isImpacted?: boolean;
}> = ({
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
    const [currentScale, setCurrentScale] = useState(1);
    const [currentGlow, setCurrentGlow] = useState(0);

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

    useFrame(() => {
      if (meshRef.current) {
        meshRef.current.rotation.y += 0.005;
      }
    });

    // Animate scale and glow using useFrame
    const targetScale = isSelected ? 1.3 : (hovered || isHighlighted || isImpacted) ? 1.15 : 1;
    const targetGlow = (isCritical && highlightCritical) || isImpacted ? 0.8 : 0;

    useFrame(() => {
      if (meshRef.current) {
        // Smooth interpolation for scale
        setCurrentScale(prev => prev + (targetScale - prev) * 0.1);
        meshRef.current.scale.setScalar(currentScale);

        // Smooth interpolation for glow
        setCurrentGlow(prev => prev + (targetGlow - prev) * 0.1);
      }
    });

    const handleClick = (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onClick(node);
    };

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
    const emissiveIntensity = 0.35 + currentGlow * 0.4;

    const sharedMaterialProps = {
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
    };

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
      clone.traverse(child => {
        if ((child as Mesh).isMesh) {
          child.frustumCulled = false;
          (child as Mesh).material = new MeshPhysicalMaterial({
            color: isDimmed ? '#1e293b' : baseColor,
            emissive: isDimmed ? '#000000' : emissiveColor,
            emissiveIntensity: isDimmed ? 0 : emissiveIntensity,
            metalness: isDimmed ? 0.1 : 0.3,
            roughness: isDimmed ? 0.9 : 0.2,
            transmission: isDimmed ? 0 : 0.5,
            thickness: isDimmed ? 0 : 1.2,
            clearcoat: isDimmed ? 0 : 1,
            transparent: true,
            opacity: isDimmed ? 0.1 : Math.max(opacity ?? 1, 0.6),
            wireframe: Boolean(xRayMode),
            side: DoubleSide
          });
        }
      });
      return clone;
    }, [modelLibrary, node.type, node.size, baseColor, emissiveColor, emissiveIntensity, opacity, xRayMode, isDimmed]);

    const renderCategoryModel = () => {
      if (libraryPrimitive) {
        return <primitive object={libraryPrimitive} />;
      }

      const EdgesWithColor = () => <Edges threshold={15} color={emissiveColor} opacity={0.5} transparent />;

      switch (node.type) {
        case 'asset':
          return (
            <>
              <mesh position={[0, -node.size * 0.2, 0]}>
                <boxGeometry args={[node.size * 0.9, node.size * 0.25, node.size * 0.6]} />
                <GlassMaterial {...sharedMaterialProps} />
                <EdgesWithColor />
              </mesh>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[node.size * 0.75, node.size * 0.2, node.size * 0.5]} />
                <GlassMaterial {...sharedMaterialProps} />
                <EdgesWithColor />
              </mesh>
              <mesh position={[0, node.size * 0.18, 0]}>
                <boxGeometry args={[node.size * 0.55, node.size * 0.18, node.size * 0.4]} />
                <GlassMaterial {...sharedMaterialProps} />
                <EdgesWithColor />
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
                <EdgesWithColor />
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
                    <EdgesWithColor />
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
                <EdgesWithColor />
              </mesh>
              <mesh position={[0, node.size * 0.05, 0]}>
                <cylinderGeometry args={[node.size * 0.5, node.size * 0.5, node.size * 0.35, 24]} />
                <GlassMaterial {...sharedMaterialProps} />
                <EdgesWithColor />
              </mesh>
              <mesh position={[0, node.size * 0.32, 0]}>
                <cylinderGeometry args={[node.size * 0.18, node.size * 0.18, node.size * 0.7, 12]} />
                <GlassMaterial color="#fcd34d" emissive="#fbbf24" emissiveIntensity={0.8} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
                <EdgesWithColor />
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
                <EdgesWithColor />
              </mesh>
              <mesh position={[0, node.size * 0.18, 0]}>
                <boxGeometry args={[node.size * 0.75, node.size * 0.04, node.size * 0.55]} />
                <GlassMaterial {...sharedMaterialProps} />
                <EdgesWithColor />
              </mesh>
              <mesh position={[0, node.size * 0.06, 0]}>
                <boxGeometry args={[node.size * 0.22, node.size * 0.25, node.size * 0.06]} />
                <GlassMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.7} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
                <EdgesWithColor />
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
                <EdgesWithColor />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[node.size * 0.75, node.size * 0.08, 24, 48]} />
                <GlassMaterial color="#fb7185" emissive="#f43f5e" emissiveIntensity={0.8} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
              </mesh>
              <mesh position={[0, node.size * 0.55, 0]}>
                <coneGeometry args={[node.size * 0.2, node.size * 0.5, 12]} />
                <GlassMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.9} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
                <EdgesWithColor />
              </mesh>
              <mesh position={[node.size * 0.45, 0, 0]} rotation={[0, 0, Math.PI / 6]}>
                <boxGeometry args={[node.size * 0.2, node.size * 0.4, node.size * 0.04]} />
                <GlassMaterial color="#fee2e2" emissive="#fecaca" emissiveIntensity={0.6} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
                <EdgesWithColor />
              </mesh>
            </>
          );
        case 'supplier':
          return (
            <>
              <mesh position={[0, -node.size * 0.12, 0]}>
                <cylinderGeometry args={[node.size * 0.45, node.size * 0.45, node.size * 0.35, 20]} />
                <GlassMaterial {...sharedMaterialProps} />
                <EdgesWithColor />
              </mesh>
              <mesh position={[0, node.size * 0.22, 0]}>
                <coneGeometry args={[node.size * 0.55, node.size * 0.75, 20]} />
                <GlassMaterial {...sharedMaterialProps} />
                <EdgesWithColor />
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
        default:
          return (
            <mesh>
              <boxGeometry args={[node.size, node.size, node.size]} />
              <GlassMaterial {...sharedMaterialProps} />
              <EdgesWithColor />
            </mesh>
          );
      }
    };

    const rawLabel = (node.data as any).name || (node.data as any).title || (node.data as any).threat || (node.data as any).label || 'Élément';
    const label = rawLabel.length > 24 ? `${rawLabel.slice(0, 21)}…` : rawLabel;
    const safeLabel = safeRender(label);

    return (
      <group position={node.position}>
        <group
          ref={meshRef}
          onClick={handleClick}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          {renderCategoryModel()}
        </group>

        {(hovered || isSelected || isHighlighted) && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -node.size / 2, 0]}>
            <ringGeometry args={[node.size * 0.8, node.size * 1.6, 64]} />
            <meshBasicMaterial
              color={node.color}
              transparent
              opacity={isSelected ? 0.5 : 0.25}
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
              zIndexRange={[100, 0]}
              distanceFactor={10}
              occlude={false}
              transform
              sprite
              style={{ pointerEvents: 'none' }}
            >
              <div style={{ pointerEvents: 'auto', transform: 'translate3d(0, 0, 0)' }}>
                <VoxelDetailOverlay {...overlayProps} />
              </div>
            </Html>
          </group>
        )}
      </group>
    );
  };



const ImpactWave: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const ref = useRef<Mesh>(null);
  const [active, setActive] = useState(true);

  useFrame((_, delta) => {
    if (!active || !ref.current) return;
    const scale = ref.current.scale.x + delta * 15;
    ref.current.scale.setScalar(scale);
    (ref.current.material as MeshBasicMaterial).opacity -= delta * 2.5;
    if ((ref.current.material as MeshBasicMaterial).opacity <= 0) setActive(false);
  });

  if (!active) return null;

  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.8, 1, 32]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
    </mesh>
  );
};

const EmptyState3D: React.FC = () => (
  <group>
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <Billboard
        position={[0, 1.2, 0]}
        follow
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <Text
          fontSize={1.2}
          color="white"
          anchorX="center"
          anchorY="middle"
          maxWidth={8}
          textAlign="center"
        >
          Système Sécurisé
        </Text>
        <Text
          fontSize={0.5}
          color="#94a3b8"
          anchorX="center"
          anchorY="top"
          position={[0, -0.9, 0]}
          maxWidth={6}
          textAlign="center"
        >
          Commencez par ajouter des actifs ou des risques pour visualiser votre écosystème 3D.
        </Text>
      </Billboard>
    </Float>
    <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[3, 3.05, 64]} />
      <meshBasicMaterial color="#3b82f6" transparent opacity={0.2} blending={AdditiveBlending} />
    </mesh>
    <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[4.5, 4.52, 64]} />
      <meshBasicMaterial color="#64748b" transparent opacity={0.1} blending={AdditiveBlending} />
    </mesh>
  </group>
);

export const VoxelStudio: React.FC<VoxelStudioProps> = ({
  assets,
  risks,
  projects,
  audits,
  incidents,
  suppliers,
  onNodeClick,
  className = "",
  visibleTypes,
  focusNodeId,
  highlightCritical = false,
  summaryStats,
  releaseToken,
  suggestedLinks = [],
  xRayMode,
  presentationMode,
  // Overlay props
  selectedNodeDetails,
  isDetailMinimized,
  setIsDetailMinimized,
  handleSelectionClear,
  relatedElements,
  applyFocus,
  handleOpenSelected,
}) => {
  const [selectedNode, setSelectedNode] = useState<VoxelNode | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const selectionUpdateFromOutside = useRef(false);
  const isUserInteracting = useRef(false);
  const focusOnCardRef = useRef(false);
  const shouldSnapToTarget = useRef(false);
  const [impactPosition, setImpactPosition] = useState<[number, number, number] | null>(null);
  const [impactKey, setImpactKey] = useState(0);
  const [overlayOffset, setOverlayOffset] = useState({ x: 0, y: 0 });

  // Intelligent Features State
  const [impactMode, setImpactMode] = useState(false);
  const [impactedNodeIds, setImpactedNodeIds] = useState<Set<string>>(new Set());


  const handleOverlayPositionChange = (x: number, y: number) => {
    setOverlayOffset({ x, y });
  };

  const handleOverlayFocusRequest = () => {
    if (selectedNode) {
      focusOnCardRef.current = true;
      shouldSnapToTarget.current = true;
    }
  };

  const overlayProps = {
    selectedNodeDetails,
    isDetailMinimized,
    setIsDetailMinimized,
    handleSelectionClear,
    relatedElements,
    applyFocus,
    handleOpenSelected,
    onPositionChange: handleOverlayPositionChange,
    onRequestFocus: handleOverlayFocusRequest,
    impactMode,
    setImpactMode,
  };


  const safeAssets = assets ?? [];
  const safeRisks = risks ?? [];
  const safeProjects = projects ?? [];
  const safeAudits = audits ?? [];
  const safeIncidents = incidents ?? [];
  const safeSuppliers = suppliers ?? [];

  // Convert data to voxel nodes
  const baseNodes = useMemo(() => {
    const nodes: VoxelNode[] = [];
    const gridSize = 10;
    const spacing = 4;

    // Assets - Foundation layer (bottom)
    safeAssets.forEach((asset, index) => {
      const x = (index % gridSize) * spacing - (gridSize * spacing) / 2;
      const z = Math.floor(index / gridSize) * spacing - (gridSize * spacing) / 2;
      const y = -8;

      nodes.push({
        id: asset.id,
        type: 'asset',
        position: applySceneOffset(x, y, z),
        color: '#3b82f6',
        size: 0.8,
        data: asset,
        connections: []
      });
    });

    // Risks - Middle layer
    safeRisks.forEach((risk, index) => {
      const x = (index % gridSize) * spacing - (gridSize * spacing) / 2;
      const z = Math.floor(index / gridSize) * spacing - (gridSize * spacing) / 2;
      const y = -4;

      const riskColor = risk.score >= 15 ? '#ef4444' : risk.score >= 10 ? '#f59e0b' : '#22c55e';

      nodes.push({
        id: risk.id,
        type: 'risk',
        position: applySceneOffset(x, y, z),
        color: riskColor,
        size: 0.6 + (risk.score / 25) * 0.4,
        data: risk,
        connections: [risk.assetId]
      });
    });

    // Projects - Upper middle layer
    safeProjects.forEach((project, index) => {
      const x = (index % gridSize) * spacing - (gridSize * spacing) / 2;
      const z = Math.floor(index / gridSize) * spacing - (gridSize * spacing) / 2;
      const y = 0;

      nodes.push({
        id: project.id,
        type: 'project',
        position: applySceneOffset(x, y, z),
        color: '#8b5cf6',
        size: 0.7,
        data: project,
        connections: project.relatedRiskIds || []
      });
    });

    // Audits - Upper layer
    safeAudits.forEach((audit, index) => {
      const x = (index % gridSize) * spacing - (gridSize * spacing) / 2;
      const z = Math.floor(index / gridSize) * spacing - (gridSize * spacing) / 2;
      const y = 4;

      nodes.push({
        id: audit.id,
        type: 'audit',
        position: applySceneOffset(x, y, z),
        color: '#06b6d4',
        size: 0.6,
        data: audit,
        connections: []
      });
    });

    // Incidents - Top layer (critical)
    safeIncidents.forEach((incident, index) => {
      const x = (index % gridSize) * spacing - (gridSize * spacing) / 2;
      const z = Math.floor(index / gridSize) * spacing - (gridSize * spacing) / 2;
      const y = 8;

      const incidentColor = incident.severity === 'Critique' ? '#dc2626' :
        incident.severity === 'Élevée' ? '#ea580c' : '#f59e0b';

      nodes.push({
        id: incident.id,
        type: 'incident',
        position: applySceneOffset(x, y, z),
        color: incidentColor,
        size: 0.5 + (['Faible', 'Moyenne', 'Élevée', 'Critique'].indexOf(incident.severity) / 3) * 0.3,
        data: incident,
        connections: incident.affectedAssetId ? [incident.affectedAssetId] : []
      });
    });

    // Suppliers - Side layer
    if (safeSuppliers.length > 0) {
      safeSuppliers.forEach((supplier, index) => {
        const angle = (index / safeSuppliers.length) * Math.PI * 2;
        const radius = 15;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = 2;

        const supplierColor = supplier.criticality === 'Critique' ? '#dc2626' :
          supplier.criticality === 'Élevée' ? '#ea580c' : '#22c55e';

        nodes.push({
          id: supplier.id,
          type: 'supplier',
          position: applySceneOffset(x, y, z),
          color: supplierColor,
          size: 0.6,
          data: supplier,
          connections: []
        });
      });
    }

    return nodes;
  }, [safeAssets, safeRisks, safeProjects, safeAudits, safeIncidents, safeSuppliers]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedNode(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleStart = () => {
      isUserInteracting.current = true;
      shouldSnapToTarget.current = false;
      setAutoRotate(false);
    };

    const handleEnd = () => {
      isUserInteracting.current = false;
      if (!selectedNode) {
        setAutoRotate(true);
      }
    };

    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);

    return () => {
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
    };
  }, [selectedNode]);

  useEffect(() => {
    if (selectedNode) {
      setTimeout(() => setAutoRotate(false), 0);
      return;
    }
    const timer = setTimeout(() => setAutoRotate(true), 700);
    return () => clearTimeout(timer);
  }, [selectedNode]);

  const voxelNodes = useMemo(() => {
    if (!visibleTypes || visibleTypes.length === 0) {
      return baseNodes;
    }
    const allowed = new Set(visibleTypes);
    return baseNodes.filter(node => allowed.has(node.type));
  }, [baseNodes, visibleTypes]);

  const connectionPairs = useMemo(() => {
    const pairs: { start: [number, number, number]; end: [number, number, number]; strength: number; sourceId: string; targetId: string }[] = [];
    voxelNodes.forEach(node => {
      node.connections.forEach(connectionId => {
        const target = voxelNodes.find(n => n.id === connectionId);
        if (target) {
          const distance = Math.sqrt(
            (node.position[0] - target.position[0]) ** 2 +
            (node.position[1] - target.position[1]) ** 2 +
            (node.position[2] - target.position[2]) ** 2
          );
          const strength = Math.max(0.3, 1 - distance / 25);
          pairs.push({ start: node.position, end: target.position, strength, sourceId: node.id, targetId: target.id });
        }
      });
    });
    return pairs;
  }, [voxelNodes]);

  const aiConnectionPairs = useMemo(() => {
    const pairs: { start: [number, number, number]; end: [number, number, number]; strength: number; type: string; sourceId: string; targetId: string }[] = [];
    suggestedLinks.forEach(link => {
      const source = voxelNodes.find(n => n.id === link.sourceId);
      const target = voxelNodes.find(n => n.id === link.targetId);

      if (source && target) {
        pairs.push({
          start: source.position,
          end: target.position,
          strength: link.confidence,
          type: link.type,
          sourceId: source.id,
          targetId: target.id
        });
      }
    });
    return pairs;
  }, [voxelNodes, suggestedLinks]);

  const branchPivotNode = useMemo(() => {
    return selectedNode;
  }, [selectedNode]);

  const handleNodeClick = (node: VoxelNode) => {
    setSelectedNode(node);
    focusOnCardRef.current = true;
    shouldSnapToTarget.current = true;
    setImpactPosition(node.position);
    setImpactKey(prev => prev + 1);
  };

  useEffect(() => {
    if (selectedNode && !voxelNodes.find(node => node.id === selectedNode.id)) {
      setTimeout(() => setSelectedNode(null), 0);
    }
  }, [voxelNodes, selectedNode]);

  useEffect(() => {
    if (focusNodeId === undefined) return;
    selectionUpdateFromOutside.current = true;
    if (focusNodeId === null) {
      setTimeout(() => setSelectedNode(null), 0);
      shouldSnapToTarget.current = false;
      focusOnCardRef.current = false;
      return;
    }
    const node = voxelNodes.find(n => n.id === focusNodeId);
    if (node) {
      setTimeout(() => setSelectedNode(node), 0);
      focusOnCardRef.current = true;
      shouldSnapToTarget.current = true;
    }
  }, [focusNodeId, voxelNodes]);

  useEffect(() => {
    if (selectionUpdateFromOutside.current) {
      selectionUpdateFromOutside.current = false;
      return;
    }
    onNodeClick?.(selectedNode ?? null);
  }, [selectedNode, onNodeClick]);

  useEffect(() => {
    if (!releaseToken) return;
    setTimeout(() => setSelectedNode(null), 0);
    shouldSnapToTarget.current = false;
    setTimeout(() => setAutoRotate(true), 0);
  }, [releaseToken]);

  const relatedNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (selectedNode) {
      selectedNode.connections.forEach(id => set.add(id));
      voxelNodes.forEach(n => {
        if (n.connections.includes(selectedNode.id)) set.add(n.id);
      });
    }
    return set;
  }, [selectedNode, voxelNodes]);

  // --- Intelligent Features Logic ---

  // 1. Calculate Blast Radius (Impact Mode)
  const calculateBlastRadius = useCallback((startNodeId: string) => {
    const visited = new Set<string>();
    const queue = [startNodeId];
    visited.add(startNodeId);

    // Create a map for fast lookup of reverse connections
    const reverseConnections: Record<string, string[]> = {};
    voxelNodes.forEach(n => {
      n.connections.forEach(targetId => {
        if (!reverseConnections[targetId]) reverseConnections[targetId] = [];
        reverseConnections[targetId].push(n.id);
      });
    });

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const node = voxelNodes.find(n => n.id === currentId);

      if (node) {
        // Forward connections
        node.connections.forEach(connId => {
          if (!visited.has(connId)) {
            visited.add(connId);
            queue.push(connId);
          }
        });
      }

      // Reverse connections
      if (reverseConnections[currentId]) {
        reverseConnections[currentId].forEach(sourceId => {
          if (!visited.has(sourceId)) {
            visited.add(sourceId);
            queue.push(sourceId);
          }
        });
      }
    }
    return visited;
  }, [voxelNodes]);

  useEffect(() => {
    if (impactMode && selectedNode) {
      const impacted = calculateBlastRadius(selectedNode.id);
      setImpactedNodeIds(impacted);
    } else {
      setImpactedNodeIds(new Set());
    }
  }, [impactMode, selectedNode, calculateBlastRadius]);

  // Presentation Manager Component
  const PresentationManager: React.FC<{
    presentationMode: boolean | undefined;
    voxelNodes: VoxelNode[];
    onNodeSelect: (node: VoxelNode) => void;
  }> = ({ presentationMode, voxelNodes, onNodeSelect }) => {
    const lastPresentationSwitch = useRef(0);
    const [presentationIndex, setPresentationIndex] = useState(0);

    const criticalNodes = useMemo(() => {
      return voxelNodes.filter(node => {
        if (node.type === 'risk') return (node.data as Risk).score >= 12;
        if (node.type === 'incident') return (node.data as Incident).severity === 'Critique' || (node.data as Incident).severity === 'Élevée';
        return false;
      });
    }, [voxelNodes]);

    // Reset index when mode disabled
    useEffect(() => {
      if (!presentationMode) {
        setPresentationIndex(0);
      }
    }, [presentationMode]);

    useFrame((state) => {
      if (presentationMode && criticalNodes.length > 0) {
        // Switch every 8 seconds
        if (state.clock.elapsedTime - lastPresentationSwitch.current > 8) {
          lastPresentationSwitch.current = state.clock.elapsedTime;
          const nextIndex = (presentationIndex + 1) % criticalNodes.length;
          setPresentationIndex(nextIndex);

          // Auto-select the node
          const nextNode = criticalNodes[nextIndex];
          onNodeSelect(nextNode);
        }
      }
    });

    return null;
  };

  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [22, 12, 22], fov: 58 }}
        className="bg-slate-950"
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <fog attach="fog" args={['#020617', 40, 90]} />
        <ModelLibraryProvider>
          <color attach="background" args={[new Color('#020617')]} />
          <ambientLight intensity={0.55} />
          <pointLight position={[12, 18, 18]} intensity={1.2} color="#93c5fd" />
          <pointLight position={[-14, -12, -8]} intensity={0.7} color="#4ecdc4" />

          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            enableDamping
            autoRotate={autoRotate}
            autoRotateSpeed={0.35}
            minDistance={4}
            maxDistance={55}
            zoomSpeed={0.6}
            dampingFactor={0.05}
            ref={controlsRef as any}
          />

          {voxelNodes.length > 0 && (
            <Float floatIntensity={0.4} rotationIntensity={0.2} speed={1.2}>
              <PulseCore />
            </Float>
          )}
          <StarField />
          <NeonGrid />
          <ScanRing radius={12} color="#0ea5e9" />
          <ScanRing radius={18} color="#9333ea" speed={0.25} />
          <ScanRing radius={25} color="#f97316" speed={0.18} />

          <Environment preset="city" />

          {/* Target Reticle */}
          {selectedNode && (
            <TargetReticle position={selectedNode.position} size={selectedNode.size} color={selectedNode.color} />
          )}

          {/* Click Impact Wave */}
          {impactPosition && (
            <ImpactWave key={impactKey} position={impactPosition} />
          )}

          {/* Render connections */}
          {connectionPairs.map((pair, i) => {
            const isRelevant = !selectedNode ||
              pair.sourceId === selectedNode.id ||
              pair.targetId === selectedNode.id;

            return (
              <DataFlowParticles
                key={`conn-${i}`}
                start={new Vector3(...pair.start)}
                end={new Vector3(...pair.end)}
                color="#94a3b8"
                speed={pair.strength * 2}
                opacity={isRelevant ? 0.5 : 0.05}
                showParticles={isRelevant}
              />
            );
          })}

          {/* AI Suggested Links */}
          {aiConnectionPairs.map((pair, i) => {
            const isRelevant = !selectedNode ||
              pair.sourceId === selectedNode.id ||
              pair.targetId === selectedNode.id;

            return (
              <DataFlowParticles
                key={`ai-conn-${i}`}
                start={new Vector3(...pair.start)}
                end={new Vector3(...pair.end)}
                color="#fbbf24"
                speed={pair.strength * 2}
                opacity={isRelevant ? 0.6 : 0.1}
                showParticles={isRelevant}
              />
            );
          })}

          {/* Render voxel nodes */}
          {voxelNodes.length === 0 ? (
            <EmptyState3D />
          ) : (
            voxelNodes.map(node => {
              const isRelated = relatedNodeIds.has(node.id);
              const isImpacted = impactMode && impactedNodeIds.has(node.id);

              // In impact mode, dim everything except impacted nodes
              // In normal mode, dim everything except selected and related
              const isDimmed = impactMode
                ? !isImpacted
                : Boolean(selectedNode && node.id !== selectedNode.id && !isRelated);

              const isHighlighted = Boolean(selectedNode && (node.id === selectedNode.id || isRelated));

              return (
                <VoxelMesh
                  key={node.id}
                  node={node}
                  onClick={handleNodeClick}
                  isSelected={selectedNode?.id === node.id}
                  isDimmed={isDimmed}
                  isHighlighted={isHighlighted}
                  opacity={xRayMode ? 0.3 : 0.9}
                  highlightCritical={highlightCritical}
                  xRayMode={xRayMode}
                  overlayProps={overlayProps}
                  overlayOffset={overlayOffset}
                  isImpacted={isImpacted}
                />
              );
            })
          )}
          <FocusController
            target={branchPivotNode}
            controlsRef={controlsRef}
            setAutoRotate={setAutoRotate}
            userInteractingRef={isUserInteracting}
            shouldSnapRef={shouldSnapToTarget}
            focusOnCardRef={focusOnCardRef}
            overlayOffset={overlayOffset}
          />

          <PresentationManager
            presentationMode={presentationMode}
            voxelNodes={voxelNodes}
            onNodeSelect={(node) => {
              setSelectedNode(node);
              focusOnCardRef.current = true;
              shouldSnapToTarget.current = true;
              setImpactPosition(node.position);
              setImpactKey(prev => prev + 1);
            }}
          />

          <EffectComposer>
            <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.6} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </ModelLibraryProvider>
      </Canvas>

      {/* Controls overlay */}
      {summaryStats && (
        <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-xs text-slate-900 dark:text-white space-y-1 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-blue-600 dark:text-blue-300">{summaryStats.assets} Actifs</span>
            <span className="font-semibold text-orange-600 dark:text-orange-300">{summaryStats.risks} Risques</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-purple-600 dark:text-purple-200">{summaryStats.projects} Projets</span>
            <span className="font-semibold text-rose-600 dark:text-rose-300">{summaryStats.incidents} Incidents</span>
          </div>
          {highlightCritical && (
            <div className="text-[10px] uppercase tracking-[0.2em] text-rose-600 dark:text-rose-300">Heatmap active</div>
          )}
        </div>
      )}
    </div>
  );
};
