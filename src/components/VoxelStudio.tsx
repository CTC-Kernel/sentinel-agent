import React, { useRef, useState, useMemo, useEffect, createContext, useContext, useCallback, Component, ErrorInfo, Suspense } from 'react';
import { Canvas, useFrame, ThreeEvent, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Html, Text, Float, Edges, Environment, Billboard } from '@react-three/drei';
import { Vector3, Color, AdditiveBlending, Mesh, MeshBasicMaterial, Group, DoubleSide, CatmullRomCurve3, MeshPhysicalMaterial, Points as ThreePoints, Material, CanvasTexture } from 'three';
import { OrbitControls as OrbitControlsImpl, OBJLoader } from 'three-stdlib';
import { Asset, Risk, Project, Audit, Incident, Supplier, Control, VoxelNode, AISuggestedLink } from '../types';
import { VoxelDetailOverlay } from './VoxelDetailOverlay';

class VoxelErrorBoundary extends Component<{ children: React.ReactNode, fallback?: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode, fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: unknown) {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("Voxel 3D Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}


export interface VoxelDetail {
  id: string;
  title: string;
  type: string;
  owner: string;
  badge: string;
  gradient: string;
  stats: { label: string; value: string | number }[];
  meta: { label: string; value: string | number }[];
}

export interface RelatedElement {
  id: string;
  type: string;
  label: string;
  meta?: string;
}



interface VoxelStudioProps {
  assets: Asset[];
  risks: Risk[];
  projects: Project[];
  audits: Audit[];
  incidents: Incident[];
  suppliers: Supplier[];
  controls: Control[];
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
    controls: number;
  };
  xRayMode?: boolean;
  autoRotatePreference?: boolean | null;
  releaseToken?: number | null;
  suggestedLinks?: AISuggestedLink[];
  presentationMode?: boolean;
  // Overlay props
  selectedNodeDetails?: VoxelDetail | null;
  isDetailMinimized?: boolean;
  setIsDetailMinimized?: (v: boolean | ((prev: boolean) => boolean)) => void;
  handleSelectionClear?: () => void;
  relatedElements?: RelatedElement[];
  applyFocus?: (id: string, type: VoxelNode['type']) => void;
  handleOpenSelected?: () => void;
  impactMode?: boolean;
  setImpactMode?: (v: boolean) => void;
}

const safeRender = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && value !== null) {
    const val = value as { seconds?: number; nanoseconds?: number };
    if (val.seconds !== undefined && val.nanoseconds !== undefined) {
      return new Date(val.seconds * 1000).toLocaleDateString();
    }
    return ''; // Safely ignore other objects to prevent crashes
  }
  return String(value);
};

const SCENE_OFFSET: [number, number, number] = [5.5, 0, 0];

const applySceneOffset = (x: number, y: number, z: number): [number, number, number] => [
  x + SCENE_OFFSET[0],
  y + SCENE_OFFSET[1],
  z + SCENE_OFFSET[2]
];

