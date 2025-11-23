import React, { useRef, useState, useMemo, useEffect, createContext, useContext } from 'react';
import { Canvas, useFrame, ThreeEvent, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Text, Line, Points, PointMaterial, Float } from '@react-three/drei';
import { Vector3, Color, AdditiveBlending, Mesh, MeshBasicMaterial, Group, MeshStandardMaterial, DoubleSide } from 'three';
import { Line2, LineMaterial, OrbitControls as OrbitControlsImpl, OBJLoader } from 'three-stdlib';
import { animated, useSpring } from '@react-spring/three';
import { Asset, Risk, Project, Audit, Incident, Supplier } from '../types';

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
}

const AnimatedGroup = animated.group;

const assetModelUrl = new URL('../3D/w2yurp9pjcow-ServerV2console/ServerV2+console.obj', import.meta.url).href;
const riskModelUrl = new URL('../3D/A_Shield_with_a_Raised_Star_v1_L1.123c9f2a1173-8c93-4a8d-a572-89acfb9632eb/19329_A_Shield_with_a_Raised_Star_v1.obj', import.meta.url).href;
const incidentModelUrl = new URL('../3D/Flame_v1_L1.123c9492eea4-9564-46cc-bdc9-fe01a6e3b117/21330_Flame_v1.obj', import.meta.url).href;

type ModelLibrary = {
  asset: Group;
  risk: Group;
  incident: Group;
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
  const value = useMemo(() => ({ asset, risk, incident }), [asset, risk, incident]);
  return <ModelLibraryContext.Provider value={value}>{children}</ModelLibraryContext.Provider>;
};

const MODEL_LIBRARY_CONFIG: Partial<Record<VoxelNode['type'], { key: keyof ModelLibrary; scale: number; position?: [number, number, number]; rotation?: [number, number, number]; }>> = {
  asset: { key: 'asset', scale: 0.28, position: [0, -0.28, 0], rotation: [0, Math.PI, 0] },
  risk: { key: 'risk', scale: 0.25, position: [0, -0.22, 0], rotation: [-Math.PI / 2, 0, Math.PI] },
  incident: { key: 'incident', scale: 0.22, position: [0, -0.2, 0], rotation: [-Math.PI / 2, 0, 0] },
};

const StarField: React.FC = () => {
  const positions = useMemo(() => {
    const starCount = 1200;
    const array = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      array[i * 3] = (Math.random() - 0.5) * 200;
      array[i * 3 + 1] = (Math.random() - 0.5) * 80;
      array[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    return array;
  }, []);

  return (
    <Points positions={positions} stride={3} frustumCulled={false}>
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

const SelectionLockAura: React.FC<{ node: VoxelNode | null }> = ({ node }) => {
  const auraRef = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (!auraRef.current) return;
    auraRef.current.rotation.y += delta * 0.4;
  });

  if (!node) return null;
  return (
    <group position={node.position}>
      <mesh ref={auraRef} scale={[1.2, 1, 1.2]}> 
        <ringGeometry args={[node.size * 1.6, node.size * 2.2, 64]} />
        <meshBasicMaterial
          color={node.color}
          transparent
          opacity={0.35}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[node.size * 1.4, 32, 32]} />
        <meshBasicMaterial
          color={node.color}
          transparent
          opacity={0.08}
          blending={AdditiveBlending}
        />
      </mesh>
      <pointLight position={[0, node.size * 2, 0]} intensity={0.7} distance={18} color={node.color} />
    </group>
  );
};

