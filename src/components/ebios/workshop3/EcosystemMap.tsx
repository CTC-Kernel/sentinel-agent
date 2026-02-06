/**
 * EcosystemMap.tsx
 * Interactive visualization of ecosystem parties and attack paths
 *
 * Story 17.5: Visualisation Graphique de l'Écosystème
 *
 * Features:
 * - Interactive node visualization for ecosystem parties
 * - Attack paths shown as animated edges
 * - Zoom and pan controls
 * - Click to view details
 * - Legend with filtering
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
 ZoomIn,
 ZoomOut,
 Maximize2,
 Info,
 X,
 Users,
 Truck,
 Building,
 Cloud,
 Globe,
 Eye,
 EyeOff,
 ArrowRight,
 AlertTriangle,
} from '../../ui/Icons';
import { cn } from '../../../utils/cn';
import type {
 EcosystemParty,
 AttackPath,
 EcosystemPartyType,
 EssentialAsset,
} from '../../../types/ebios';

interface EcosystemMapProps {
 parties: EcosystemParty[];
 attackPaths: AttackPath[];
 assets: EssentialAsset[];
 onPartyClick?: (party: EcosystemParty) => void;
 onPathClick?: (path: AttackPath) => void;
 readOnly?: boolean;
}

// Party type configuration
const PARTY_TYPE_CONFIG: Record<
 EcosystemPartyType,
 { icon: typeof Users; color: string; bgColor: string; borderColor: string }
> = {
 supplier: {
 icon: Truck,
 color: 'text-blue-600',
 bgColor: 'bg-blue-100 dark:bg-blue-900/30',
 borderColor: 'border-blue-300 dark:border-blue-700',
 },
 partner: {
 icon: Users,
 color: 'text-green-600',
 bgColor: 'bg-green-100 dark:bg-green-900/30',
 borderColor: 'border-green-300 dark:border-green-700',
 },
 customer: {
 icon: Users,
 color: 'text-purple-600',
 bgColor: 'bg-purple-100 dark:bg-purple-900/30',
 borderColor: 'border-purple-300 dark:border-purple-700',
 },
 regulator: {
 icon: Building,
 color: 'text-orange-600',
 bgColor: 'bg-orange-100 dark:bg-orange-900/30',
 borderColor: 'border-orange-300 dark:border-orange-700',
 },
 subcontractor: {
 icon: Truck,
 color: 'text-teal-600',
 bgColor: 'bg-teal-100 dark:bg-teal-900/30',
 borderColor: 'border-teal-300 dark:border-teal-700',
 },
 cloud_provider: {
 icon: Cloud,
 color: 'text-sky-600',
 bgColor: 'bg-sky-100 dark:bg-sky-900/30',
 borderColor: 'border-sky-300 dark:border-sky-700',
 },
 software_vendor: {
 icon: Cloud,
 color: 'text-indigo-600',
 bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
 borderColor: 'border-indigo-300 dark:border-indigo-700',
 },
 service_provider: {
 icon: Building,
 color: 'text-amber-600',
 bgColor: 'bg-amber-100 dark:bg-amber-900/30',
 borderColor: 'border-amber-300 dark:border-amber-700',
 },
 other: {
 icon: Globe,
 color: 'text-muted-foreground',
 bgColor: 'bg-muted/30',
 borderColor: 'border-border/40',
 },
};

// Likelihood colors for attack paths
import { SENTINEL_PALETTE, SEVERITY_COLORS } from '../../../theme/chartTheme';

const LIKELIHOOD_COLORS: Record<number, { stroke: string; className: string }> = {
 1: { stroke: SENTINEL_PALETTE.success, className: 'text-green-500' },
 2: { stroke: SEVERITY_COLORS.medium, className: 'text-yellow-500' },
 3: { stroke: SEVERITY_COLORS.high, className: 'text-orange-500' },
 4: { stroke: SEVERITY_COLORS.critical, className: 'text-red-500' },
};

export const EcosystemMap: React.FC<EcosystemMapProps> = ({
 parties,
 attackPaths,
 assets,
 onPartyClick,
 onPathClick,
 // readOnly is available for future use when editing directly in the map
 readOnly: _readOnly = false,
}) => {
 const { t, i18n } = useTranslation();
 const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';
 const containerRef = useRef<HTMLDivElement>(null);

 // Zoom and pan state
 const [zoom, setZoom] = useState(1);
 const [pan, setPan] = useState({ x: 0, y: 0 });
 const [isDragging, setIsDragging] = useState(false);
 const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

 // Selection and filter state
 const [selectedParty, setSelectedParty] = useState<EcosystemParty | null>(null);
 const [selectedPath, setSelectedPath] = useState<AttackPath | null>(null);
 const [visibleTypes, setVisibleTypes] = useState<Set<EcosystemPartyType>>(
 new Set(Object.keys(PARTY_TYPE_CONFIG) as EcosystemPartyType[])
 );
 const [showLegend, setShowLegend] = useState(true);

 // Calculate node positions (circular layout or use stored positions)
 const nodePositions = useMemo(() => {
 const positions: Record<string, { x: number; y: number }> = {};
 const centerX = 400;
 const centerY = 300;
 const radius = 200;

 parties.forEach((party, index) => {
 if (party.position) {
 positions[party.id] = party.position;
 } else {
 const angle = (2 * Math.PI * index) / parties.length - Math.PI / 2;
 positions[party.id] = {
 x: centerX + radius * Math.cos(angle),
 y: centerY + radius * Math.sin(angle),
 };
 }
 });

 // Add asset positions in the center
 assets.forEach((asset, index) => {
 positions[asset.id] = {
 x: centerX + (index - assets.length / 2) * 60,
 y: centerY,
 };
 });

 return positions;
 }, [parties, assets]);

 // Filter visible parties
 const visibleParties = useMemo(() => {
 return parties.filter((p) => visibleTypes.has(p.type));
 }, [parties, visibleTypes]);

 // Zoom controls
 const handleZoomIn = useCallback(() => {
 setZoom((z) => Math.min(z * 1.2, 3));
 }, []);

 const handleZoomOut = useCallback(() => {
 setZoom((z) => Math.max(z / 1.2, 0.3));
 }, []);

 const handleFitToView = useCallback(() => {
 setZoom(1);
 setPan({ x: 0, y: 0 });
 }, []);

 // Pan handling
 const handleMouseDown = useCallback(
 (e: React.MouseEvent) => {
 if (e.button === 0 && !selectedParty && !selectedPath) {
 setIsDragging(true);
 setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
 }
 },
 [pan, selectedParty, selectedPath]
 );

 const handleMouseMove = useCallback(
 (e: React.MouseEvent) => {
 if (isDragging) {
 setPan({
 x: e.clientX - dragStart.x,
 y: e.clientY - dragStart.y,
 });
 }
 },
 [isDragging, dragStart]
 );

 const handleMouseUp = useCallback(() => {
 setIsDragging(false);
 }, []);

 // Toggle type visibility
 const toggleTypeVisibility = useCallback((type: EcosystemPartyType) => {
 setVisibleTypes((prev) => {
 const next = new Set(prev);
 if (next.has(type)) {
 next.delete(type);
 } else {
 next.add(type);
 }
 return next;
 });
 }, []);

 // Get party by ID
 const getPartyById = useCallback(
 (id: string) => parties.find((p) => p.id === id),
 [parties]
 );

 // Get asset by ID
 const getAssetById = useCallback(
 (id: string) => assets.find((a) => a.id === id),
 [assets]
 );

 // Render attack path edge
 const renderPath = useCallback(
 (path: AttackPath) => {
 const sourceParty = getPartyById(path.sourcePartyId);
 if (!sourceParty || !visibleTypes.has(sourceParty.type)) return null;

 const sourcePos = nodePositions[path.sourcePartyId];
 const targetPos = nodePositions[path.targetAssetId];
 if (!sourcePos || !targetPos) return null;

 const likelihoodConfig = LIKELIHOOD_COLORS[path.likelihood] || LIKELIHOOD_COLORS[2];
 const isSelected = selectedPath?.id === path.id;

 // Calculate control points for curved path
 const midX = (sourcePos.x + targetPos.x) / 2;
 const midY = (sourcePos.y + targetPos.y) / 2;
 const dx = targetPos.x - sourcePos.x;
 const dy = targetPos.y - sourcePos.y;
 const offset = Math.min(50, Math.sqrt(dx * dx + dy * dy) * 0.2);

 // Perpendicular offset for curve
 const length = Math.sqrt(dx * dx + dy * dy);
 const perpX = (-dy / length) * offset;
 const perpY = (dx / length) * offset;

 const controlX = midX + perpX;
 const controlY = midY + perpY;

 const pathD = `M ${sourcePos.x} ${sourcePos.y} Q ${controlX} ${controlY} ${targetPos.x} ${targetPos.y}`;

 return (
 <g key={path.id || 'unknown'}>
 {/* Path background for better visibility */}
 <path
 d={pathD}
 fill="none"
 stroke="white"
 strokeWidth={isSelected ? 6 : 4}
 strokeLinecap="round"
 className="dark:stroke-foreground"
 />
 {/* Main path */}
 <motion.path
 d={pathD}
 fill="none"
 stroke={likelihoodConfig.stroke}
 strokeWidth={isSelected ? 4 : 2}
 strokeLinecap="round"
 strokeDasharray={path.likelihood >= 3 ? '0' : '8 4'}
 initial={{ pathLength: 0 }}
 animate={{
 pathLength: 1,
 strokeOpacity: isSelected ? 1 : 0.7,
 }}
 transition={{ duration: 1, ease: 'easeInOut' }}
 className="cursor-pointer"
 onClick={(e) => {
 e.stopPropagation();
 setSelectedPath(path);
 setSelectedParty(null);
 onPathClick?.(path);
 }}
 />
 {/* Animated flow effect for high likelihood paths */}
 {path.likelihood >= 3 && (
 <motion.circle
 r={4}
 fill={likelihoodConfig.stroke}
 initial={{ offsetDistance: '0%' }}
 animate={{ offsetDistance: '100%' }}
 transition={{
 duration: 2,
 repeat: Infinity,
 ease: 'linear',
 }}
 style={{
 offsetPath: `path("${pathD}")`,
 }}
 />
 )}
 {/* Arrow at end */}
 <circle
 cx={targetPos.x}
 cy={targetPos.y}
 r={6}
 fill={likelihoodConfig.stroke}
 className="pointer-events-none"
 />
 </g>
 );
 },
 [
 nodePositions,
 visibleTypes,
 selectedPath,
 getPartyById,
 onPathClick,
 ]
 );

 // Render party node
 const renderNode = useCallback(
 (party: EcosystemParty) => {
 if (!visibleTypes.has(party.type)) return null;

 const pos = nodePositions[party.id];
 if (!pos) return null;

 const config = PARTY_TYPE_CONFIG[party.type];
 const Icon = config.icon;
 const isSelected = selectedParty?.id === party.id;

 // Calculate risk score for visual indicator
 const trustFactor = 5 - party.trustLevel;
 const riskScore = Math.round(
 ((trustFactor + party.exposure + party.cyberDependency) / 15) * 100
 );

 return (
 <motion.g
 key={party.id || 'unknown'}
 initial={{ scale: 0, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0, opacity: 0 }}
 transition={{ type: 'spring', stiffness: 300, damping: 25 }}
 >
 {/* Node container */}
 <foreignObject
 x={pos.x - 50}
 y={pos.y - 40}
 width={100}
 height={80}
 className="overflow-visible"
 >
 <motion.div
 whileHover={{ scale: 1.1 }}
 whileTap={{ scale: 0.95 }}
 onClick={(e) => {
 e.stopPropagation();
 setSelectedParty(party);
 setSelectedPath(null);
 onPartyClick?.(party);
 }}
 className={cn(
 'w-full h-full flex flex-col items-center justify-center cursor-pointer',
 'rounded-3xl border-2 shadow-lg transition-all',
 config.bgColor,
 isSelected
  ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700'
  : config.borderColor
 )}
 >
 <div
 className={cn(
  'p-1.5 rounded-lg mb-1',
  party.category === 'internal'
  ? 'bg-blue-200 dark:bg-blue-800'
  : 'bg-card'
 )}
 >
 <Icon className={cn('w-5 h-5', config.color)} />
 </div>
 <p className="text-xs font-medium text-foreground text-center truncate w-full px-1">
 {party.name}
 </p>
 {/* Risk indicator */}
 <div
 className={cn(
  'absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center mono-label text-white',
  riskScore >= 70
  ? 'bg-red-500'
  : riskScore >= 40
  ? 'bg-yellow-500'
  : 'bg-green-500'
 )}
 >
 {party.trustLevel}
 </div>
 </motion.div>
 </foreignObject>
 </motion.g>
 );
 },
 [nodePositions, visibleTypes, selectedParty, onPartyClick]
 );

 // Render asset node (target)
 const renderAssetNode = useCallback(
 (asset: EssentialAsset) => {
 const pos = nodePositions[asset.id];
 if (!pos) return null;

 return (
 <motion.g
 key={asset.id || 'unknown'}
 initial={{ scale: 0, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 transition={{ delay: 0.3 }}
 >
 <foreignObject
 x={pos.x - 40}
 y={pos.y - 30}
 width={80}
 height={60}
 className="overflow-visible"
 >
 <div
 className={cn(
 'w-full h-full flex flex-col items-center justify-center',
 'rounded-lg border-2 border-purple-400 dark:border-purple-600',
 'bg-purple-100 dark:bg-purple-900/30 shadow-md'
 )}
 >
 <AlertTriangle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
 <p className="caption text-purple-800 dark:text-purple-200 text-center truncate w-full px-1">
 {asset.name}
 </p>
 </div>
 </foreignObject>
 </motion.g>
 );
 },
 [nodePositions]
 );

 return (
 <div className="relative w-full h-[500px] rounded-2xl border border-border/40 bg-gradient-to-br from-muted/50 to-muted dark:from-card dark:to-muted overflow-hidden">
 {/* Controls */}
 <div className="absolute top-4 right-4 z-decorator flex flex-col gap-2">
 <button
 onClick={handleZoomIn}
 className="p-2 rounded-lg bg-card border border-border/40 shadow-sm hover:bg-muted/50 transition-colors"
 title={t('ebios.ecosystem.zoomIn')}
 >
 <ZoomIn className="w-4 h-4 text-muted-foreground" />
 </button>
 <button
 onClick={handleZoomOut}
 className="p-2 rounded-lg bg-card border border-border/40 shadow-sm hover:bg-muted/50 transition-colors"
 title={t('ebios.ecosystem.zoomOut')}
 >
 <ZoomOut className="w-4 h-4 text-muted-foreground" />
 </button>
 <button
 onClick={handleFitToView}
 className="p-2 rounded-lg bg-card border border-border/40 shadow-sm hover:bg-muted/50 transition-colors"
 title={t('ebios.ecosystem.fitToView')}
 >
 <Maximize2 className="w-4 h-4 text-muted-foreground" />
 </button>
 <div className="w-px h-4 bg-muted mx-auto" />
 <button
 onClick={() => setShowLegend(!showLegend)}
 className={cn(
 'p-2 rounded-lg border shadow-sm transition-colors',
 showLegend
 ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 dark:border-blue-700'
 : 'bg-card border-border/40'
 )}
 title={t('ebios.ecosystem.toggleLegend')}
 >
 <Info className="w-4 h-4 text-muted-foreground" />
 </button>
 </div>

 {/* Legend */}
 <AnimatePresence>
 {showLegend && (
 <motion.div
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: -20 }}
 className="absolute top-4 left-4 z-decorator p-3 rounded-3xl bg-card border border-border/40 shadow-lg max-w-[200px]"
 >
 <h4 className="text-xs font-semibold text-foreground mb-2">
 {t('ebios.ecosystem.legend')}
 </h4>

 {/* Party types */}
 <div className="space-y-1 mb-3">
 {(Object.entries(PARTY_TYPE_CONFIG) as [EcosystemPartyType, typeof PARTY_TYPE_CONFIG['supplier']][]).map(
 ([type, config]) => {
  const Icon = config.icon;
  const isVisible = visibleTypes.has(type);
  const count = parties.filter((p) => p.type === type).length;

  if (count === 0) return null;

  return (
  <button
  key={type || 'unknown'}
  onClick={() => toggleTypeVisibility(type)}
  className={cn(
  'flex items-center gap-2 w-full px-2 py-1 rounded text-left transition-colors',
  isVisible
  ? 'hover:bg-muted'
  : 'opacity-60'
  )}
  >
  {isVisible ? (
  <Eye className="w-3 h-3 text-muted-foreground" />
  ) : (
  <EyeOff className="w-3 h-3 text-muted-foreground" />
  )}
  <Icon className={cn('w-3 h-3', config.color)} />
  <span className="text-xs text-foreground truncate flex-1">
  {t(`ebios.partyTypes.${type}`)}
  </span>
  <span className="text-xs text-muted-foreground">{count}</span>
  </button>
  );
 }
 )}
 </div>

 {/* Likelihood legend */}
 <h4 className="text-xs font-semibold text-foreground mb-1 pt-2 border-t border-border/40">
 {t('ebios.ecosystem.likelihood')}
 </h4>
 <div className="space-y-1">
 {[1, 2, 3, 4].map((level) => (
 <div key={level || 'unknown'} className="flex items-center gap-2">
  <div
  className="w-4 h-0.5 rounded"
  style={{
  backgroundColor: LIKELIHOOD_COLORS[level].stroke,
  opacity: level >= 3 ? 1 : 0.7,
  }}
  />
  <span className="text-xs text-muted-foreground">
  V{level} - {locale === 'fr'
  ? ['Faible', 'Modérée', 'Élevée', 'Très élevée'][level - 1]
  : ['Low', 'Moderate', 'High', 'Very High'][level - 1]
  }
  </span>
 </div>
 ))}
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Details Panel */}
 <AnimatePresence>
 {(selectedParty || selectedPath) && (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 20 }}
 className="absolute bottom-4 left-4 right-4 z-decorator p-4 rounded-3xl bg-card border border-border/40 shadow-lg"
 >
 <button
 onClick={() => {
 setSelectedParty(null);
 setSelectedPath(null);
 }}
 className="absolute top-2 right-2 p-1 rounded hover:bg-muted"
 >
 <X className="w-4 h-4 text-muted-foreground" />
 </button>

 {selectedParty && (
 <div>
 <div className="flex items-center gap-3 mb-3">
  {(() => {
  const config = PARTY_TYPE_CONFIG[selectedParty.type];
  const Icon = config.icon;
  return (
  <div className={cn('p-2 rounded-lg', config.bgColor)}>
  <Icon className={cn('w-5 h-5', config.color)} />
  </div>
  );
  })()}
  <div>
  <h4 className="font-semibold text-foreground">
  {selectedParty.name}
  </h4>
  <p className="text-sm text-muted-foreground">
  {t(`ebios.partyTypes.${selectedParty.type}`)} ·{' '}
  {selectedParty.category === 'internal'
  ? t('ebios.ecosystem.internal')
  : t('ebios.ecosystem.external')}
  </p>
  </div>
 </div>
 <div className="grid grid-cols-4 gap-2">
  <div className="text-center p-2 rounded-lg bg-muted/50">
  <p className="text-lg font-bold text-foreground">
  {selectedParty.trustLevel}
  </p>
  <p className="text-xs text-muted-foreground">{t('ebios.ecosystem.trust')}</p>
  </div>
  <div className="text-center p-2 rounded-lg bg-muted/50">
  <p className="text-lg font-bold text-foreground">
  {selectedParty.exposure}
  </p>
  <p className="text-xs text-muted-foreground">{t('ebios.ecosystem.exposure')}</p>
  </div>
  <div className="text-center p-2 rounded-lg bg-muted/50">
  <p className="text-lg font-bold text-foreground">
  {selectedParty.cyberDependency}
  </p>
  <p className="text-xs text-muted-foreground">{t('ebios.ecosystem.dependency')}</p>
  </div>
  <div className="text-center p-2 rounded-lg bg-muted/50">
  <p className="text-lg font-bold text-foreground">
  {selectedParty.penetration}
  </p>
  <p className="text-xs text-muted-foreground">{t('ebios.ecosystem.penetration')}</p>
  </div>
 </div>
 </div>
 )}

 {selectedPath && (
 <div>
 <div className="flex items-center gap-3 mb-3">
  <div className="p-2 rounded-lg bg-orange-100 dark:bg-amber-900/30">
  <ArrowRight className="w-5 h-5 text-orange-600 dark:text-orange-400" />
  </div>
  <div>
  <h4 className="font-semibold text-foreground">
  {selectedPath.name || t('ebios.ecosystem.attackPath')}
  </h4>
  <p className="text-sm text-muted-foreground">
  {getPartyById(selectedPath.sourcePartyId)?.name} →{' '}
  {getAssetById(selectedPath.targetAssetId)?.name}
  </p>
  </div>
 </div>
 <div className="grid grid-cols-2 gap-2">
  <div className="text-center p-2 rounded-lg bg-muted/50">
  <p
  className={cn(
  'text-lg font-bold',
  LIKELIHOOD_COLORS[selectedPath.likelihood]?.className
  )}
  >
  V{selectedPath.likelihood}
  </p>
  <p className="text-xs text-muted-foreground">{t('ebios.ecosystem.likelihood')}</p>
  </div>
  <div className="text-center p-2 rounded-lg bg-muted/50">
  <p className="text-lg font-bold text-foreground">
  C{selectedPath.complexity}
  </p>
  <p className="text-xs text-muted-foreground">{t('ebios.ecosystem.complexity')}</p>
  </div>
 </div>
 {selectedPath.description && (
  <p className="mt-2 text-sm text-muted-foreground">
  {selectedPath.description}
  </p>
 )}
 </div>
 )}
 </motion.div>
 )}
 </AnimatePresence>

 {/* SVG Canvas */}
 <svg
 ref={containerRef as unknown as React.RefObject<SVGSVGElement>}
 width="100%"
 height="100%"
 onMouseDown={handleMouseDown}
 onMouseMove={handleMouseMove}
 onMouseUp={handleMouseUp}
 onMouseLeave={handleMouseUp}
 className={cn('cursor-grab', isDragging && 'cursor-grabbing')}
 onClick={() => {
 setSelectedParty(null);
 setSelectedPath(null);
 }}
 >
 <g
 transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
 style={{ transformOrigin: 'center center' }}
 >
 {/* Render attack paths first (under nodes) */}
 {attackPaths.map(renderPath)}

 {/* Render asset nodes */}
 {assets.map(renderAssetNode)}

 {/* Render party nodes */}
 <AnimatePresence>{visibleParties.map(renderNode)}</AnimatePresence>
 </g>
 </svg>

 {/* Empty state */}
 {parties.length === 0 && (
 <div className="absolute inset-0 flex items-center justify-center">
 <div className="text-center">
 <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
 <p className="text-muted-foreground">{t('ebios.ecosystem.noParties')}</p>
 <p className="text-sm text-muted-foreground mt-1">
 {t('ebios.ecosystem.addPartiesHelp')}
 </p>
 </div>
 </div>
 )}
 </div>
 );
};

export default EcosystemMap;
