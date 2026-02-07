import React from 'react';
import { Search, XCircle, Network } from '../ui/Icons';
import { LayerType } from '../../types';
import { VoxelSilhouettes } from './VoxelSilhouettes';

interface CategorizedNode {
 id: string; // layer id 'asset', 'risk', etc.
 label: string;
 color: string;
 items: {
 id: string;
 label: string;
 meta: string;
 }[];
}

interface VoxelSidebarProps {
 navCollapsed: boolean;
 setNavCollapsed: (collapsed: boolean) => void;
 orderedNodesLength: number;
 searchQuery: string;
 setSearchQuery: (query: string) => void;
 categorizedNodes: CategorizedNode[];
 selectedNodeId: string | null;
 onNodeSelect: (id: string, type: LayerType) => void;
 activeLayers: LayerType[];
 onLayerToggle: (layer: LayerType) => void;
}

export const VoxelSidebar: React.FC<VoxelSidebarProps> = ({
 navCollapsed,
 setNavCollapsed,
 orderedNodesLength,
 searchQuery,
 setSearchQuery,
 categorizedNodes,
 selectedNodeId,
 onNodeSelect,
 activeLayers,
 onLayerToggle,
}) => {
 return (
 <aside
 aria-label="Navigation latérale"
 className={`absolute inset-y-0 right-0 ${navCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-80 opacity-70'
 } bg-background/95 dark:bg-card/95 border-l border-border/40 backdrop-blur-2xl z-sidebar p-5 overflow-hidden transition-all duration-500 ease-custom-ease flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.3)]`}
 >
 <div className="flex items-center justify-between text-foreground mb-6 shrink-0">
 <div className="flex items-center gap-3">
  <div className="w-8 h-8 rounded-3xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg shadow-primary/20">
  <Network className="h-4 w-4 text-foreground" />
  </div>
  <div>
  <span className="text-sm font-bold tracking-tight block">CTC Engine</span>
  <span className="text-xs text-foreground/50 font-medium uppercase tracking-wider">
  {orderedNodesLength} Éléments
  </span>
  </div>
 </div>
 <button
  onClick={() => setNavCollapsed(true)}
  aria-label="Fermer le menu"
  className="p-2 rounded-full hover:bg-muted text-foreground/60 hover:text-foreground transition-colors"
 >
  <XCircle className="h-5 w-5" />
 </button>
 </div>

 <div className="relative mb-6 shrink-0 group">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40 group-focus-within:text-primary/70 transition-colors" />
 <input
  value={searchQuery}
  aria-label="Rechercher"
  id="voxel-search"
  type="text"
  onChange={(e) => setSearchQuery(e.target.value)}
  placeholder="Rechercher..."
  className="w-full bg-muted/50 border border-border/40 rounded-3xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/30 focus-visible:outline-none focus-visible:border-primary/60 focus:bg-muted focus-visible:ring-2 focus-visible:ring-primary transition-all shadow-sm"
 />
 </div>

 <div className="space-y-6 overflow-y-auto flex-1 pr-1 custom-scrollbar">
 {categorizedNodes.map((category) => (
  <div key={category.id || 'unknown'} className="animate-[fadeIn_0.5s_ease-out]">
  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] font-bold text-foreground/40 mb-3 px-1">
  <span className="flex items-center gap-2">
  <span className={`w-1.5 h-1.5 rounded-full ${category.color} shadow-[0_0_8px_currentColor]`}></span>
  {category.label}
  </span>
  <button
  onClick={() => onLayerToggle(category.id as LayerType)}
  aria-label={`Basculer l'affichage de la couche ${category.label}`}
  className={`w-8 h-4 rounded-full transition-colors relative ${activeLayers.includes(category.id as LayerType)
   ? 'bg-primary'
   : 'bg-muted'
   }`}
  >
  <span
   className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${activeLayers.includes(category.id as LayerType)
   ? 'translate-x-4'
   : 'translate-x-0'
   }`}
  />
  </button>
  </div>

  <div className="space-y-1 relative">
  {/* Silhouette de fond */}
  <div className="absolute -right-4 -top-6 w-24 h-24 opacity-[0.03] pointer-events-none rotate-12 blur-sm">
  {VoxelSilhouettes[category.id as LayerType]}
  </div>

  {category.items.length === 0 ? (
  <div className="text-foreground/20 text-xs italic px-2 py-2 text-center border border-border/20 rounded-lg border-dashed">
   Aucun élément
  </div>
  ) : (
  category.items.map((item) => (
   <button
   key={item.id || 'unknown'}
   onClick={() => onNodeSelect(item.id, category.id as LayerType)}
   className={`w-full text-left px-3 py-2 rounded-lg transition-all text-xs border group relative overflow-hidden ${selectedNodeId === item.id
   ? 'bg-primary/15 border-primary/60 text-foreground shadow-[0_0_15px_rgba(99,102,241,0.2)]'
   : 'bg-transparent border-transparent hover:bg-muted/50 hover:border-border/40 text-foreground/60 hover:text-foreground'
   }`}
   >
   <div className="relative z-decorator flex items-center justify-between gap-2">
   <span className="font-medium truncate">{item.label}</span>
   {item.meta && (
   <span className={`text-xs px-1.5 py-0.5 rounded bg-muted/50 border border-border/20 ${selectedNodeId === item.id ? 'text-primary/40' : 'text-foreground/30 group-hover:text-foreground/50'
    }`}>
    {item.meta}
   </span>
   )}
   </div>
   {selectedNodeId === item.id && (
   <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_8px_currentColor]" />
   )}
   </button>
  ))
  )}
  </div>
  </div>
 ))}
 </div>
 </aside>
 );
};
