/**
 * AddWidgetModal Component
 * Modal for adding widgets to the dashboard with categories and search
 *
 * Story 2-6: Configurable Dashboard Widgets
 * Task 6: Updated with categories, search, and preview (AC: 2)
 */

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { WIDGET_REGISTRY, WidgetId } from './WidgetRegistry';
import { getWidgetCategory, type WidgetCategory } from '../../../config/dashboardDefaults';
import { Plus, X, Search, LayoutGrid, AlertTriangle, Clock, FileText, Grid3X3 } from '../../ui/Icons';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (widgetId: WidgetId) => void;
  currentWidgetIds: string[];
}

/**
 * Category icons mapping
 */
const CATEGORY_ICONS: Record<WidgetCategory, React.ReactNode> = {
  scoreKpi: <LayoutGrid className="w-4 h-4" />,
  risks: <AlertTriangle className="w-4 h-4" />,
  actions: <Clock className="w-4 h-4" />,
  audits: <FileText className="w-4 h-4" />,
  other: <Grid3X3 className="w-4 h-4" />,
};

/**
 * Category colors for styling
 */
const CATEGORY_COLORS: Record<WidgetCategory, string> = {
  scoreKpi: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  risks: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  actions: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  audits: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  other: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
};

/**
 * Widget card component
 */
