import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WidgetLayout } from '../../../hooks/useDashboardPreferences';
import { GripVertical, X } from '../../ui/Icons';
import { Tooltip } from '../../ui/Tooltip';

interface SortableWidgetProps {
    widget: WidgetLayout;
    isEditing: boolean;
    children: React.ReactNode;
    onRemove?: (id: string) => void;
}

export const SortableWidget = ({ widget, isEditing, children, onRemove }: SortableWidgetProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: widget.id, disabled: !isEditing });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0 : 1, // Completely hide original to show placeholder
    };

    const colSpanClass = widget.colSpan === 2 ? 'md:col-span-2' : widget.colSpan === 3 ? 'md:col-span-3' : 'md:col-span-1';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative group/widget h-full ${colSpanClass} ${isEditing ? 'touch-none' : ''}`}
        >
            {/* Widget Content or Placeholder */}
            {isDragging ? (
                <div className="h-full w-full rounded-4xl border-2 border-dashed border-brand-300 dark:border-brand-600 bg-brand-100 dark:bg-brand-900/50 backdrop-blur-sm flex items-center justify-center animate-pulse">
                    <span className="text-sm font-semibold text-brand-500">Déplacer ici</span>
                </div>
            ) : (
                <div className={`h-full ring-offset-2 ring-offset-background transition-all duration-200 ${isEditing ? 'ring-2 ring-slate-200 dark:ring-slate-700 rounded-4xl hover:ring-brand-400 cursor-grab active:cursor-grabbing' : ''}`}>
                    {children}
                </div>
            )}

            {/* Edit Overlays */}
            {isEditing && (
                <>
                    <div
                        {...attributes}
                        {...listeners}
                        className="glass-premium absolute top-4 left-1/2 -translate-x-1/2 z-20 cursor-grab active:cursor-grabbing p-2 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all border border-border/40"
                    >
                        <div className="absolute inset-0 bg-white/50 dark:bg-black/50 rounded-full blur-md -z-10" />
                        <GripVertical className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </div>

                    {onRemove && (
                        <Tooltip content="Supprimer ce widget" position="top">
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(widget.id); }}
                                className="absolute -top-2 -right-2 z-20 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 hover:scale-110 active:scale-90 transition-all border-2 border-white dark:border-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    )}
                </>
            )}
        </div>
    );
};