const assetModelUrl = '/models/server/console.obj';
const riskModelUrl = '/models/shield/shield.obj';
const incidentModelUrl = '/models/flame/flame.obj';
const supplierModelUrl = '/models/cap/cap.obj';
const projectModelUrl = '/models/box/box.obj';

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
  const [library, setLibrary] = useState<ModelLibrary | null>(null);

  useEffect(() => {
    const loadModels = async () => {
      const loader = new OBJLoader();

      const loadSafe = async (url: string): Promise<Group> => {
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Status ${response.status}`);

          const text = await response.text();
          // Critical check: if the server returns HTML (e.g., fallback index.html), abort parsing
          if (text.trim().toLowerCase().startsWith('<!doctype html') || text.trim().toLowerCase().startsWith('<html')) {
            throw new Error('Received HTML instead of 3D model');
          }

          return loader.parse(text);
        } catch (error) {
          console.warn(`Failed to load 3D model from ${url}`, error);
          // Return an empty group as fallback to prevent crash
          return new Group();
        }
      };

      const [asset, risk, incident, supplier, project] = await Promise.all([
        loadSafe(assetModelUrl),
        loadSafe(riskModelUrl),
        loadSafe(incidentModelUrl),
        loadSafe(supplierModelUrl),
        loadSafe(projectModelUrl)
      ]);

      setLibrary({ asset, risk, incident, supplier, project });
    };

    loadModels();
  }, []);

  if (!library) return null; // Or a loading spinner if preferred

  return <ModelLibraryContext.Provider value={library}>{children}</ModelLibraryContext.Provider>;
};

const MODEL_LIBRARY_CONFIG: Partial<Record<VoxelNode['type'], { key: keyof ModelLibrary; scale: number; position?: [number, number, number]; rotation?: [number, number, number]; }>> = {
  asset: { key: 'asset', scale: 0.28, position: [0, -0.28, 0], rotation: [0, Math.PI, 0] },
  risk: { key: 'risk', scale: 0.25, position: [0, -0.22, 0], rotation: [-Math.PI / 2, 0, Math.PI] },
  incident: { key: 'incident', scale: 0.22, position: [0, -0.2, 0], rotation: [-Math.PI / 2, 0, 0] },
  supplier: { key: 'supplier', scale: 0.0045, position: [0, -0.004, 0], rotation: [-Math.PI / 2, Math.PI, 0] },
  project: { key: 'project', scale: 0.35, position: [0, -0.25, 0], rotation: [0, Math.PI, 0] },
};

const StarField: React.FC = () => {
  const starsRef = useRef<ThreePoints>(null);
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

  const circleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (context) {
      context.beginPath();
      context.arc(16, 16, 14, 0, 2 * Math.PI);
      context.fillStyle = 'white';
      context.fill();
    }
    return new CanvasTexture(canvas);
  }, []);

  useFrame((_, delta) => {
    if (starsRef.current) {
      starsRef.current.rotation.y += delta * 0.015;
      starsRef.current.rotation.x += delta * 0.005;
    }
  });

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        transparent
        map={circleTexture}
        alphaTest={0.5}
        color="#94a3b8"
        size={0.3}
        sizeAttenuation
        depthWrite={false}
        opacity={0.6}
      />
    </points>
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
    if (ref1.current) ref1.current.rotation.z -= delta * 0.2;
    if (ref2.current) ref2.current.rotation.z += delta * 0.1;
    if (ref3.current) {
      ref3.current.rotation.x += delta * 0.05;
      ref3.current.rotation.y += delta * 0.05;
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
        magnitude = 12;
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
      if (!userInteractingRef.current) {
        if (shouldSnapRef.current) {
          camera.position.lerp(desiredPos.current, 0.04);
          if (camera.position.distanceTo(desiredPos.current) < 0.05) {
            shouldSnapRef.current = false;
          }
        }
        // Always track target if not interacting, even after snap
        controls.target.lerp(focusVec.current, 0.08);
      }
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

const ScanRing: React.FC<{ radius: number; color: string; y?: number; speed?: number }> = ({ radius, color, y = -9.5, speed = 0.2 }) => {
  const ringRef = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z += delta * speed;
    const material = ringRef.current.material;
    if (Array.isArray(material)) return;
    (material as MeshBasicMaterial).opacity = 0.25 + Math.sin(Date.now() * 0.001 + radius) * 0.1;
  });

  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} raycast={() => null}>
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
      gridRef.current.rotation.z += delta * 0.005;
      (gridRef.current.material as MeshBasicMaterial).opacity = 0.15 + (Math.sin(state.clock.elapsedTime * 0.2) + 1) * 0.05;
    }
    if (grid2Ref.current) {
      grid2Ref.current.rotation.z -= delta * 0.005;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
      grid2Ref.current.scale.set(scale, scale, 1);
    }
  });

  return (
    <group position={[0, -10.2, 0]}>
      <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[140, 140, 40, 40]} />
        <meshBasicMaterial color="#1d4ed8" wireframe transparent opacity={0.2} />
      </mesh>
      <mesh ref={grid2Ref} rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, -0.1, 0]} raycast={() => null}>
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
    const t = Date.now() * 0.0008;
    const scale = 1 + Math.sin(t) * 0.08;
    coreRef.current.scale.set(scale, scale, scale);
    const material = coreRef.current.material;
    if (Array.isArray(material)) return;
    (material as MeshBasicMaterial).opacity = 0.1 + (Math.sin(t) + 1) * 0.05;
  });

  return (

    <mesh ref={coreRef} position={[0, -1, 0]} raycast={() => null}>
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

const DataFlowParticles: React.FC<{ start: Vector3; end: Vector3; color: string; opacity?: number; speed?: number; size?: number }> = ({ start, end, color, opacity = 0.5, speed = 1, size = 0.4 }) => {
  const pointsRef = useRef<ThreePoints>(null);
  const curve = useMemo(() => {
    if (!start || !end) return null;
    const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y += Math.max(2, start.distanceTo(end) * 0.2); // Dynamic arc height based on distance
    return new CatmullRomCurve3([start, mid, end]);
  }, [start, end]);

  // Generate initial particle positions along the curve
  const { positions, initialOffsets } = useMemo(() => {
    if (!curve) return { positions: new Float32Array(0), initialOffsets: new Float32Array(0) };
    const particleCount = 20; // Number of particles per flow
    const posArray = new Float32Array(particleCount * 3);
    const offsetArray = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      const point = curve.getPoint(t);
      posArray[i * 3] = point.x;
      posArray[i * 3 + 1] = point.y;
      posArray[i * 3 + 2] = point.z;
      // Pseudo-random but deterministic based on index to satisfy purity
      const pseudoRandom = (seed: number) => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      };
      offsetArray[i] = pseudoRandom(i + 1234);
    }
    return { positions: posArray, initialOffsets: offsetArray };
  }, [curve]);

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    return new CanvasTexture(canvas);
  }, []);

  useFrame((state) => {
    if (!pointsRef.current || !curve) return;
    const time = state.clock.getElapsedTime() * speed;
    const positionsAttribute = pointsRef.current.geometry.attributes.position;

    for (let i = 0; i < 20; i++) {
      // Calculate current position along curve based on time and offset
      const t = (time * 0.5 + initialOffsets[i]) % 1;
      const point = curve.getPoint(t);
      positionsAttribute.setXYZ(i, point.x, point.y, point.z);
    }
    positionsAttribute.needsUpdate = true;
  });

  if (!curve) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        color={color}
        transparent
        opacity={opacity}
        size={size}
        sizeAttenuation
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
};

const GlassMaterial: React.FC<React.ComponentProps<'meshPhysicalMaterial'> & { isDimmed?: boolean; isHighlighted?: boolean }> = ({ color, emissive, isDimmed, isHighlighted, ...props }) => (
  <meshPhysicalMaterial
    color={isDimmed ? '#1e293b' : isHighlighted ? '#ffffff' : color}
    emissive={isDimmed ? '#000000' : isHighlighted ? color : emissive}
    emissiveIntensity={isDimmed ? 0 : isHighlighted ? 1.8 : 0.6}
    roughness={isDimmed ? 0.9 : 0.15}
    metalness={isDimmed ? 0.1 : 0.1}
    transmission={isDimmed ? 0 : 0.9}
    thickness={isDimmed ? 0 : 2}
    ior={1.5}
    clearcoat={isDimmed ? 0 : 1}
    clearcoatRoughness={0.1}
    transparent
    opacity={isDimmed ? 0.1 : 1}
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
  overlayProps?: React.ComponentProps<typeof VoxelDetailOverlay>;
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
    const currentScale = useRef(1);
    const currentGlow = useRef(0);

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

    // Animate scale and glow using useFrame
    const targetScale = isSelected ? 1.3 : (hovered || isHighlighted || isImpacted) ? 1.15 : 1;
    const targetGlow = (isCritical && highlightCritical) || isImpacted ? 0.8 : 0;

    useFrame(() => {
      if (meshRef.current) {
        meshRef.current.rotation.y += 0.005;

        // Smooth interpolation for scale
        currentScale.current += (targetScale - currentScale.current) * 0.1;
        meshRef.current.scale.setScalar(currentScale.current);

        // Smooth interpolation for glow
        currentGlow.current += (targetGlow - currentGlow.current) * 0.1;

        // Update material emissive intensity directly if possible to avoid re-render
        meshRef.current.traverse((child) => {
          if ((child as Mesh).isMesh) {
            const mesh = child as Mesh;
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((mat: Material) => {
              if (mat && 'emissiveIntensity' in mat) {
                (mat as MeshPhysicalMaterial).emissiveIntensity = 0.35 + currentGlow.current * 0.4;
              }
            });
          }
        });
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
    // Initial static value for render, animation handles updates
    const emissiveIntensity = 0.35;

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
        default: {
          const n = node as VoxelNode;
          return (
            <mesh>
              <boxGeometry args={[n.size || 1, n.size || 1, n.size || 1]} />
              <GlassMaterial {...sharedMaterialProps} />
              <EdgesWithColor />
            </mesh>
          );
        }
      }
    };

    const getDataLabel = (data: VoxelNode['data']): string => {
      if (!data) return 'Élément';
      if ('name' in data && data.name) return String(data.name);
      if ('title' in data && data.title) return String(data.title);
      if ('threat' in data && data.threat) return String(data.threat);
      return 'Élément';
    };
    const rawLabel = getDataLabel(node.data) || 'Élément';
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
              zIndexRange={[100000, 0]}
              distanceFactor={10}
              occlude={false}
              transform
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
    if (!presentationMode && presentationIndex !== 0) {
      setTimeout(() => setPresentationIndex(0), 0);
    }
  }, [presentationMode, presentationIndex, setPresentationIndex]);

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

export const VoxelStudio: React.FC<VoxelStudioProps> = ({
  assets = [],
  risks = [],
  projects = [],
  audits = [],
  incidents = [],
  suppliers = [],
  controls = [],
  onNodeClick,
  className = "",
  visibleTypes = [],
  focusNodeId,
  highlightCritical = false,
  summaryStats,
  releaseToken,
  suggestedLinks = [], xRayMode, presentationMode,
  // Overlay props
  selectedNodeDetails, isDetailMinimized, setIsDetailMinimized, handleSelectionClear, relatedElements = [], applyFocus, handleOpenSelected,
  impactMode, setImpactMode
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
  // impactMode is now controlled by props
  // impactedNodeIds is now a computed value derived from useMemo


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
    selectedNodeDetails: selectedNodeDetails ?? null,
    isDetailMinimized: isDetailMinimized ?? false,
    setIsDetailMinimized: setIsDetailMinimized ?? (() => { }),
    handleSelectionClear: handleSelectionClear ?? (() => { }),
    relatedElements: relatedElements ?? [],
    applyFocus: (id: string, type: string) => applyFocus?.(id, type as VoxelNode['type']),
    handleOpenSelected: handleOpenSelected ?? (() => { }),
    onPositionChange: handleOverlayPositionChange,
    onRequestFocus: handleOverlayFocusRequest,
    impactMode,
    setImpactMode,
  };


  const safeAssets = useMemo(() => assets ?? [], [assets]);
  const safeRisks = useMemo(() => risks ?? [], [risks]);
  const safeProjects = useMemo(() => projects ?? [], [projects]);
  const safeAudits = useMemo(() => audits ?? [], [audits]);
  const safeIncidents = useMemo(() => incidents ?? [], [incidents]);

  // Convert data to voxel nodes
  const voxelNodes = useMemo(() => {
    const nodes: VoxelNode[] = [];
    const GRID_SIZE = 10;
    const spacing = 4;
    const currentVisible = visibleTypes || [];

    // --- 1. ASSETS (Base Foundation) ---
    if (currentVisible.includes('asset')) {
      safeAssets.forEach((asset, i) => {
        // Simple grid layout for assets
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;
        nodes.push({
          id: asset.id,
          position: applySceneOffset(col * 3 - (GRID_SIZE * 1.5), 0, row * 3 - (GRID_SIZE * 1.5)),
          color: '#3b82f6', // blue-500
          size: 1,
          type: 'asset',
          data: asset,
          connections: []
        });
      });
    }

    // --- 2. RISKS (Hovering above assets) ---
    if (currentVisible.includes('risk')) {
      safeRisks.forEach((risk, index) => {
        const x = (index % GRID_SIZE) * spacing - (GRID_SIZE * spacing) / 2;
        const z = Math.floor(index / GRID_SIZE) * spacing - (GRID_SIZE * spacing) / 2;
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
    }

    // --- 3. PROJECTS (Building blocks) ---
    if (currentVisible.includes('project')) {
      safeProjects.forEach((project, index) => {
        const x = (index % GRID_SIZE) * spacing - (GRID_SIZE * spacing) / 2;
        const z = Math.floor(index / GRID_SIZE) * spacing - (GRID_SIZE * spacing) / 2;
        const y = 0;
        nodes.push({
          id: project.id,
          type: 'project',
          position: applySceneOffset(x, y, z),
          color: '#a855f7', // purple-500
          size: 1.2,
          data: project,
          connections: project.relatedRiskIds || []
        });
      });
    }

    // --- 4. AUDITS (Satellites) ---
    if (currentVisible.includes('audit')) {
      safeAudits.forEach((audit, i) => {
        const angle = (i / (safeAudits.length || 1)) * Math.PI * 2;
        const radius = 12;
        nodes.push({

          id: audit.id,
          position: applySceneOffset(Math.cos(angle) * radius, 8, Math.sin(angle) * radius),
          color: '#06b6d4', // cyan-500
          size: 0.9,
          type: 'audit',
          data: audit,
          connections: [
            ...(audit.relatedAssetIds || []),
            ...(audit.relatedRiskIds || []),
            ...(audit.relatedProjectIds || [])
          ]
        });
      });
    }

    // --- 5. INCIDENTS (Warning flares) ---
    if (currentVisible.includes('incident')) {
      safeIncidents.forEach((incident, i) => {
        const angle = (i / (safeIncidents.length || 1)) * Math.PI * 2 + 1;
        const radius = 15;
        const isCritical = incident.severity === 'Critique' || incident.severity === 'Élevée';
        nodes.push({
          id: incident.id,
          position: applySceneOffset(Math.cos(angle) * radius, isCritical ? 12 : 6, Math.sin(angle) * radius),
          color: '#f43f5e', // rose-500
          size: isCritical ? 1.5 : 1,
          type: 'incident',
          data: incident,
          connections: incident.affectedAssetId ? [incident.affectedAssetId] : []
        });
      });
    }

    // --- 6. SUPPLIERS (External Orbit) ---
    // Map Suppliers (Green)
    if (visibleTypes.includes('supplier')) {
      nodes.push(...suppliers.map((s, i) => {
        const x = Math.cos(i * 0.5 + 2) * 16;
        const z = Math.sin(i * 0.5 + 2) * 16;
        // Connection logic for Suppliers ...
        const connections: string[] = [];
        if (s.relatedAssetIds) connections.push(...s.relatedAssetIds);
        if (s.relatedProjectIds) connections.push(...s.relatedProjectIds);

        return {
          id: s.id,
          type: 'supplier' as const,
          data: s,
          position: applySceneOffset(x, 1, z),
          color: '#22c55e',
          size: 1.1,
          connections
        };
      }));
    }

    // Map Controls (Teal)
    if (visibleTypes.includes('control')) {
      nodes.push(...controls.map((c, i) => {
        const angle = (i / (controls.length || 1)) * Math.PI * 2;
        const radius = 35;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const connections: string[] = [];
        if (c.relatedAssetIds) connections.push(...c.relatedAssetIds);
        if (c.relatedRiskIds) connections.push(...c.relatedRiskIds);

        return {
          id: c.id,
          type: 'control' as const,
          data: c,
          position: applySceneOffset(x, 2, z),
          color: '#14b8a6', // Teal
          size: 1.0,
          connections
        };
      }));
    }

    return nodes;
  }, [safeAssets, safeRisks, safeProjects, safeAudits, safeIncidents, suppliers, controls, visibleTypes]);

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

  const connectionPairs = useMemo(() => {
    const pairs: { start: [number, number, number]; end: [number, number, number]; strength: number; sourceId: string; targetId: string; type?: string }[] = [];
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
          pairs.push({
            start: node.position,
            end: target.position,
            strength,
            sourceId: node.id,
            targetId: target.id,
            type: node.type
          });
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
    isUserInteracting.current = false;
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
      // Only update if the node is different to avoid infinite loops
      if (selectedNode?.id !== node.id) {
        setTimeout(() => setSelectedNode(node), 0);
        focusOnCardRef.current = true;
        shouldSnapToTarget.current = true;
        // Force snap even if user interacts, to ensure focus shift
        isUserInteracting.current = false;
        if (controlsRef.current) {
          // Reset controls state to allow new snap
        }
      }
    }
  }, [focusNodeId, voxelNodes, selectedNode]);

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

    while (queue && queue.length > 0) {
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

  const impactedNodeIds = useMemo(() => {
    if (impactMode && selectedNode) {
      return calculateBlastRadius(selectedNode.id);
    }
    return new Set<string>();
  }, [impactMode, selectedNode, calculateBlastRadius]);



  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [22, 12, 22], fov: 58 }}
        className="bg-slate-950"
        dpr={[1, 2]}
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <fog attach="fog" args={['#020617', 40, 90]} />
        <fog attach="fog" args={['#020617', 40, 90]} />
        <VoxelErrorBoundary fallback={null}>
          <Suspense fallback={null}>
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
                ref={controlsRef}
              />

              {voxelNodes.length > 0 && (
                <Float floatIntensity={0.4} rotationIntensity={0.2} speed={1.2}>
                  <PulseCore />
                </Float>
              )}
              <StarField />
              <NeonGrid />
              <ScanRing radius={12} color="#0ea5e9" />
              <ScanRing radius={18} color="#9333ea" speed={0.15} />
              <ScanRing radius={25} color="#f97316" speed={0.1} />

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
              {(connectionPairs || []).map((pair, i) => {
                const isRelevant = !selectedNode ||
                  pair.sourceId === selectedNode.id ||
                  pair.targetId === selectedNode.id;

                // Don't render irrelevant links if focusing on one node, to reduce noise
                if (selectedNode && !isRelevant && !impactMode) return null;

                return (
                  <DataFlowParticles
                    key={`conn-${i}`}
                    start={new Vector3(...pair.start)}
                    end={new Vector3(...pair.end)}
                    color={pair.type === 'risk' ? '#f87171' : '#94a3b8'} // Red for risk, gray for default
                    opacity={isRelevant ? 1.0 : 0.05}
                    speed={isRelevant ? 0.8 : 0.15}
                    size={isRelevant ? 0.7 : 0.2}
                  />
                );
              })}

              {/* AI Suggested Links */}
              {(aiConnectionPairs || []).map((pair, i) => {
                const isRelevant = !selectedNode ||
                  pair.sourceId === selectedNode.id ||
                  pair.targetId === selectedNode.id;

                return (
                  <DataFlowParticles
                    key={`ai-conn-${i}`}
                    start={new Vector3(...pair.start)}
                    end={new Vector3(...pair.end)}
                    color="#fbbf24"
                    opacity={isRelevant ? 0.6 : 0.1}
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

              {/* <EffectComposer>
              <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} />
              <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer> */}
            </ModelLibraryProvider>
          </Suspense>
        </VoxelErrorBoundary>
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
