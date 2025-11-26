import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, XCircle } from './ui/Icons';

interface VoxelDetailOverlayProps {
  selectedNodeDetails: any;
  isDetailMinimized: boolean;
  setIsDetailMinimized: (v: boolean | ((prev: boolean) => boolean)) => void;
  handleSelectionClear: () => void;
  relatedElements: any[];
  applyFocus: (id: string, type: any) => void;
  handleOpenSelected: () => void;
  onPositionChange?: (x: number, y: number) => void;
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
    e.stopPropagation();
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
      className="w-72 pointer-events-auto text-left relative"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.2s ease-out'
      }}
    >
      {/* Anchor point indicator */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
        <div className="w-2.5 h-2.5 rounded-full bg-white/80 border-2 border-white shadow-lg animate-pulse" />
      </div>
      
      <div className={`rounded-3xl border border-white/20 bg-gradient-to-br ${selectedNodeDetails.gradient} shadow-[0_20px_70px_rgba(2,6,23,0.65)] backdrop-blur-xl text-white p-4 space-y-3 animate-[fadeIn_0.35s_ease-out] max-h-[80vh] overflow-y-auto custom-scrollbar ${isDragging ? 'cursor-grabbing shadow-[0_30px_90px_rgba(2,6,23,0.85)]' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1 shrink-0">
            <button
              onPointerDown={handleDragStart}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition cursor-grab active:cursor-grabbing"
              title="Déplacer la fiche"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
            </button>
            {hasMoved && (
              <button
                onClick={handleResetPosition}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer animate-fade-in"
                title="Réinitialiser la position"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[9px] tracking-[0.4em] uppercase text-white/70 block mb-1.5">{selectedNodeDetails.badge}</span>
            <h3 className="text-xl font-semibold leading-tight break-words line-clamp-2">{selectedNodeDetails.title}</h3>
            {!isDetailMinimized && selectedNodeDetails.owner && (
              <p className="text-xs text-white/80 mt-1">Pilote : {selectedNodeDetails.owner}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onPointerDown={(e) => { e.stopPropagation(); setIsDetailMinimized(prev => !prev); }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer"
            >
              {isDetailMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              onPointerDown={(e) => { e.stopPropagation(); handleSelectionClear(); }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isDetailMinimized && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {selectedNodeDetails.stats.map((item: any) => (
                <div key={item.label} className="rounded-2xl bg-white/10 px-3 py-2 min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-white/70 truncate">{item.label}</p>
                  <p className="text-sm font-semibold truncate" title={item.value}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {selectedNodeDetails.meta.map((meta: any) => (
                <div key={meta.label} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-white/70 shrink-0">{meta.label}</span>
                  <span className="font-semibold text-right break-words line-clamp-1" title={meta.value || '—'}>{meta.value || '—'}</span>
                </div>
              ))}
            </div>

            {relatedElements.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Éléments liés</p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                  {relatedElements.map((related: any) => (
                    <button
                      key={related.id}
                      onPointerDown={(e) => { e.stopPropagation(); applyFocus(related.id, related.type); }}
                      className="text-xs px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 transition border border-white/20 cursor-pointer shrink-0"
                    >
                      <span className="font-semibold mr-1 line-clamp-1">{related.label}</span>
                      {related.meta && <span className="text-white/60">({related.meta})</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onPointerDown={(e) => { e.stopPropagation(); handleOpenSelected(); }}
                className="flex-1 px-4 py-2 rounded-2xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 transition cursor-pointer"
              >
                Ouvrir la fiche
              </button>
              <button
                onPointerDown={(e) => { e.stopPropagation(); handleSelectionClear(); }}
                className="px-4 py-2 rounded-2xl border border-white/40 text-sm font-semibold hover:bg-white/10 transition cursor-pointer"
              >
                Relâcher
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
