import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { WIDGET_REGISTRY, WidgetId } from './WidgetRegistry';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ pointerEvents: 'auto' }}>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                        className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5 shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('dashboard.addWidget')}</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('dashboard.customizeDashboard')}</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto custom-scrollbar">
                            {availableWidgets.length > 0 ? (
                                availableWidgets.map(([id, config]) => (
                                    <div
                                        key={id}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onAdd(id as WidgetId);
                                                onClose();
                                            }
                                        }}
                                        className="p-4 rounded-xl border border-slate-200 dark:border-white/5 hover:border-brand-500 dark:hover:border-brand-500 bg-slate-50/50 dark:bg-white/5 hover:bg-brand-50/10 dark:hover:bg-brand-500/5 transition-all cursor-pointer group flex items-start gap-4 relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                        onClick={() => {
                                            onAdd(id as WidgetId);
                                            onClose();
                                        }}
                                    >
                                        <div className="p-3 bg-white dark:bg-white/5 rounded-xl text-brand-500 group-hover:bg-brand-500 group-hover:text-white transition-colors shadow-sm">
                                            <Plus className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{t(config.titleKey)}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                {t(`dashboard.widgets.${id}.description`, { defaultValue: t('dashboard.addWidgetToDashboard') })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full py-12 text-center flex flex-col items-center justify-center text-slate-400">
                                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4">
                                        <Plus className="w-8 h-8 opacity-20" />
                                    </div>
                                    <p className="font-medium">{t('dashboard.allWidgetsAdded')}</p>
                                    <p className="text-sm opacity-70 mt-1">Tous les widgets disponibles sont déjà affichés.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};
