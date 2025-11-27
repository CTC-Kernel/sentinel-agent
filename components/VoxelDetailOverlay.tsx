import React, { useState, useRef, useEffect } from 'react';
import { XCircle, Maximize2, Minimize2, Move, Flame } from './ui/Icons';

interface VoxelDetailOverlayProps {
  selectedNodeDetails: any;
  isDetailMinimized: boolean;
  setIsDetailMinimized: (v: boolean | ((prev: boolean) => boolean)) => void;
  handleSelectionClear: () => void;
  relatedElements: any[];
  applyFocus: (id: string, type: any) => void;
  handleOpenSelected: () => void;
  onPositionChange?: (x: number, y: number) => void;
  onRequestFocus?: () => void;
  impactMode?: boolean;
  setImpactMode?: (v: boolean) => void;
}

export const VoxelDetailOverlay: React.FC<VoxelDetailOverlayProps> = ({
  selectedNodeDetails,
  isDetailMinimized,
  setIsDetailMinimized,
  handleSelectionClear,
  relatedElements,
  applyFocus,
  handleOpenSelected,
  onPositionChange,
  onRequestFocus,
  impactMode,
  setImpactMode,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset position when node changes
  useEffect(() => {
    setPosition({ x: 0, y: 0 });
    if (onPositionChange) {
      onPositionChange(0, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeDetails?.id]);

  useEffect(() => {
    if (isDragging) {
      const handlePointerMove = (e: PointerEvent) => {
        const deltaX = e.clientX - dragStartPos.current.x;
        const deltaY = e.clientY - dragStartPos.current.y;
        const newPos = { x: deltaX, y: deltaY };
        setPosition(newPos);
        onPositionChange?.(deltaX, deltaY);
      };

      const handlePointerUp = () => {
        setIsDragging(false);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);

      return () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isDragging, onPositionChange]);

  const handleDragStart = (e: React.PointerEvent) => {
    e.stopPropagation(); // Prevent 3D scene interaction
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleResetPosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPosition({ x: 0, y: 0 });
    onPositionChange?.(0, 0);
  };

  const hasMoved = position.x !== 0 || position.y !== 0;

  if (!selectedNodeDetails) return null;

  return (
    <div
      ref={containerRef}
      className="w-80 pointer-events-auto text-left relative group font-sans"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
      }}
      onPointerDown={(e) => e.stopPropagation()} // Critical: Stop event propagation to canvas
      onClick={(e) => e.stopPropagation()}
    >
      {/* Anchor point indicator */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
        <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-pulse" />
        <div className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
      </div>

      <div style={{ transform: 'translateX(-50%)' }}>
        <div
          className={`
            rounded-[2rem] border border-white/20 
            bg-gradient-to-br ${selectedNodeDetails.gradient} 
            shadow-[0_20px_70px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] 
            backdrop-blur-2xl text-white p-5 space-y-4 
            animate-[fadeIn_0.4s_cubic-bezier(0.2,0.8,0.2,1)] 
            max-h-[85vh] overflow-y-auto custom-scrollbar 
            transition-all duration-300
            ${isDragging ? 'cursor-grabbing scale-[1.02] shadow-[0_30px_90px_rgba(0,0,0,0.6)]' : ''}
            ${isDetailMinimized ? 'w-64' : 'w-80'}
          `}
          onClick={(e) => {
            e.stopPropagation();
            onRequestFocus?.();
          }}
        >
          {/* Header Section */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1 shrink-0">
              <button
                onPointerDown={handleDragStart}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-grab active:cursor-grabbing backdrop-blur-sm"
                title="Déplacer la fiche"
              >
                <Move className="h-4 w-4" />
              </button>
              {hasMoved && (
                <button
                  onClick={handleResetPosition}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer animate-fade-in backdrop-blur-sm"
                  title="Réinitialiser la position"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0 text-center">
              <span className="inline-block px-2 py-0.5 rounded-full bg-black/20 text-[9px] font-bold tracking-[0.2em] uppercase text-white/90 mb-2 border border-white/10 shadow-sm">
                {selectedNodeDetails.badge}
              </span>
              <h3 className="text-lg font-bold leading-tight break-words line-clamp-2 text-shadow-sm">
                {selectedNodeDetails.title}
              </h3>
              {!isDetailMinimized && selectedNodeDetails.owner && (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                    {selectedNodeDetails.owner.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-xs font-medium text-white/90">{selectedNodeDetails.owner}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setIsDetailMinimized(prev => !prev); }}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer backdrop-blur-sm"
                title={isDetailMinimized ? "Agrandir" : "Réduire"}
              >
                {isDetailMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleSelectionClear(); }}
                className="p-2 rounded-full bg-white/10 hover:bg-red-500/20 text-white/80 hover:text-red-200 transition-all cursor-pointer backdrop-blur-sm"
                title="Fermer"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Expanded Content */}
          {!isDetailMinimized && (
            <div className="space-y-5 pt-2 animate-[fadeIn_0.3s_ease-out]">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2">
                {selectedNodeDetails.stats.map((item: any) => (
                  <div key={item.label} className="group relative overflow-hidden rounded-2xl bg-black/10 hover:bg-black/20 border border-white/5 p-2.5 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-[9px] uppercase tracking-wider text-white/60 truncate mb-0.5">{item.label}</p>
                    <p className="text-sm font-bold truncate text-white text-shadow-sm" title={item.value}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Meta Info */}
              <div className="space-y-2.5 bg-black/10 rounded-2xl p-3 border border-white/5">
                {selectedNodeDetails.meta.map((meta: any) => (
                  <div key={meta.label} className="flex items-center justify-between text-xs gap-3 group">
                    <span className="text-white/60 font-medium shrink-0 group-hover:text-white/80 transition-colors">{meta.label}</span>
                    <span className="font-semibold text-right break-words line-clamp-1 text-white/90">{meta.value || '—'}</span>
                  </div>
                ))}
              </div>

              {/* Related Elements */}
              {relatedElements.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold">Connexions</p>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                    {relatedElements.map((related: any) => (
                      <button
                        key={related.id}
                        onClick={(e) => { e.stopPropagation(); applyFocus(related.id, related.type); }}
                        className="group flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 hover:scale-105 transition-all duration-200 border border-white/10 cursor-pointer shrink-0"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${related.type === 'risk' ? 'bg-orange-400' :
                          related.type === 'asset' ? 'bg-blue-400' :
                            related.type === 'incident' ? 'bg-red-400' :
                              related.type === 'project' ? 'bg-purple-400' :
                                'bg-gray-400'
                          }`} />
                        <span className="font-semibold line-clamp-1">{related.label}</span>
                        {related.meta && <span className="text-white/50 group-hover:text-white/70 text-[10px]">({related.meta})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpenSelected(); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-black/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Voir détails</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
                {setImpactMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setImpactMode(!impactMode); }}
                    className={`px-4 py-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2 ${impactMode
                      ? 'bg-red-500 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                      : 'border-white/30 bg-white/5 text-white hover:bg-white/10 hover:border-white/50'
                      }`}
                    title="Visualiser l'impact en cascade"
                  >
                    <Flame className={`w-4 h-4 ${impactMode ? 'animate-pulse' : ''}`} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleSelectionClear(); }}
                  className="px-4 py-2.5 rounded-xl border border-white/30 bg-white/5 text-sm font-semibold hover:bg-white/10 hover:border-white/50 transition-all cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
