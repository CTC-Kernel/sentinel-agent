
import React, { useRef, useState, useMemo, useEffect, useCallback, Component, ErrorInfo, Suspense } from 'react';
import { startTransition } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Billboard, Text, Float, Environment } from '@react-three/drei';
import { Vector3, Color, AdditiveBlending, Mesh, MeshBasicMaterial, CanvasTexture, CatmullRomCurve3, Points as ThreePoints, DoubleSide, Group } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Asset, Risk, Project, Audit, Incident, Supplier, Control, VoxelNode, VoxelNodeType, VoxelNodeStatus, AISuggestedLink } from '../types';
import { ErrorLogger } from '../services/errorLogger';
import { VoxelMesh } from './voxel/VoxelMesh';
import { ModelLibraryProvider } from '../contexts/ModelLibraryContext';


// Helper for CSS Variables
const resolveHslCssVar = (cssVarName: string, fallbackHsl: string) => {
  if (typeof window === 'undefined' || !window.document?.documentElement) return `hsl(${fallbackHsl})`;

  const raw = getComputedStyle(window.document.documentElement)
    .getPropertyValue(cssVarName)
    .trim();

  if (!raw) return `hsl(${fallbackHsl})`;
  if (raw.startsWith('hsl(')) return raw;
  return `hsl(${raw})`;
};

const useResolvedHslCssVar = (cssVarName: string, fallbackHsl: string) => {
  const [value, setValue] = useState(() => resolveHslCssVar(cssVarName, fallbackHsl));

  useEffect(() => {
    const update = () => setValue(resolveHslCssVar(cssVarName, fallbackHsl));
    update();
    if (typeof window === 'undefined') return;
    const target = window.document?.documentElement;
    if (!target) return;
    const observer = new MutationObserver(update);
    observer.observe(target, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, [cssVarName, fallbackHsl]);

  return value;
};

class VoxelErrorBoundary extends Component<{ children: React.ReactNode, fallback?: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode, fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_error: unknown) {
    return { hasError: true };
  }
  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    ErrorLogger.error(error as Error, 'VoxelStudio.componentDidCatch', { metadata: errorInfo as unknown as Record<string, unknown> });
  }
  render() {
    if (this.state.hasError) return this.props.fallback || null;
    return this.props.children;
  }
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
  xRayMode?: boolean;
  autoRotatePreference?: boolean | null;
  releaseToken?: number | null;
  suggestedLinks?: AISuggestedLink[];
  presentationMode?: boolean;
  impactMode?: boolean;
}

const disableRaycast = () => null;