function WidgetCard({
  id,
  titleKey,
  category,
  onAdd,
  isDisabled,
}: {
  id: string;
  titleKey: string;
  category: WidgetCategory;
  onAdd: () => void;
  isDisabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onAdd}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAdd();
        }
      }}
      className={cn(
        'p-4 rounded-3xl border transition-all text-left w-full',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        isDisabled
          ? [
              'opacity-70 cursor-not-allowed',
              'bg-slate-50/50 dark:bg-slate-800/50',
              'border-border/40 dark:border-slate-700',
            ]
          : [
              'cursor-pointer group',
              'border-border/40 dark:border-slate-700',
              'hover:border-brand-500 dark:hover:border-brand-400',
              'bg-slate-50/50 dark:bg-slate-800/50',
              'hover:bg-brand-50 dark:hover:bg-brand-900/30',
            ]
      )}
      aria-disabled={isDisabled}
      aria-label={`${t(titleKey)}${isDisabled ? ' - déjà ajouté' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'p-2.5 rounded-3xl transition-colors',
            isDisabled
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-600'
              : [
                  'bg-white dark:bg-slate-800 text-brand-500 dark:text-brand-400',
                  'group-hover:bg-brand-500 group-hover:text-white',
                  'shadow-sm dark:shadow-none',
                ]
          )}
        >
          <Plus className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              'font-bold text-sm mb-1 truncate',
              isDisabled
                ? 'text-slate-600 dark:text-slate-600'
                : 'text-slate-900 dark:text-white'
            )}
          >
            {t(titleKey)}
          </h3>
          <p className="text-xs text-slate-600 dark:text-muted-foreground line-clamp-2">
            {t(`dashboard.widgets.${id}.description`, {
              defaultValue: t('dashboard.addWidgetToDashboard'),
            })}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                CATEGORY_COLORS[category]
              )}
            >
              {CATEGORY_ICONS[category]}
              {t(`dashboard.widgetCategories.${category}`)}
            </span>
            {isDisabled && (
              <span className="text-xs text-muted-foreground dark:text-slate-600">
                (déjà ajouté)
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  currentWidgetIds,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<WidgetCategory | 'all'>('all');

  // Get all available widgets with their categories
  const widgetsWithCategories = useMemo(() => {
    return Object.entries(WIDGET_REGISTRY).map(([id, config]) => ({
      id,
      titleKey: config.titleKey,
      category: getWidgetCategory(id),
      isInUse: currentWidgetIds.includes(id),
    }));
  }, [currentWidgetIds]);

  // Filter widgets by search and category
  const filteredWidgets = useMemo(() => {
    return widgetsWithCategories.filter((widget) => {
      // Category filter
      if (selectedCategory !== 'all' && widget.category !== selectedCategory) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const title = t(widget.titleKey).toLowerCase();
        const description = t(`dashboard.widgets.${widget.id}.description`, {
          defaultValue: '',
        }).toLowerCase();

        return title.includes(query) || description.includes(query);
      }

      return true;
    });
  }, [widgetsWithCategories, selectedCategory, searchQuery, t]);

  // Group widgets by category for display
  const widgetsByCategory = useMemo(() => {
    const grouped: Record<WidgetCategory, typeof filteredWidgets> = {
      scoreKpi: [],
      risks: [],
      actions: [],
      audits: [],
      other: [],
    };

    filteredWidgets.forEach((widget) => {
      grouped[widget.category].push(widget);
    });

    return grouped;
  }, [filteredWidgets]);

  // Available categories with counts
  const categories: { key: WidgetCategory | 'all'; count: number }[] = useMemo(() => {
    const counts: Record<WidgetCategory, number> = {
      scoreKpi: 0,
      risks: 0,
      actions: 0,
      audits: 0,
      other: 0,
    };

    widgetsWithCategories.forEach((widget) => {
      counts[widget.category]++;
    });

    return [
      { key: 'all', count: widgetsWithCategories.length },
      { key: 'scoreKpi', count: counts.scoreKpi },
      { key: 'risks', count: counts.risks },
      { key: 'actions', count: counts.actions },
      { key: 'audits', count: counts.audits },
      { key: 'other', count: counts.other },
    ];
  }, [widgetsWithCategories]);

  const handleAddWidget = (widgetId: string) => {
    onAdd(widgetId as WidgetId);
    // Don't close modal to allow adding multiple widgets
  };

  // Reset filters when modal closes
  const handleClose = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
            className="relative z-10 bg-white dark:bg-slate-900 border border-border/40 dark:border-border/40 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-widget-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border/40 dark:border-white/5 shrink-0">
              <div>
                <h2
                  id="add-widget-title"
                  className="text-xl font-bold text-slate-900 dark:text-white"
                >
                  {t('dashboard.addWidget')}
                </h2>
                <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
                  {t('dashboard.customizeDashboard')}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label={t('common.close')}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Search and filters */}
            <div className="px-6 py-4 border-b border-border/40 dark:border-white/5 shrink-0 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('common.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    'w-full pl-10 pr-4 py-2.5 rounded-lg',
                    'bg-slate-50 dark:bg-slate-800',
                    'border border-border/40 dark:border-slate-700',
                    'text-slate-900 dark:text-white placeholder-slate-400',
                    'focus:outline-none focus:ring-2 focus-visible:ring-brand-500 focus:border-transparent'
                  )}
                />
              </div>

              {/* Category tabs */}
              <div className="flex flex-wrap gap-2">
                {categories.map(({ key, count }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedCategory(key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                      selectedCategory === key
                        ? 'bg-brand-500 text-white'
                        : [
                            'bg-slate-100 dark:bg-slate-800',
                            'text-slate-600 dark:text-slate-300',
                            'hover:bg-slate-200 dark:hover:bg-slate-700',
                          ]
                    )}
                  >
                    {key !== 'all' && CATEGORY_ICONS[key as WidgetCategory]}
                    <span>
                      {key === 'all'
                        ? t('common.all')
                        : t(`dashboard.widgetCategories.${key}`)}
                    </span>
                    <span
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full',
                        selectedCategory === key
                          ? 'bg-white/20'
                          : 'bg-slate-200 dark:bg-slate-700'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Widget list */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {filteredWidgets.length > 0 ? (
                selectedCategory === 'all' ? (
                  // Group by category when showing all
                  <div className="space-y-6">
                    {(Object.entries(widgetsByCategory) as [WidgetCategory, typeof filteredWidgets][])
                      .filter(([, widgets]) => widgets.length > 0)
                      .map(([category, widgets]) => (
                        <div key={category}>
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                            <span className={cn('p-1.5 rounded-lg', CATEGORY_COLORS[category])}>
                              {CATEGORY_ICONS[category]}
                            </span>
                            {t(`dashboard.widgetCategories.${category}`)}
                            <span className="text-xs text-muted-foreground font-normal">
                              ({widgets.length})
                            </span>
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {widgets.map((widget) => (
                              <WidgetCard
                                key={widget.id}
                                id={widget.id}
                                titleKey={widget.titleKey}
                                category={widget.category}
                                onAdd={() => handleAddWidget(widget.id)}
                                isDisabled={widget.isInUse}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  // Flat list when filtered by category
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredWidgets.map((widget) => (
                      <WidgetCard
                        key={widget.id}
                        id={widget.id}
                        titleKey={widget.titleKey}
                        category={widget.category}
                        onAdd={() => handleAddWidget(widget.id)}
                        isDisabled={widget.isInUse}
                      />
                    ))}
                  </div>
                )
              ) : (
                // Empty state
                <div className="col-span-full py-12 text-center flex flex-col items-center justify-center text-muted-foreground">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 opacity-20" />
                  </div>
                  <p className="font-medium">
                    {searchQuery
                      ? t('common.noResults', { defaultValue: 'Aucun résultat' })
                      : t('dashboard.allWidgetsAdded')}
                  </p>
                  <p className="text-sm opacity-70 mt-1">
                    {searchQuery
                      ? t('common.tryDifferentSearch', {
                          defaultValue: 'Essayez une autre recherche',
                        })
                      : 'Tous les widgets disponibles sont déjà affichés.'}
                  </p>
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
