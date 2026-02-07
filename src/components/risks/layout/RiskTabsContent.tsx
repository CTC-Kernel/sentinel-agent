
import React, { Suspense, useCallback, useMemo} from 'react';
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

/** Active filters for risk list/matrix views */
export interface RiskActiveFilters {
 query: string;
 status: string[] | null;
 category: string[] | null;
 criticality: string[] | null;
}

/** Matrix cell selection filter */
export type RiskMatrixFilter = { p: number; i: number } | null;

type RiskTabType = 'overview' | 'context' | 'financial' | 'ebios' | 'list' | 'matrix';

interface RiskTabsContentProps {
 activeTab: string;
 loading: boolean;
 filteredRisks: Risk[];
 activeFilters: RiskActiveFilters;
 setActiveFilters: (filters: RiskActiveFilters | ((prev: RiskActiveFilters) => RiskActiveFilters)) => void;
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
 matrixFilter: RiskMatrixFilter;
 setMatrixFilter: (f: RiskMatrixFilter | ((prev: RiskMatrixFilter) => RiskMatrixFilter)) => void;
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

  // Extracted callbacks (useCallback)
  const handleSearchChange = useCallback((q) => {
    setActiveFilters((prev: RiskActiveFilters) => ({ ...prev, query: q }))
  }, []);

  const handleHandleCreateRisk = useCallback(() => {
    setCreationMode(true)
  }, []);

  const handleClearAll = useCallback(() => {
    setActiveFilters({ query: '', status: null, category: null, criticality: null })
  }, []);

  const handleStatusFilterChange = useCallback((status) => {
    setActiveFilters((prev: RiskActiveFilters) => ({ ...prev, status: status.length > 0 ? status : null }))
  }, []);

  const handleCategoryFilterChange = useCallback((category) => {
    setActiveFilters((prev: RiskActiveFilters) => ({ ...prev, category: category.length > 0 ? category : null }))
  }, []);

  const handleCriticalityFilterChange = useCallback((criticality) => {
    setActiveFilters((prev: RiskActiveFilters) => ({ ...prev, criticality: criticality.length > 0 ? criticality : null }))
  }, []);

  const handleClose = useCallback(() => {
    setShowAdvancedSearch(false)
  }, []);

 return (
  <motion.div variants={slideUpVariants} initial="initial" animate="visible" exit="exit" key="overview-tab" role="tabpanel">
  {loading ? <RiskDashboardSkeleton /> : <RiskDashboard risks={filteredRisks} />}
  </motion.div>
 );
 case 'context':
 return (
  <motion.div variants={slideUpVariants} initial="initial" animate="visible" exit="exit" key="context-tab" role="tabpanel">
  {loading ? <RiskContextSkeleton /> : (
  <div className="glass-premium p-8 rounded-3xl border border-border/40 shadow-apple-sm">
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
  <Suspense fallback={<RiskListSkeleton />}>
  <EbiosAnalyses />
  </Suspense>
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
  onSearchChange={handleSearchChange}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  activeTab={activeTab as RiskTabType}
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
  handleCreateRisk={handleHandleCreateRisk}
  canEdit={canEdit}
  isAnalyzing={isAnalyzing}
  activeFilters={{
  query: activeFilters.query,
  status: activeFilters.status || null,
  category: activeFilters.category || null,
  criticality: activeFilters.criticality || null
  }}
  onClearFilter={(key, value) => setActiveFilters((prev: RiskActiveFilters) => ({
  ...prev,
  [key]: (prev[key as keyof RiskActiveFilters] as string[] | null)?.filter(v => v !== value) || null
  }))}
  onClearAll={handleClearAll}
 />
 </motion.div>

 <AnimatePresence>
 {showAdvancedSearch && (
  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
  <RiskAdvancedFilters
  statusFilter={activeFilters.status || []}
  onStatusFilterChange={handleStatusFilterChange}
  categoryFilter={activeFilters.category || []}
  onCategoryFilterChange={handleCategoryFilterChange}
  criticalityFilter={activeFilters.criticality || []}
  onCriticalityFilterChange={handleCriticalityFilterChange}
  availableCategories={availableCategories.filter((c): c is string => !!c)}
  onClose={handleClose}
  />
  </motion.div>
 )}
 </AnimatePresence>

 {activeTab === 'list' && (
 <motion.div variants={slideUpVariants} initial="initial" animate="visible" exit="exit" className="mt-8 focus-visible:outline-none" role="tabpanel">
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
 <motion.div variants={slideUpVariants} initial="initial" animate="visible" className="p-1 focus-visible:outline-none" role="tabpanel">
  <Suspense fallback={<RiskMatrixSkeleton />}>
  <RiskMatrix
  risks={filteredRisks}
  matrixFilter={matrixFilter}
  setMatrixFilter={setMatrixFilter}
  frameworkFilter={frameworkFilter}
  />
  </Suspense>
 </motion.div>
 )}
 </div>
 );
};
