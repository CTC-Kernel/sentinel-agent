import React, { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, defaultDropAnimationSideEffects, DropAnimation } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WidgetLayout } from '../../../hooks/useDashboardPreferences';
import { WIDGET_REGISTRY } from './WidgetRegistry';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, X } from 'lucide-react';
import { useStore } from '../../../store'; // Assuming we have global store for toast etc

// --- Sortable Item Component ---
interface SortableWidgetProps {
    widget: WidgetLayout;
    isEditing: boolean;
    children: React.ReactNode;
    onRemove?: (id: string) => void;
}

const SortableWidget = ({ widget, isEditing, children, onRemove }: SortableWidgetProps) => {
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
        gridColumn: `span ${widget.colSpan || 1}`,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative group/widget h-full ${isEditing ? 'ring-2 ring-dashed ring-slate-300 dark:ring-slate-700 rounded-[2rem] p-1' : ''}`}
        >
            {/* Widget Content */}
            <div className={`h-full ${isEditing ? 'pointer-events-none' : ''}`}>
                {children}
            </div>

            {/* Edit Overlays */}
            {isEditing && (
                <>
                    <div
                        {...attributes}
                        {...listeners}
                        className="absolute top-4 left-1/2 -translate-x-1/2 z-20 cursor-grab active:cursor-grabbing p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform"
                    >
                        <GripVertical className="w-5 h-5 text-slate-500" />
                    </div>

                    {onRemove && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove(widget.id); }}
                            className="absolute -top-2 -right-2 z-20 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

// --- Main Grid Component ---

interface ConfigurableDashboardGridProps {
    layout: WidgetLayout[];
    onLayoutChange: (newLayout: WidgetLayout[]) => void;
    isEditing: boolean;
    widgetProps: Record<string, any>; // Props to pass down to widgets
}

export const ConfigurableDashboardGrid: React.FC<ConfigurableDashboardGridProps> = ({
    layout,
    onLayoutChange,
    isEditing,
    widgetProps
}) => {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), // Require 8px movement implies drag vs click
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const oldIndex = layout.findIndex((item) => item.id === active.id);
            const newIndex = layout.findIndex((item) => item.id === over.id);
            onLayoutChange(arrayMove(layout, oldIndex, newIndex));
        }
    };

    const dropAnimation: DropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
    };

    // Helper to remove a widget
    const handleRemoveWidget = (id: string) => {
        const newLayout = layout.filter(w => w.id !== id);
        onLayoutChange(newLayout);
    };

    const renderWidget = (item: WidgetLayout, isOverlay = false) => {
        const entry = WIDGET_REGISTRY[item.widgetId];
        if (!entry) return <div className="p-4 bg-red-100 text-red-800 rounded-xl">Widget not found: {item.widgetId}</div>;

        const Component = entry.component;

        // Filter props relevant to this specific widget if strictness needed,
        // but passing all global dashboard props (stats, loading, etc.) is usually fine
        return <Component {...widgetProps} />;
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={layout.map(w => w.id)} strategy={rectSortingStrategy}>
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 pb-10 ${isEditing ? 'min-h-[500px]' : ''}`}>
                    {layout.map((widget) => (
                        !widget.isHidden && (
                            <SortableWidget
                                key={widget.id}
                                widget={widget}
                                isEditing={isEditing}
                                onRemove={handleRemoveWidget}
                            >
                                {renderWidget(widget)}
                            </SortableWidget>
                        )
                    ))}
                </div>
            </SortableContext>

            <DragOverlay dropAnimation={dropAnimation}>
                {activeId ? (
                    <div className="h-full rounded-[2rem] overflow-hidden opacity-90 shadow-2xl scale-105">
                        {(() => {
                            const widget = layout.find(w => w.id === activeId);
                            return widget ? renderWidget(widget, true) : null;
                        })()}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