const FocusController: React.FC<{ target: VoxelNode | null; controlsRef: React.RefObject<OrbitControlsImpl | null>; setAutoRotate: (value: boolean) => void; userInteractingRef: React.MutableRefObject<boolean>; shouldSnapRef: React.MutableRefObject<boolean> }> = ({ target, controlsRef, setAutoRotate, userInteractingRef, shouldSnapRef }) => {
  const { camera } = useThree();
  const focusVec = useRef(new Vector3(0, 0, 0));
  const desiredPos = useRef(camera.position.clone());
  const defaultPos = useRef(camera.position.clone());
  const defaultTarget = useRef(new Vector3(0, 0, 0));
  const offsetVec = useRef(new Vector3(6, 4, 6));

  useEffect(() => {
    if (target) {
      setAutoRotate(false);
    }
  }, [target, setAutoRotate]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (target) {
      focusVec.current.set(...target.position);
      const magnitude = Math.max(3, target.size * 4);
      offsetVec.current.set(magnitude * 0.9, magnitude + 3, magnitude * 1.2);
      desiredPos.current.copy(focusVec.current).add(offsetVec.current);
      if (!userInteractingRef.current && shouldSnapRef.current) {
        camera.position.lerp(desiredPos.current, 0.08);
        if (camera.position.distanceTo(desiredPos.current) < 0.05) {
          shouldSnapRef.current = false;
        }
      }
      controls.target.lerp(focusVec.current, 0.15);
    } else {
      camera.position.lerp(defaultPos.current, 0.02);
      controls.target.lerp(defaultTarget.current, 0.05);
    }

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
  useFrame((_, delta) => {
    if (!gridRef.current) return;
    gridRef.current.rotation.z += delta * 0.02;
    const material = gridRef.current.material;
    if (Array.isArray(material)) return;
    (material as MeshBasicMaterial).opacity = 0.15 + (Math.sin(Date.now() * 0.0008) + 1) * 0.05;
  });

  return (
    <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -10.2, 0]} frustumCulled={false}>
      <planeGeometry args={[140, 140, 40, 40]} />
      <meshBasicMaterial
        color="#1d4ed8"
        wireframe
        transparent
        opacity={0.2}
      />
    </mesh>
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

const VoxelMesh: React.FC<{ node: VoxelNode; onClick: (node: VoxelNode) => void; isSelected: boolean; isDimmed: boolean; highlightCritical?: boolean; xRayMode?: boolean }> = ({ 
  node, 
  onClick, 
  isSelected,
  isDimmed,
  highlightCritical,
  xRayMode
}) => {
  const modelLibrary = useModelLibrary();
  const meshRef = useRef<any>(null);
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
  const selectionScale = usesLibraryModel ? (isSelected ? 1.08 : hovered ? 1.04 : 1) : (isSelected ? 1.5 : hovered ? 1.2 : 1);
  const criticalBoost = highlightCritical && isCritical ? (usesLibraryModel ? 1.05 : 1.15) : 1;

  const { scale, glow } = useSpring({
    scale: selectionScale * criticalBoost,
    glow: (isSelected ? 1 : hovered ? 0.6 : 0) + (highlightCritical && isCritical ? 0.4 : 0),
    config: { mass: 1, tension: 200, friction: 18 }
  });

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onClick(node);
  };

  const baseColor = isSelected ? '#fde047' : hovered ? '#4ecdc4' : node.color;
  const emissiveColor = isSelected ? '#fbbf24' : hovered ? '#4ecdc4' : node.color;
  const baseOpacity = isDimmed ? 0.4 : highlightCritical && !isCritical ? 0.7 : 0.95;
  const opacity = usesLibraryModel ? Math.max(baseOpacity, 0.85) : baseOpacity;
  const emissiveIntensity = 0.35 + glow.get() * 0.4;

  const sharedMaterialProps = {
    color: baseColor,
    emissive: emissiveColor,
    emissiveIntensity,
    metalness: 0.35,
    roughness: 0.25,
    opacity,
    transparent: true,
    wireframe: Boolean(xRayMode),
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
        (child as Mesh).material = new MeshStandardMaterial({
          color: baseColor,
          emissive: emissiveColor,
          emissiveIntensity,
          metalness: 0.35,
          roughness: 0.25,
          transparent: true,
          opacity,
          wireframe: Boolean(xRayMode),
          side: DoubleSide
        });
      }
    });
    return clone;
  }, [modelLibrary, node.type, node.size, baseColor, emissiveColor, emissiveIntensity, opacity, xRayMode]);

  const renderCategoryModel = () => {
    if (libraryPrimitive) {
      return <primitive object={libraryPrimitive} />;
    }
    switch (node.type) {
      case 'asset':
        return (
          <>
            <mesh position={[0, -node.size * 0.2, 0]}>
              <boxGeometry args={[node.size * 0.9, node.size * 0.25, node.size * 0.6]} />
              <meshStandardMaterial {...sharedMaterialProps} />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[node.size * 0.75, node.size * 0.2, node.size * 0.5]} />
              <meshStandardMaterial {...sharedMaterialProps} />
            </mesh>
            <mesh position={[0, node.size * 0.18, 0]}>
              <boxGeometry args={[node.size * 0.55, node.size * 0.18, node.size * 0.4]} />
              <meshStandardMaterial {...sharedMaterialProps} />
            </mesh>
            {[ -0.25, 0.25 ].map(offset => (
              <mesh key={`asset-light-${node.id}-${offset}`} position={[offset * node.size, node.size * 0.28, node.size * 0.18]}>
                <boxGeometry args={[node.size * 0.08, node.size * 0.06, node.size * 0.02]} />
                <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.7} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
              </mesh>
            ))}
          </>
        );
      case 'risk':
        return (
          <>
            <mesh rotation={[0, 0, Math.PI / 4]}>
              <octahedronGeometry args={[node.size * 0.6, 0]} />
              <meshStandardMaterial {...sharedMaterialProps} metalness={0.2} roughness={0.35} />
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
                  <meshStandardMaterial
                    color="#f97316"
                    emissive="#fb923c"
                    emissiveIntensity={0.8}
                    opacity={opacity}
                    transparent
                    wireframe={Boolean(xRayMode)}
                  />
                </mesh>
              );
            })}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[node.size * 0.55, node.size * 0.05, 16, 32]} />
              <meshStandardMaterial color="#f97316" emissive="#fb923c" emissiveIntensity={0.5} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
            </mesh>
          </>
        );
      case 'project':
        return (
          <>
            <mesh position={[0, -node.size * 0.18, 0]}>
              <cylinderGeometry args={[node.size * 0.7, node.size * 0.7, node.size * 0.18, 24]} />
              <meshStandardMaterial {...sharedMaterialProps} />
            </mesh>
            <mesh position={[0, node.size * 0.05, 0]}>
              <cylinderGeometry args={[node.size * 0.5, node.size * 0.5, node.size * 0.35, 24]} />
              <meshStandardMaterial {...sharedMaterialProps} />
            </mesh>
            <mesh position={[0, node.size * 0.32, 0]}>
              <cylinderGeometry args={[node.size * 0.18, node.size * 0.18, node.size * 0.7, 12]} />
              <meshStandardMaterial color="#fcd34d" emissive="#fbbf24" emissiveIntensity={0.8} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, node.size * 0.05, 0]}>
              <ringGeometry args={[node.size * 0.55, node.size * 0.58, 32]} />
              <meshStandardMaterial color="#c084fc" emissive="#c084fc" emissiveIntensity={0.4} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
            </mesh>
          </>
        );
      case 'audit':
        return (
          <>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[node.size * 0.6, node.size * 0.1, 24, 48]} />
              <meshStandardMaterial {...sharedMaterialProps} metalness={0.5} roughness={0.2} />
            </mesh>
            <mesh position={[0, node.size * 0.18, 0]}>
              <boxGeometry args={[node.size * 0.75, node.size * 0.04, node.size * 0.55]} />
              <meshStandardMaterial {...sharedMaterialProps} />
            </mesh>
            <mesh position={[0, node.size * 0.06, 0]}>
              <boxGeometry args={[node.size * 0.22, node.size * 0.25, node.size * 0.06]} />
              <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.7} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
            </mesh>
            <mesh position={[node.size * 0.35, node.size * 0.05, node.size * 0.2]}>
              <torusGeometry args={[node.size * 0.12, node.size * 0.03, 16, 32]} />
              <meshStandardMaterial color="#f8fafc" emissive="#e2e8f0" emissiveIntensity={0.4} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
            </mesh>
          </>
        );
      case 'incident':
        return (
          <>
            <mesh>
              <sphereGeometry args={[node.size * 0.55, 28, 28]} />
              <meshStandardMaterial {...sharedMaterialProps} metalness={0.15} roughness={0.35} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[node.size * 0.75, node.size * 0.08, 24, 48]} />
              <meshStandardMaterial color="#fb7185" emissive="#f43f5e" emissiveIntensity={0.8} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
            </mesh>
            <mesh position={[0, node.size * 0.55, 0]}>
              <coneGeometry args={[node.size * 0.2, node.size * 0.5, 12]} />
              <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.9} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
            </mesh>
            <mesh position={[node.size * 0.45, 0, 0]} rotation={[0, 0, Math.PI / 6]}>
              <boxGeometry args={[node.size * 0.2, node.size * 0.4, node.size * 0.04]} />
              <meshStandardMaterial color="#fee2e2" emissive="#fecaca" emissiveIntensity={0.6} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
            </mesh>
          </>
        );
      case 'supplier':
        return (
          <>
            <mesh position={[0, -node.size * 0.12, 0]}>
              <cylinderGeometry args={[node.size * 0.45, node.size * 0.45, node.size * 0.35, 20]} />
              <meshStandardMaterial {...sharedMaterialProps} />
            </mesh>
            <mesh position={[0, node.size * 0.22, 0]}>
              <coneGeometry args={[node.size * 0.55, node.size * 0.75, 20]} />
              <meshStandardMaterial {...sharedMaterialProps} />
            </mesh>
            {[...Array(6)].map((_, index) => {
              const angle = (Math.PI * 2 * index) / 6;
              return (
                <mesh key={`supplier-node-${node.id}-${index}`} position={[Math.cos(angle) * node.size * 0.8, node.size * 0.12, Math.sin(angle) * node.size * 0.8]}>
                  <sphereGeometry args={[node.size * 0.12, 16, 16]} />
                  <meshStandardMaterial color="#4ade80" emissive="#22c55e" emissiveIntensity={0.6} opacity={opacity} transparent wireframe={Boolean(xRayMode)} />
                </mesh>
              );
            })}
          </>
        );
      default:
        return (
          <mesh>
            <boxGeometry args={[node.size, node.size, node.size]} />
            <meshStandardMaterial {...sharedMaterialProps} />
          </mesh>
        );
    }
  };

  return (
    <group position={node.position}>
      <AnimatedGroup
        ref={meshRef}
        scale={scale as any}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {renderCategoryModel()}
      </AnimatedGroup>

      {(hovered || isSelected) && (
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
      <Text
        position={[0, node.size + 1, 0]}
        fontSize={0.8}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.1}
        outlineColor="black"
      >
        {(node.data as any).name || (node.data as any).title || 'Unknown'}
      </Text>
    </group>
  );
};

