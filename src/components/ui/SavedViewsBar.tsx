import React from 'react';
import { Tag, Plus, MoreHorizontal } from './Icons';
import { motion } from 'framer-motion';
import { DEFAULT_VIEWS, SavedView } from './savedViewsConstants';

export type { SavedView };
export { DEFAULT_VIEWS };

interface SavedViewsBarProps {
 views: SavedView[];
 activeViewId: string;
 onViewSelect: (view: SavedView) => void;
 onSaveCurrentView: () => void;
 isModified?: boolean;
}

export const SavedViewsBar: React.FC<SavedViewsBarProps> = ({
 views,
 activeViewId,
 onViewSelect,
 onSaveCurrentView,
 isModified = false
}) => {
 return (
 <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
 <div className="flex bg-card/40 backdrop-blur-md p-1 rounded-2xl border border-white/20 dark:border-white/5 shadow-sm">
 {views.map((view) => {
  const Icon = view.icon || Tag;
  const isActive = activeViewId === view.id;

  return (
  <button
  key={view.id || 'unknown'}
  onClick={() => onViewSelect(view)}
  className={`flex items-center gap-2 px-4 py-2 rounded-3xl text-xs font-bold transition-all duration-300 whitespace-nowrap ${isActive
  ? 'bg-card text-foreground shadow-md ring-1 ring-black/5'
  : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/5'
  }`}
  >
  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : 'opacity-60'}`} />
  {view.name}
  </button>
  );
 })}
 </div>

 {isModified && (
 <motion.button
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  onClick={onSaveCurrentView}
  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-3xl text-xs font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all whitespace-nowrap"
 >
  <Plus className="h-3.5 w-3.5" />
  Enregistrer la vue
 </motion.button>
 )}

 <button className="p-2 text-muted-foreground hover:text-muted-foreground transition-colors">
 <MoreHorizontal className="h-4 w-4" />
 </button>
 </div>
 );
};
