
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants } from '../../ui/animationVariants';
import { RiskDashboardSkeleton, RiskListSkeleton, RiskMatrixSkeleton, RiskContextSkeleton } from '../RiskSkeletons';
import { RiskDashboard } from '../RiskDashboard';
import { RiskContextManager } from '../context/RiskContextManager';
import { FinancialRisk } from '../../../views/FinancialRisk';
import { EbiosAnalyses } from '../../../views/EbiosAnalyses';
import { RiskMatrix } from '../RiskMatrix';
import { SavedViewsBar, SavedView } from '../../ui/SavedViewsBar';
import { RisksToolbar } from '../RisksToolbar';
import { RiskAdvancedFilters } from '../RiskAdvancedFilters';
import { RiskList } from '../RiskList';
import { RiskGrid } from '../RiskGrid';
import { ShieldAlert } from '../../ui/Icons';
import { Risk, Asset } from '../../../types';

interface RiskTabsContentProps {
    activeTab: string;
    loading: boolean;
    filteredRisks: Risk[];
    activeFilters: any;
    setActiveFilters: (filters: any) => void;
    savedViews: SavedView[];
    activeViewId: string;
    handleViewSelect: (view: SavedView) => void;
    handleSaveView: () => void;
    isFiltersModified: boolean;
    viewMode: 'list' | 'grid' | 'matrix';
    setViewMode: (mode: 'list' | 'grid' | 'matrix') => void;
    frameworkFilter: string;
    setFrameworkFilter: (fw: string) => void;
    showAdvancedSearch: boolean;
    setShowAdvancedSearch: (show: boolean) => void;
    handleCommonExport: () => void;
    exportCSV: (risks: Risk[]) => Promise<void>;
    handleExportExcel: () => void;
    setImportModalOpen: (open: boolean) => void;
    setIsTemplateModalOpen: (open: boolean) => void;
    handleStartAiAnalysis: () => void;
    setCreationMode: (mode: boolean) => void;
    canEdit: boolean;
    isAnalyzing: boolean;
    availableCategories: string[];
    matrixFilter: any;
    setMatrixFilter: (f: any) => void;
    handleEdit: (risk: Risk) => void;
    handleDeleteRiskItem: (id: string) => void;
    handleDuplicateRisk: (risk: Risk) => void;
    bulkDeleteRisks: (ids: string[]) => void;
    setSelectedRisk: (risk: Risk | null) => void;
    duplicatingIds: Set<string>;
    assets: Asset[];
    emptyStateTitle: string;
    emptyStateDescription: string;
    emptyStateActionLabel: string;
    handleEmptyAction: () => void;
}