const ConnectionLine: React.FC<{ start: [number, number, number]; end: [number, number, number]; strength: number }> = ({ 
  start, 
  end, 
  strength 
}) => {
  const points = useMemo(() => [new Vector3(...start), new Vector3(...end)], [start, end]);
  const lineRef = useRef<Line2 | null>(null);

  useFrame(() => {
    if (!lineRef.current) return;
    const material = lineRef.current.material as LineMaterial | LineMaterial[];
    if (Array.isArray(material)) return;
    material.opacity = 0.35 + Math.sin(Date.now() * 0.001 + start[0]) * 0.15;
    material.needsUpdate = true;
  });

  return (
    <Line
      ref={lineRef as any}
      points={points}
      color="#94a3b8"
      lineWidth={strength * 2.5}
      transparent
      opacity={0.5}
    />
  );
};

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
  summaryStats
}) => {
  const [selectedNode, setSelectedNode] = useState<VoxelNode | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const selectionUpdateFromOutside = useRef(false);
  const isUserInteracting = useRef(false);
  const shouldSnapToTarget = useRef(false);

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
        position: [x, y, z],
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
        position: [x, y, z],
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
        position: [x, y, z],
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
        position: [x, y, z],
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
        position: [x, y, z],
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
          position: [x, y, z],
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
      setAutoRotate(false);
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
    const pairs: { start: [number, number, number]; end: [number, number, number]; strength: number }[] = [];
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
          pairs.push({ start: node.position, end: target.position, strength });
        }
      });
    });
    return pairs;
  }, [voxelNodes]);

  const branchPivotNode = useMemo(() => {
    return selectedNode;
  }, [selectedNode]);

  const handleNodeClick = (node: VoxelNode) => {
    setSelectedNode(node);
    shouldSnapToTarget.current = true;
  };

  useEffect(() => {
    if (selectedNode && !voxelNodes.find(node => node.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [voxelNodes, selectedNode]);

  useEffect(() => {
    if (focusNodeId === undefined) return;
    selectionUpdateFromOutside.current = true;
    if (focusNodeId === null) {
      setSelectedNode(null);
      shouldSnapToTarget.current = false;
      return;
    }
    const node = voxelNodes.find(n => n.id === focusNodeId);
    if (node) {
      setSelectedNode(node);
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

  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [22, 12, 22], fov: 58 }}
        className="bg-slate-950"
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <ModelLibraryProvider>
          <color attach="background" args={[new Color('#020617')]} />
          <ambientLight intensity={0.55} />
          <pointLight position={[12, 18, 18]} intensity={1.2} color="#93c5fd" />
          <pointLight position={[-14, -12, -8]} intensity={0.7} color="#4ecdc4" />

          <OrbitControls 
            enablePan
            enableZoom
            enableRotate
            autoRotate={autoRotate}
            autoRotateSpeed={0.35}
            minDistance={4}
            maxDistance={55}
            zoomSpeed={0.8}
            dampingFactor={0.12}
            ref={controlsRef as any}
          />

          <Float floatIntensity={0.4} rotationIntensity={0.2} speed={1.2}>
            <PulseCore />
          </Float>
          <StarField />
          <NeonGrid />
          <ScanRing radius={12} color="#0ea5e9" />
          <ScanRing radius={18} color="#9333ea" speed={0.25} />
          <ScanRing radius={25} color="#f97316" speed={0.18} />

          {/* Render connections */}
          {connectionPairs.map((pair, index) => (
            <ConnectionLine
              key={`${pair.start.join('-')}-${pair.end.join('-')}-${index}`}
              start={pair.start}
              end={pair.end}
              strength={pair.strength}
            />
          ))}

          {/* Render voxel nodes */}
          {voxelNodes.map(node => (
            <VoxelMesh
              key={node.id}
              node={node}
              onClick={handleNodeClick}
              isSelected={selectedNode?.id === node.id}
              isDimmed={Boolean(selectedNode && selectedNode.id !== node.id)}
              highlightCritical={highlightCritical}
            />
          ))}

          <SelectionLockAura node={selectedNode} />
          <FocusController target={branchPivotNode} controlsRef={controlsRef} setAutoRotate={setAutoRotate} userInteractingRef={isUserInteracting} shouldSnapRef={shouldSnapToTarget} />

          {/* Fog for depth */}
          <fog attach="fog" args={['#0f172a', 12, 60]} />
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

      {/* Node info panel */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-900/95 backdrop-blur-sm rounded-xl p-4 border border-slate-200 dark:border-slate-700 max-w-sm shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-900 dark:text-white font-bold capitalize">{selectedNode?.type}</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              ×
            </button>
          </div>
          <p className="text-slate-700 dark:text-white text-sm mb-2">
            {(selectedNode?.data as Asset)?.name ||
              (selectedNode?.data as Project)?.name ||
              (selectedNode?.data as Incident)?.title ||
              (selectedNode?.data as Audit)?.name ||
              (selectedNode?.data as Supplier)?.name ||
              (selectedNode?.data as Risk)?.threat ||
              'Élément' }
          </p>
          {selectedNode?.type === 'risk' && (
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <p>Score: {(selectedNode?.data as Risk)?.score}</p>
              <p>Stratégie: {(selectedNode?.data as Risk)?.strategy}</p>
            </div>
          )}
          {selectedNode?.type === 'asset' && (
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <p>Type: {(selectedNode?.data as Asset)?.type}</p>
              <p>Propriétaire: {(selectedNode?.data as Asset)?.owner}</p>
            </div>
          )}
          {selectedNode?.type === 'project' && (
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <p>Progression: {(selectedNode?.data as Project)?.progress}%</p>
              <p>Statut: {(selectedNode?.data as Project)?.status}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
