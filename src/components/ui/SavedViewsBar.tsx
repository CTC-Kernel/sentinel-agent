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
            <div className="flex bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-1 rounded-2xl border border-white/20 dark:border-white/5 shadow-sm">
                {views.map((view) => {
                    const Icon = view.icon || Tag;
                    const isActive = activeViewId === view.id;

                    return (
                        <button
                            key={view.id}
                            onClick={() => onViewSelect(view)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap ${isActive
                                ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-md ring-1 ring-black/5'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5'
                                }`}
                        >
                            <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-brand-500' : 'opacity-60'}`} />
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
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-600 transition-all whitespace-nowrap"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Enregistrer la vue
                </motion.button>
            )}

            <button className="p-2 text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <MoreHorizontal className="h-4 w-4" />
            </button>
        </div>
    );
};
