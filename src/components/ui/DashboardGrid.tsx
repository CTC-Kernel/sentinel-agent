import React, { useState, useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { GripVertical, Settings, X } from './Icons';
import { cn } from '../../lib/utils';

interface Widget {
  id: string;
  title: string;
  content: React.ReactNode;
  size: 'small' | 'medium' | 'large' | 'full';
  resizable?: boolean;
  removable?: boolean;
  position: { x: number; y: number };
  sizeConfig?: { width: number; height: number };
}

interface DashboardGridProps {
  widgets: Widget[];
  onWidgetUpdate: (widget: Widget) => void;
  onWidgetRemove?: (id: string) => void;
  className?: string;
}

const sizeConfig = {
  small: { width: 2, height: 2 },
  medium: { width: 3, height: 2 },
  large: { width: 4, height: 3 },
  full: { width: 6, height: 4 }
};

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  widgets,
  onWidgetUpdate,
  onWidgetRemove,
  className = ''
}) => {
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (widgetId: string) => {
    setDraggedWidget(widgetId);
  };

  const handleDragEnd = (widgetId: string, newPosition: { x: number; y: number }) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
      onWidgetUpdate({ ...widget, position: newPosition });
    }
    setDraggedWidget(null);
  };

  const handleResize = (widgetId: string, newSize: 'small' | 'medium' | 'large' | 'full') => {
    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
      onWidgetUpdate({ ...widget, size: newSize });
    }
  };

  return (
    <div
      ref={gridRef}
      className={cn(
        "relative w-full min-h-screen bg-slate-50 dark:bg-slate-900 p-4",
        className
      )}
    >
      {/* Grid Background */}
      <div className="absolute inset-0 grid grid-cols-6 gap-4 p-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="border border-dashed border-slate-200 dark:border-slate-700 rounded-lg"
          />
        ))}
      </div>

      {/* Widgets */}
      {widgets.map((widget) => (
        <DraggableWidget
          key={widget.id}
          widget={widget}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onResize={handleResize}
          onRemove={onWidgetRemove}
          isDragging={draggedWidget === widget.id}
        />
      ))}

      {/* Add Widget Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-8 right-8 w-14 h-14 bg-brand-500 text-white rounded-full shadow-lg hover:bg-brand-600 transition-colors flex items-center justify-center"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <span className="text-2xl">+</span>
      </motion.button>
    </div>
  );
};

interface DraggableWidgetProps {
  widget: Widget;
  onDragStart: (id: string) => void;
  onDragEnd: (id: string, position: { x: number; y: number }) => void;
  onResize: (id: string, size: 'small' | 'medium' | 'large' | 'full') => void;
  onRemove?: (id: string) => void;
  isDragging: boolean;
}

const DraggableWidget: React.FC<DraggableWidgetProps> = ({
  widget,
  onDragStart,
  onDragEnd,
  onResize,
  onRemove,
  isDragging
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const dragControls = useDragControls();
  const config = sizeConfig[widget.size];

  const handleDragStart = () => {
    onDragStart(widget.id);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: { point: { x: number; y: number } }) => {
    const newPosition = { x: info.point.x, y: info.point.y };
    onDragEnd(widget.id, newPosition);
  };

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.1}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{
        position: 'absolute',
        left: widget.position.x,
        top: widget.position.y,
        width: config.width * 128, // 8rem * width
        height: config.height * 128, // 8rem * height
        zIndex: isDragging ? 1000 : 1
      }}
      animate={{
        scale: isDragging ? 1.05 : 1,
        rotate: isDragging ? 2 : 0,
        transition: { duration: 0.2 }
      }}
      className={cn(
        "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden",
        isDragging && "shadow-2xl ring-2 ring-brand-300"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-slate-400 cursor-move" />
          <h3 className="font-medium text-slate-900 dark:text-white truncate">
            {widget.title}
          </h3>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.8 }}
          className="flex items-center gap-1"
        >
          {widget.resizable && (
            <button
              onClick={() => setShowControls(!showControls)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-700 rounded"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          {widget.removable && onRemove && (
            <button
              onClick={() => onRemove(widget.id)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
            >
              <X className="w-4 h-4 text-red-500" />
            </button>
          )}
        </motion.div>
      </div>

      {/* Content */}
      <div className="p-4 h-[calc(100%-3rem)] overflow-auto">
        {widget.content}
      </div>

      {/* Resize Controls */}
      {showControls && widget.resizable && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 z-50"
        >
          <div className="flex gap-1">
            {(['small', 'medium', 'large', 'full'] as const).map((size) => (
              <button
                key={size}
                onClick={() => {
                  onResize(widget.id, size);
                  setShowControls(false);
                }}
                className={cn(
                  "px-2 py-1 text-xs rounded transition-colors",
                  widget.size === size
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                )}
              >
                {size === 'small' && 'S'}
                {size === 'medium' && 'M'}
                {size === 'large' && 'L'}
                {size === 'full' && 'XL'}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
