import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WIDGET_REGISTRY, WidgetId } from './WidgetRegistry';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // Assumption: using i18next as per codebase patterns

interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (widgetId: WidgetId) => void;
    currentWidgetIds: string[];
}

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ isOpen, onClose, onAdd, currentWidgetIds }) => {
    const { t } = useTranslation();

    const availableWidgets = useMemo(() => {
        return Object.entries(WIDGET_REGISTRY).filter(([id]) => !currentWidgetIds.includes(id));
    }, [currentWidgetIds]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <h2 className="text-lg font-bold">{t('dashboard.addWidget')}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {availableWidgets.length > 0 ? (
                            availableWidgets.map(([id, config]) => (
                                <div
                                    key={id}
                                    className="p-4 rounded-lg border border-border hover:border-brand-500 hover:bg-muted/50 transition-all cursor-pointer group flex items-start gap-4"
                                    onClick={() => {
                                        onAdd(id as WidgetId);
                                        onClose();
                                    }}
                                >
                                    <div className="p-3 bg-brand-500/10 rounded-lg text-brand-500 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                                        <Plus className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm mb-1">{t(config.titleKey)}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {t(`dashboard.widgets.${id}.description`, { defaultValue: "Ajouter ce widget au tableau de bord." })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-12 text-center text-muted-foreground">
                                <p>{t('dashboard.allWidgetsAdded')}</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
