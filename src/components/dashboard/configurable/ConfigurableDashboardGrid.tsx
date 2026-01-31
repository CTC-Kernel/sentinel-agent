import React, { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, defaultDropAnimationSideEffects, DropAnimation } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { WidgetLayout } from '../../../hooks/useDashboardPreferences';
import { WIDGET_REGISTRY } from './WidgetRegistry';

import { SortableWidget } from './SortableWidget';

// --- Main Grid Component ---

interface ConfigurableDashboardGridProps {
    layout: WidgetLayout[];
    onLayoutChange: (newLayout: WidgetLayout[]) => void;
    isEditing: boolean;
    widgetProps: Record<string, unknown>; // Props to pass down to widgets
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

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
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

    const renderWidget = (item: WidgetLayout) => {
        const entry = WIDGET_REGISTRY[item.widgetId];
        if (!entry) return <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-800 rounded-3xl">Widget not found: {item.widgetId}</div>;

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
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 pb-10 ${isEditing ? 'min-h-[500px]' : ''}`}>
                    {layout.map((widget) => (
                        !widget.isHidden && (
                            <SortableWidget
                                key={widget.id || 'unknown'}
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
                    <div className="w-full h-full rounded-4xl overflow-hidden shadow-2xl scale-105 ring-4 ring-brand-300 cursor-grabbing bg-background">
                        {(() => {
                            const widget = layout.find(w => w.id === activeId);
                            // We need to enforce width on the overlay to prevent squashing
                            if (!widget) return null;

                            // We can approximate width or just let it be intrinsic, 
                            // but adding a specific class for the overlay helps.
                            return (
                                <div className="w-full h-full pointer-events-none">
                                    {renderWidget(widget)}
                                </div>
                            );
                        })()}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