export const RiskTabsContent: React.FC<RiskTabsContentProps> = ({
    activeTab, loading, filteredRisks, activeFilters, setActiveFilters,
    savedViews, activeViewId, handleViewSelect, handleSaveView, isFiltersModified,
    viewMode, setViewMode, frameworkFilter, setFrameworkFilter,
    showAdvancedSearch, setShowAdvancedSearch, handleCommonExport, exportCSV,
    handleExportExcel, setImportModalOpen, setIsTemplateModalOpen, handleStartAiAnalysis,
    setCreationMode, canEdit, isAnalyzing, availableCategories,
    matrixFilter, setMatrixFilter, handleEdit, handleDeleteRiskItem, handleDuplicateRisk,
    bulkDeleteRisks, setSelectedRisk, duplicatingIds, assets,
    emptyStateTitle, emptyStateDescription, emptyStateActionLabel, handleEmptyAction
}) => {

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible" exit="exit" key="overview-tab" role="tabpanel">
                        {loading ? <RiskDashboardSkeleton /> : <RiskDashboard risks={filteredRisks} />}
                    </motion.div>
                );
            case 'context':
                return (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible" exit="exit" key="context-tab" role="tabpanel">
                        {loading ? <RiskContextSkeleton /> : (
                            <div className="glass-premium p-8 rounded-5xl border border-white/60 dark:border-white/10 shadow-apple-sm">
                                <RiskContextManager />
                            </div>
                        )}
                    </motion.div>
                );
            case 'financial':
                return (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible" exit="exit" key="financial-tab" role="tabpanel">
                        {loading ? <RiskDashboardSkeleton /> : <FinancialRisk hideHeader />}
                    </motion.div>
                );
            case 'ebios':
                return (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible" exit="exit" key="ebios-tab" role="tabpanel">
                        <React.Suspense fallback={<RiskListSkeleton />}>
                            <EbiosAnalyses />
                        </React.Suspense>
                    </motion.div>
                );
            default:
                return null;
        }
    };

    if (['overview', 'context', 'financial', 'ebios'].includes(activeTab)) {
        return renderContent();
    }

    return (
        <div className="space-y-4">
            <SavedViewsBar
                views={savedViews}
                activeViewId={activeViewId}
                onViewSelect={handleViewSelect}
                onSaveCurrentView={handleSaveView}
                isModified={isFiltersModified}
            />
            <motion.div variants={slideUpVariants} initial="initial" animate="visible" exit="exit" key="filter-bar">
                <RisksToolbar
                    searchQuery={activeFilters.query}
                    onSearchChange={(q) => setActiveFilters((prev: any) => ({ ...prev, query: q }))}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    activeTab={activeTab as any}
                    frameworkFilter={frameworkFilter}
                    setFrameworkFilter={setFrameworkFilter}
                    showAdvancedSearch={showAdvancedSearch}
                    setShowAdvancedSearch={setShowAdvancedSearch}
                    filteredRisks={filteredRisks}
                    handleCommonExport={handleCommonExport}
                    exportCSV={exportCSV}
                    onExportExcel={handleExportExcel}
                    setImportModalOpen={setImportModalOpen}
                    setIsTemplateModalOpen={setIsTemplateModalOpen}
                    handleStartAiAnalysis={handleStartAiAnalysis}
                    handleCreateRisk={() => setCreationMode(true)}
                    canEdit={canEdit}
                    isAnalyzing={isAnalyzing}
                    activeFilters={{
                        query: activeFilters.query,
                        status: activeFilters.status || null,
                        category: activeFilters.category || null,
                        criticality: activeFilters.criticality || null
                    }}
                    onClearFilter={(key, value) => setActiveFilters((prev: any) => ({
                        ...prev,
                        [key]: (prev[key] as string[])?.filter(v => v !== value) || null
                    }))}
                    onClearAll={() => setActiveFilters({ query: '', status: null, category: null, criticality: null })}
                />
            </motion.div>

            <AnimatePresence>
                {showAdvancedSearch && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <RiskAdvancedFilters
                            statusFilter={activeFilters.status || []}
                            onStatusFilterChange={(status) => setActiveFilters((prev: any) => ({ ...prev, status: status.length > 0 ? status : null }))}
                            categoryFilter={activeFilters.category || []}
                            onCategoryFilterChange={(category) => setActiveFilters((prev: any) => ({ ...prev, category: category.length > 0 ? category : null }))}
                            criticalityFilter={activeFilters.criticality || []}
                            onCriticalityFilterChange={(criticality) => setActiveFilters((prev: any) => ({ ...prev, criticality: criticality.length > 0 ? criticality : null }))}
                            availableCategories={availableCategories.filter((c): c is string => !!c)}
                            onClose={() => setShowAdvancedSearch(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {activeTab === 'list' && (
                <motion.div variants={slideUpVariants} initial="initial" animate="visible" exit="exit" className="mt-8 focus:outline-none" role="tabpanel">
                    {loading ? (
                        <RiskListSkeleton />
                    ) : viewMode === 'list' ? (
                        <RiskList risks={filteredRisks} loading={false} canEdit={canEdit} onEdit={handleEdit} onDelete={handleDeleteRiskItem} onDuplicate={handleDuplicateRisk} onBulkDelete={bulkDeleteRisks} onSelect={setSelectedRisk} duplicatingIds={duplicatingIds} users={[]} assets={assets} emptyStateTitle={emptyStateTitle} emptyStateDescription={emptyStateDescription} emptyStateActionLabel={!activeFilters.query ? emptyStateActionLabel : undefined} onEmptyStateAction={!activeFilters.query ? handleEmptyAction : undefined} searchQuery={activeFilters.query} />
                    ) : (
                        <RiskGrid risks={filteredRisks} loading={false} onSelect={setSelectedRisk} assets={assets} emptyStateIcon={ShieldAlert} emptyStateTitle={emptyStateTitle} emptyStateDescription={emptyStateDescription} emptyStateActionLabel={!activeFilters.query ? emptyStateActionLabel : undefined} onEmptyStateAction={!activeFilters.query ? handleEmptyAction : undefined} canEdit={canEdit} onEdit={handleEdit} onDelete={handleDeleteRiskItem} searchQuery={activeFilters.query} />
                    )}
                </motion.div>
            )}

            {activeTab === 'matrix' && (
                <motion.div variants={slideUpVariants} initial="initial" animate="visible" className="p-1 focus:outline-none" role="tabpanel">
                    <React.Suspense fallback={<RiskMatrixSkeleton />}>
                        <RiskMatrix
                            risks={filteredRisks}
                            matrixFilter={matrixFilter}
                            setMatrixFilter={setMatrixFilter}
                            frameworkFilter={frameworkFilter}
                        />
                    </React.Suspense>
                </motion.div>
            )}
        </div>
    );
};