const StarField: React.FC = () => {
  const starsColor = useResolvedHslCssVar('--muted-foreground', '215 20% 65%');
  const starsRef = useRef<ThreePoints>(null);
  const positions = useMemo(() => {
    const starCount = 1200;
    const array = new Float32Array(starCount * 3);
    // Use a seeded random approach for reproducible results
    const seed = 42;
    const random = (min: number, max: number) => {
      const x = Math.sin(seed + min + max) * 10000;
      return min + (x - Math.floor(x)) * (max - min);
    };
    for (let i = 0; i < starCount; i++) {
      array[i * 3] = random(-100, 100);
      array[i * 3 + 1] = random(-40, 40);
      array[i * 3 + 2] = random(-100, 100);
    }
    return array;
  }, []);

  const circleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const context = canvas.getContext('2d');
    if (context) {
      context.beginPath(); context.arc(16, 16, 14, 0, 2 * Math.PI);
      context.fillStyle = 'white'; context.fill();
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
        <bufferAttribute attach="attributes-position" count={positions.length / 3} args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial transparent map={circleTexture} alphaTest={0.5} color={starsColor} size={0.3} sizeAttenuation depthWrite={false} opacity={0.6} />
    </points>
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

  const scale = Number.isFinite(size) && size > 0 ? size * 1.8 : 1.8;

  return (
    <group position={position}>
      <mesh ref={ref1} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[scale * 0.9, scale * 0.95, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={DoubleSide} />
      </mesh>
      <mesh ref={ref2} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[scale * 1.1, scale * 1.15, 4, 1, 0, Math.PI / 2]} />
        <meshBasicMaterial color="white" transparent opacity={0.6} side={DoubleSide} />
      </mesh>
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

const FocusController: React.FC<{ target: VoxelNode | null; controlsRef: React.RefObject<OrbitControlsImpl | null>; setAutoRotate: (value: boolean) => void; userInteractingRef: React.MutableRefObject<boolean>; shouldSnapRef: React.MutableRefObject<boolean>; }> = ({ target, controlsRef, setAutoRotate, userInteractingRef, shouldSnapRef }) => {
  const { camera } = useThree();
  const focusVec = useRef(new Vector3(0, 0, 0));
  const desiredPos = useRef(camera.position.clone());
  const defaultPos = useRef(new Vector3(22, 12, 22));
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
      focusVec.current.set(target.position.x, target.position.y, target.position.z);
      const magnitude = Math.max(4, target.size * 5);
      const verticalFactor = 0.6;
      const horizontalDir = focusVec.current.clone().setY(0);
      if (horizontalDir.lengthSq() < 1e-3) horizontalDir.set(0, 0, 1);

      horizontalDir.normalize().multiplyScalar(-1);
      offsetVec.current.copy(horizontalDir.multiplyScalar(magnitude * 1.2));
      offsetVec.current.y = magnitude * verticalFactor + 2;
      desiredPos.current.copy(focusVec.current).add(offsetVec.current);

      if (!userInteractingRef.current) {
        if (shouldSnapRef.current) {
          camera.position.lerp(desiredPos.current, 0.04);
          if (camera.position.distanceTo(desiredPos.current) < 0.05) shouldSnapRef.current = false;
        }
        if (controls.target) {
          controls.target.lerp(focusVec.current, 0.08);
        }
      }
    } else if (isResetting.current) {
      if (userInteractingRef.current) {
        isResetting.current = false;
      } else {
        camera.position.lerp(defaultPos.current, 0.03);
        if (controls.target) {
          controls.target.lerp(defaultTarget.current, 0.05);
        }
        if (camera.position.distanceTo(defaultPos.current) < 0.5) isResetting.current = false;
      }
    }
    // controls.update() is handled automatically by @react-three/drei's OrbitControls
    // Removing it prevents potential conflicts and "undefined is not an object" errors during hot reloads or unmounts
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
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} raycast={disableRaycast}>
      <ringGeometry args={[radius - 0.2, radius, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.35} blending={AdditiveBlending} />
    </mesh>
  );
};

const NeonGrid: React.FC = () => {
  // keeping simplified version from original
  return (
    <group position={[0, -10.2, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={disableRaycast}>
        <planeGeometry args={[140, 140, 40, 40]} />
        <meshBasicMaterial color="#1d4ed8" wireframe transparent opacity={0.2} />
      </mesh>
    </group>
  )
}

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
    <mesh ref={coreRef} position={[0, -1, 0]} raycast={disableRaycast}>
      <sphereGeometry args={[1.2, 32, 32]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.12} blending={AdditiveBlending} />
    </mesh>
  );
};

const DataFlowParticles: React.FC<{ start: Vector3; end: Vector3; color: string; opacity?: number; speed?: number; size?: number }> = ({ start, end, color, opacity = 0.5, speed = 1, size = 0.4 }) => {
  const pointsRef = useRef<ThreePoints>(null);
  const curve = useMemo(() => {
    if (!start || !end) return null;
    const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y += Math.max(2, start.distanceTo(end) * 0.2);
    return new CatmullRomCurve3([start, mid, end]);
  }, [start, end]);

  const { positions, initialOffsets } = useMemo(() => {
    if (!curve) return { positions: new Float32Array(0), initialOffsets: new Float32Array(0) };
    const particleCount = 20;
    const posArray = new Float32Array(particleCount * 3);
    const offsetArray = new Float32Array(particleCount);
    // Use deterministic values instead of Math.random
    for (let i = 0; i < particleCount; i++) {
      offsetArray[i] = (i * 0.618) % 1; // Golden ratio distribution
    }
    return { positions: posArray, initialOffsets: offsetArray };
  }, [curve]);

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32);
    }
    return new CanvasTexture(canvas);
  }, []);

  useFrame((state) => {
    if (!pointsRef.current || !curve) return;
    const time = state.clock.getElapsedTime() * speed;
    const positionsAttribute = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < 20; i++) {
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
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial map={texture} color={color} transparent opacity={opacity} size={size} sizeAttenuation depthWrite={false} blending={AdditiveBlending} />
    </points>
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

const EmptyState3D: React.FC = () => {
  const primary = useResolvedHslCssVar('--primary', '221 83% 53%');
  return (
    <group>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <Billboard position={[0, 1.2, 0]}>
          <Text fontSize={1.2} color="white" anchorX="center" anchorY="middle">Système Sécurisé</Text>
        </Billboard>
      </Float>
      <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3, 3.05, 64]} />
        <meshBasicMaterial color={primary} transparent opacity={0.2} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
};

const PresentationManager: React.FC<{ presentationMode: boolean | undefined; voxelNodes: VoxelNode[]; onNodeSelect: (node: VoxelNode) => void; }> = ({ presentationMode, voxelNodes, onNodeSelect }) => {
  const lastPresentationSwitch = useRef(0);
  const [presentationIndex, setPresentationIndex] = useState(0);

  const criticalNodes = useMemo(() => {
    return voxelNodes.filter(node => {
      if (node.type === 'risk') {
        const riskData = node.data as unknown as Risk;
        return riskData.score >= 12;
      }
      if (node.type === 'incident') {
        const incidentData = node.data as unknown as Incident;
        return incidentData.severity === 'Critique' || incidentData.severity === 'Élevée';
      }
      return false;
    });
  }, [voxelNodes]);

  useEffect(() => {
    if (!presentationMode && presentationIndex !== 0) {
      setTimeout(() => setPresentationIndex(0), 0);
    }
  }, [presentationMode, presentationIndex]);

  useFrame((state) => {
    if (presentationMode && criticalNodes.length > 0) {
      if (state.clock.elapsedTime - lastPresentationSwitch.current > 8) {
        lastPresentationSwitch.current = state.clock.elapsedTime;
        const nextIndex = (presentationIndex + 1) % criticalNodes.length;
        setPresentationIndex(nextIndex);
        onNodeSelect(criticalNodes[nextIndex]);
      }
    }
  });

  return null;
};

const SCENE_OFFSET = { x: 5.5, y: 0, z: 0 };
const applySceneOffset = (x: number, y: number, z: number): { x: number; y: number; z: number } => ({
  x: x + SCENE_OFFSET.x,
  y: y + SCENE_OFFSET.y,
  z: z + SCENE_OFFSET.z
});

// Helper to convert object position to array for Three.js
const positionToArray = (pos: { x: number; y: number; z: number }): [number, number, number] => [pos.x, pos.y, pos.z];

// Helper to get color from node type and status
const getNodeColor = (type: VoxelNodeType, status: VoxelNodeStatus, data?: Record<string, unknown>): string => {
  // Status-based coloring takes priority for critical states
  if (status === 'critical') return '#ef4444';
  if (status === 'warning') return '#f59e0b';

  // Type-based default colors
  switch (type) {
    case 'asset': return '#3b82f6';
    case 'risk': {
      const score = (data as { score?: number })?.score ?? 0;
      if (score >= 15) return '#ef4444';
      if (score >= 10) return '#f59e0b';
      return '#22c55e';
    }
    case 'project': return '#a855f7';
    case 'audit': return '#06b6d4';
    case 'incident': return '#f43f5e';
    case 'supplier': return '#22c55e';
    case 'control': return '#14b8a6';
    default: return '#6b7280';
  }
};

export const VoxelStudio: React.FC<VoxelStudioProps> = ({
  assets = [], risks = [], projects = [], audits = [], incidents = [], suppliers = [], controls = [],
  onNodeClick, className = "", visibleTypes = [],
  focusNodeId, highlightCritical = false, releaseToken,
  suggestedLinks = [], xRayMode, presentationMode,
  impactMode
}) => {
  const defaultLinkColor = useResolvedHslCssVar('--muted-foreground', '215 20% 65%');
  const [selectedNode, setSelectedNode] = useState<VoxelNode | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const isUserInteracting = useRef(false);
  const shouldSnapToTarget = useRef(false);
  const [impactPosition, setImpactPosition] = useState<[number, number, number] | null>(null);
  const [impactKey, setImpactKey] = useState(0);

  const safeAssets = useMemo(() => assets ?? [], [assets]);
  const safeRisks = useMemo(() => risks ?? [], [risks]);
  const safeProjects = useMemo(() => projects ?? [], [projects]);
  const safeAudits = useMemo(() => audits ?? [], [audits]);
  const safeIncidents = useMemo(() => incidents ?? [], [incidents]);
  const safeSuppliers = useMemo(() => suppliers ?? [], [suppliers]);
  const safeControls = useMemo(() => controls ?? [], [controls]);

  const currentVisible = useMemo(() => visibleTypes || [], [visibleTypes]);

  // Split node generation into smaller chunks for better performance
  const GRID_SIZE = 10;
  const SPACING = 4;

  // Asset nodes (memoized separately)
  const assetNodes = useMemo((): VoxelNode[] => {
    if (!currentVisible.includes('asset')) return [];
    const now = new Date();
    return safeAssets.map((asset, i) => {
      const row = Math.floor(i / GRID_SIZE);
      const col = i % GRID_SIZE;
      const maxCriticality = [asset.confidentiality, asset.integrity, asset.availability]
        .find(c => c === 'Critique') ? 'Critique' :
        [asset.confidentiality, asset.integrity, asset.availability]
        .find(c => c === 'Élevée') ? 'Élevée' : 'Normal';
      const status: VoxelNodeStatus = maxCriticality === 'Critique' ? 'critical' : maxCriticality === 'Élevée' ? 'warning' : 'normal';
      return {
        id: asset.id,
        type: 'asset' as const,
        label: asset.name || 'Asset',
        status,
        position: applySceneOffset(col * 3 - (GRID_SIZE * 1.5), 0, row * 3 - (GRID_SIZE * 1.5)),
        size: 1,
        data: asset as unknown as Record<string, unknown>,
        connections: [],
        createdAt: now,
        updatedAt: now
      };
    });
  }, [safeAssets, currentVisible]);

  // Risk nodes (memoized separately)
  const riskNodes = useMemo((): VoxelNode[] => {
    if (!currentVisible.includes('risk')) return [];
    const now = new Date();
    return safeRisks.map((risk, index) => {
      const x = (index % GRID_SIZE) * SPACING - (GRID_SIZE * SPACING) / 2;
      const z = Math.floor(index / GRID_SIZE) * SPACING - (GRID_SIZE * SPACING) / 2;
      const safeScore = Number.isFinite(risk.score) ? risk.score : 0;
      const status: VoxelNodeStatus = safeScore >= 15 ? 'critical' : safeScore >= 10 ? 'warning' : 'normal';
      return {
        id: risk.id,
        type: 'risk' as const,
        label: risk.threat || 'Risk',
        status,
        position: applySceneOffset(x, -4, z),
        size: 0.6 + (safeScore / 25) * 0.4,
        data: risk as unknown as Record<string, unknown>,
        connections: risk.assetId ? [risk.assetId] : [],
        createdAt: now,
        updatedAt: now
      };
    });
  }, [safeRisks, currentVisible]);

  // Project nodes (memoized separately)
  const projectNodes = useMemo((): VoxelNode[] => {
    if (!currentVisible.includes('project')) return [];
    const now = new Date();
    return safeProjects.map((project, index) => {
      const x = (index % GRID_SIZE) * SPACING - (GRID_SIZE * SPACING) / 2;
      const z = Math.floor(index / GRID_SIZE) * SPACING - (GRID_SIZE * SPACING) / 2;
      const status: VoxelNodeStatus = (project.status || '').toLowerCase().includes('retard') ? 'warning' : 'normal';
      return {
        id: project.id,
        type: 'project' as const,
        label: project.name || 'Project',
        status,
        position: applySceneOffset(x, 0, z),
        size: 1.2,
        data: project as unknown as Record<string, unknown>,
        connections: project.relatedRiskIds || [],
        createdAt: now,
        updatedAt: now
      };
    });
  }, [safeProjects, currentVisible]);

  // Audit nodes (memoized separately)
  const auditNodes = useMemo((): VoxelNode[] => {
    if (!currentVisible.includes('audit')) return [];
    const now = new Date();
    return safeAudits.map((audit, i) => {
      const angle = (i / (safeAudits.length || 1)) * Math.PI * 2;
      const radius = 12;
      return {
        id: audit.id,
        type: 'audit' as const,
        label: audit.name || 'Audit',
        status: 'normal' as const,
        position: applySceneOffset(Math.cos(angle) * radius, 8, Math.sin(angle) * radius),
        size: 0.9,
        data: audit as unknown as Record<string, unknown>,
        connections: [
          ...(Array.isArray(audit.relatedAssetIds) ? audit.relatedAssetIds : []),
          ...(Array.isArray(audit.relatedRiskIds) ? audit.relatedRiskIds : []),
          ...(Array.isArray(audit.relatedProjectIds) ? audit.relatedProjectIds : [])
        ],
        createdAt: now,
        updatedAt: now
      };
    });
  }, [safeAudits, currentVisible]);

  // Incident nodes (memoized separately)
  const incidentNodes = useMemo((): VoxelNode[] => {
    if (!currentVisible.includes('incident')) return [];
    const now = new Date();
    return safeIncidents.map((incident, i) => {
      const angle = (i / (safeIncidents.length || 1)) * Math.PI * 2 + 1;
      const radius = 15;
      const isCritical = incident.severity === 'Critique' || incident.severity === 'Élevée';
      const status: VoxelNodeStatus = incident.severity === 'Critique' ? 'critical' : incident.severity === 'Élevée' ? 'warning' : 'normal';
      return {
        id: incident.id,
        type: 'incident' as const,
        label: incident.title || 'Incident',
        status,
        position: applySceneOffset(Math.cos(angle) * radius, isCritical ? 12 : 6, Math.sin(angle) * radius),
        size: isCritical ? 1.5 : 1,
        data: incident as unknown as Record<string, unknown>,
        connections: incident.affectedAssetId ? [incident.affectedAssetId] : [],
        createdAt: now,
        updatedAt: now
      };
    });
  }, [safeIncidents, currentVisible]);

  // Supplier nodes (memoized separately)
  const supplierNodes = useMemo((): VoxelNode[] => {
    if (!currentVisible.includes('supplier')) return [];
    const now = new Date();
    return safeSuppliers.map((s, i) => {
      const x = Math.cos(i * 0.5 + 2) * 16;
      const z = Math.sin(i * 0.5 + 2) * 16;
      const connections: string[] = [];
      if (Array.isArray(s.relatedAssetIds)) connections.push(...s.relatedAssetIds);
      if (Array.isArray(s.relatedProjectIds)) connections.push(...s.relatedProjectIds);
      return {
        id: s.id,
        type: 'supplier' as const,
        label: s.name || 'Supplier',
        status: 'normal' as const,
        position: applySceneOffset(x, 1, z),
        size: 1.1,
        data: s as unknown as Record<string, unknown>,
        connections,
        createdAt: now,
        updatedAt: now
      };
    });
  }, [safeSuppliers, currentVisible]);

  // Control nodes (memoized separately)
  const controlNodes = useMemo((): VoxelNode[] => {
    if (!currentVisible.includes('control')) return [];
    const now = new Date();
    return safeControls.map((c, i) => {
      const angle = (i / (safeControls.length || 1)) * Math.PI * 2;
      const radius = 35;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const connections: string[] = [];
      if (Array.isArray(c.relatedAssetIds)) connections.push(...c.relatedAssetIds);
      if (Array.isArray(c.relatedRiskIds)) connections.push(...c.relatedRiskIds);
      return {
        id: c.id,
        type: 'control' as const,
        label: c.name || 'Control',
        status: 'normal' as const,
        position: applySceneOffset(x, 2, z),
        size: 1.0,
        data: c as unknown as Record<string, unknown>,
        connections,
        createdAt: now,
        updatedAt: now
      };
    });
  }, [safeControls, currentVisible]);

  // Combine all nodes (lightweight operation since individual arrays are pre-computed)
  const voxelNodes = useMemo((): VoxelNode[] => {
    return [
      ...assetNodes,
      ...riskNodes,
      ...projectNodes,
      ...auditNodes,
      ...incidentNodes,
      ...supplierNodes,
      ...controlNodes
    ];
  }, [assetNodes, riskNodes, projectNodes, auditNodes, incidentNodes, supplierNodes, controlNodes]);

  const handleNodeClick = useCallback((node: VoxelNode) => {
    isUserInteracting.current = false;
    setSelectedNode(node);
    shouldSnapToTarget.current = true;
    setImpactPosition(positionToArray(node.position));
    setImpactKey(prev => prev + 1);
    onNodeClick?.(node);
  }, [onNodeClick]);

  useEffect(() => {
    // If focusNodeId changes from outside, update internal selection
    if (focusNodeId === undefined) return;

    if (focusNodeId === null) {
      if (selectedNode !== null) {
        // Use startTransition to avoid cascading renders
        startTransition(() => {
          setSelectedNode(null);
        });
        shouldSnapToTarget.current = false;
      }
      return;
    }

    const node = voxelNodes.find(n => n.id === focusNodeId);
    if (node && node.id !== selectedNode?.id) {
      startTransition(() => {
        setSelectedNode(node);
      });
      shouldSnapToTarget.current = true;
      isUserInteracting.current = false;
    }
  }, [focusNodeId, voxelNodes, selectedNode]);

  useEffect(() => {
    if (!releaseToken) return;
    // Use startTransition to avoid cascading renders
    startTransition(() => {
      setSelectedNode(null);
    });
    shouldSnapToTarget.current = false;
    // Use startTransition to avoid cascading renders
    startTransition(() => {
      setAutoRotate(true);
    });
  }, [releaseToken]);

  const calculateBlastRadius = useCallback((startNodeId: string) => {
    const visited = new Set<string>();
    const queue = [startNodeId];
    visited.add(startNodeId);

    const nodeMap = new Map(voxelNodes.map(n => [n.id, n]));
    const reverseConnections: Record<string, string[]> = {};
    voxelNodes.forEach(n => {
      n.connections.forEach(targetId => {
        if (!reverseConnections[targetId]) reverseConnections[targetId] = [];
        reverseConnections[targetId].push(n.id);
      });
    });

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const node = nodeMap.get(currentId);
      if (node) {
        node.connections.forEach(connId => {
          if (!visited.has(connId)) {
            visited.add(connId);
            queue.push(connId);
          }
        });
      }
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

  const connectionPairs = useMemo(() => {
    const pairs: { start: [number, number, number]; end: [number, number, number]; strength: number; sourceId: string; targetId: string; type?: string }[] = [];
    voxelNodes.forEach(node => {
      node.connections.forEach(connectionId => {
        const target = voxelNodes.find(n => n.id === connectionId);
        if (target) {
          const distance = Math.sqrt(
            (node.position.x - target.position.x) ** 2 +
            (node.position.y - target.position.y) ** 2 +
            (node.position.z - target.position.z) ** 2
          );
          pairs.push({
            start: positionToArray(node.position),
            end: positionToArray(target.position),
            strength: Math.max(0.3, 1 - distance / 25),
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
          start: positionToArray(source.position),
          end: positionToArray(target.position),
          strength: link.confidence,
          type: link.type,
          sourceId: source.id,
          targetId: target.id
        });
      }
    });
    return pairs;
  }, [voxelNodes, suggestedLinks]);

  return (
    <div className={`w-full h-full ${className}`} style={{ touchAction: 'none' }}>
      <Canvas camera={{ position: [22, 12, 22], fov: 58 }} className="bg-slate-950" dpr={[1, 2]} gl={{ antialias: true }} style={{ width: '100%', height: '100%', touchAction: 'none' }}>
        <fog attach="fog" args={['#020617', 40, 90]} />
        <VoxelErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <ModelLibraryProvider>
              <color attach="background" args={[new Color('#020617')]} />
              <ambientLight intensity={0.4} />
              <pointLight position={[15, 20, 15]} intensity={1.5} color="#60a5fa" />
              <pointLight position={[-15, -10, -10]} intensity={1.0} color="#2dd4bf" />
              <spotLight position={[0, 40, 0]} intensity={0.8} angle={Math.PI / 6} penumbra={1} color="#e879f9" />
              <OrbitControls ref={controlsRef} makeDefault enablePan enableZoom enableDamping autoRotate={autoRotate} autoRotateSpeed={0.35} minDistance={4} maxDistance={55} zoomSpeed={0.6} dampingFactor={0.05} />
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
              {selectedNode && (
                <TargetReticle
                  position={positionToArray(selectedNode.position)}
                  size={selectedNode.size}
                  color={getNodeColor(selectedNode.type, selectedNode.status, selectedNode.data)}
                />
              )}
              {impactPosition && (
                <ImpactWave key={impactKey} position={impactPosition} />
              )}
              {connectionPairs.map((pair, i) => {
                const isRelevant = !selectedNode || pair.sourceId === selectedNode.id || pair.targetId === selectedNode.id;
                if (selectedNode && !isRelevant && !impactMode) return null;
                return (
                  <DataFlowParticles
                    key={`conn-${i}`}
                    start={new Vector3(...pair.start)}
                    end={new Vector3(...pair.end)}
                    color={pair.type === 'risk' ? '#f87171' : defaultLinkColor}
                    opacity={isRelevant ? 1.0 : 0.05}
                    speed={isRelevant ? 0.8 : 0.15}
                    size={isRelevant ? 0.7 : 0.2}
                  />
                );
              })}

              {aiConnectionPairs.map((pair, i) => {
                const isRelevant = !selectedNode || pair.sourceId === selectedNode.id || pair.targetId === selectedNode.id;
                return <DataFlowParticles key={`ai-conn-${i}`} start={new Vector3(...pair.start)} end={new Vector3(...pair.end)} color="#fbbf24" opacity={isRelevant ? 0.6 : 0.1} />;
              })}

              {voxelNodes.length === 0 ? <EmptyState3D /> : voxelNodes.map(node => {
                const isRelated = relatedNodeIds.has(node.id);
                const isImpacted = impactMode && impactedNodeIds.has(node.id);
                const isDimmed = impactMode ? !isImpacted : Boolean(selectedNode && node.id !== selectedNode.id && !isRelated);
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
                    isImpacted={isImpacted}
                  />
                );
              })
              }

              <FocusController target={selectedNode} controlsRef={controlsRef} setAutoRotate={setAutoRotate} userInteractingRef={isUserInteracting} shouldSnapRef={shouldSnapToTarget} />
              <PresentationManager presentationMode={presentationMode} voxelNodes={voxelNodes} onNodeSelect={handleNodeClick} />

              {/* <EffectComposer enableNormalPass={false}>
                <Bloom luminanceThreshold={1.0} mipmapBlur intensity={1.2} radius={0.6} levels={8} />
                <Vignette offset={0.2} darkness={0.6} blendFunction={BlendFunction.NORMAL} />
                <Noise opacity={0.025} blendFunction={BlendFunction.OVERLAY} />
              </EffectComposer> */}
            </ModelLibraryProvider>
          </Suspense>
        </VoxelErrorBoundary>
      </Canvas>

    </div>
  );
};
