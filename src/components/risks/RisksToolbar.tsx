
import React from 'react';
import { Menu, Transition } from '@headlessui/react';
import {
    FileText, FileSpreadsheet, FileCode, MoreVertical,
    Plus, BrainCircuit, Filter, HelpCircle, List, Grid3x3, Upload
} from '../ui/Icons';
import { OnboardingService } from '../../services/onboardingService';
import { PremiumPageControl } from '../ui/PremiumPageControl';
import { CustomSelect } from '../ui/CustomSelect';
import { Button } from '../ui/button';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { ObsidianService } from '../../services/ObsidianService';
import { useStore } from '../../store';
import { Risk } from '../../types';
import { FilterPill } from '../ui/FilterPill';

interface RiskFilters {
    query: string;
    status: string[] | null;
    category: string[] | null;
    criticality: string[] | null;
}

interface RisksToolbarProps {
    // Search & Filter
    searchQuery: string;
    onSearchChange: (query: string) => void;

    viewMode: 'list' | 'grid' | 'matrix';
    onViewModeChange: (mode: 'list' | 'grid' | 'matrix') => void;
    activeTab: 'overview' | 'list' | 'matrix' | 'context' | 'financial' | 'ebios';

    frameworkFilter: string;
    setFrameworkFilter: (value: string) => void;

    showAdvancedSearch: boolean;
    setShowAdvancedSearch: (show: boolean) => void;

    // Filter Detail State
    activeFilters: RiskFilters;
    onClearFilter: (key: keyof RiskFilters, value: string) => void;
    onClearAll: () => void;

    // Data Actions
    filteredRisks: Risk[];
    handleCommonExport: () => void;
    exportCSV: (risks: Risk[]) => void;
    onExportExcel?: () => void;

    // Commands
    setImportModalOpen: (open: boolean) => void;
    setIsTemplateModalOpen: (open: boolean) => void;
    handleStartAiAnalysis: () => void;
    handleCreateRisk: () => void;

    // State
    canEdit: boolean;
    isAnalyzing: boolean;
}

export const RisksToolbar: React.FC<RisksToolbarProps> = ({
    searchQuery,
    onSearchChange,
    viewMode,
    onViewModeChange,
    activeTab,
    frameworkFilter,
    setFrameworkFilter,
    showAdvancedSearch,
    setShowAdvancedSearch,
    filteredRisks,
    handleCommonExport,
    exportCSV,
    onExportExcel,
    setImportModalOpen,
    setIsTemplateModalOpen,
    handleStartAiAnalysis,
    handleCreateRisk,
    canEdit,
    isAnalyzing,
    activeFilters,
    onClearFilter,
    onClearAll
}) => {
    const { t } = useStore();

    return (
        <PremiumPageControl
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder={t('risks.searchPlaceholder')}
            activeView={activeTab === 'list' ? viewMode : undefined}
            onViewChange={activeTab === 'list' ? (m) => onViewModeChange(m as 'list' | 'grid' | 'matrix') : undefined}
            viewOptions={[
                { id: 'list', label: t('assets.viewList'), icon: List },
                { id: 'grid', label: t('assets.viewGrid'), icon: Grid3x3 }
            ]}
            actions={
                <>
                    <div className="hidden md:block w-48">
                        <CustomSelect
                            value={frameworkFilter}
                            onChange={(v) => setFrameworkFilter(v as string)}
                            options={[
                                { value: '', label: t('risks.allFrameworks') },
                                { value: 'ISO 27001', label: 'ISO 27001' },
                                { value: 'ISO 27005', label: 'ISO 27005' },
                                { value: 'EBIOS', label: 'EBIOS RM' },
                                { value: 'NIST', label: 'NIST' }
                            ]}
                            placeholder={t('risks.framework')}
                        />
                    </div>

                    <div className="h-8 w-px bg-slate-200 dark:bg-white/10 mx-2 hidden md:block" />

                    <CustomTooltip content={t('risks.startTour')}>
                        <Button variant="outline" size="icon" onClick={() => OnboardingService.startRisksTour()} aria-label={t('risks.startTour')}>
                            <HelpCircle className="h-5 w-5" />
                        </Button>
                    </CustomTooltip>

                    <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                    <CustomTooltip content={t('assets.advancedFilters')}>
                        <Button
                            variant="outline"
                            size="icon"
                            data-tour="risks-filters"
                            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                            aria-label={t('assets.advancedFilters')}
                            aria-expanded={showAdvancedSearch}
                            className={showAdvancedSearch ? 'bg-brand-50 text-brand-600 border-brand-100' : ''}
                        >
                            <Filter className="h-5 w-5" />
                        </Button>
                    </CustomTooltip>

                    <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                    <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button as={Button} variant="outline" size="icon" aria-label={t('risks.moreActions') || 'Plus d\'actions'}>
                            <MoreVertical className="h-5 w-5" />
                        </Menu.Button>
                        <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                            <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-slate-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                <div className="p-1">
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button onClick={handleCommonExport} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                <FileText className="mr-2 h-4 w-4" /> {t('risks.reports')} (PDF)
                                            </button>
                                        )}
                                    </Menu.Item>
                                    {onExportExcel && (
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button onClick={onExportExcel} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                    <FileSpreadsheet className="mr-2 h-4 w-4" /> {t('risks.exportExcel') || 'Export Excel'}
                                                </button>
                                            )}
                                        </Menu.Item>
                                    )}
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button onClick={() => exportCSV(filteredRisks)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                <FileSpreadsheet className="mr-2 h-4 w-4" /> {t('risks.exportCsv')}
                                            </button>
                                        )}
                                    </Menu.Item>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button onClick={() => ObsidianService.exportRisksToObsidian(filteredRisks)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                <FileCode className="mr-2 h-4 w-4" /> {t('risks.obsidian')}
                                            </button>
                                        )}
                                    </Menu.Item>
                                </div>
                                {canEdit && (
                                    <div className="p-1">
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button onClick={() => setImportModalOpen(true)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                    <Upload className="mr-2 h-4 w-4" /> {t('risks.importCsv')}
                                                </button>
                                            )}
                                        </Menu.Item>
                                        {/* Templates Button moved here or kept in menu? It was in menu in original code */}
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button onClick={() => setIsTemplateModalOpen(true)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                    {/* Using FileText as generic icon if Copy not available, but Copy is usually imported */}
                                                    <FileText className="mr-2 h-4 w-4" /> {t('risks.templates')}
                                                </button>
                                            )}
                                        </Menu.Item>
                                    </div>
                                )}
                            </Menu.Items>
                        </Transition>
                    </Menu>

                    {canEdit && (
                        <>
                            <CustomTooltip content="Lancer l'analyse IA">
                                <Button
                                    onClick={handleStartAiAnalysis}
                                    disabled={isAnalyzing}
                                    isLoading={isAnalyzing}
                                    variant="premium"
                                    className="hidden lg:flex"
                                >
                                    {!isAnalyzing && <BrainCircuit className="h-4 w-4 mr-2" />}
                                    <span className="hidden xl:inline">{isAnalyzing ? t('risks.analyzing') : t('risks.aiAnalysis')}</span>
                                </Button>
                            </CustomTooltip>
                            <CustomTooltip content="Créer un nouveau risque">
                                <Button
                                    data-tour="risks-create"
                                    onClick={handleCreateRisk}
                                    variant="default"
                                    className="shadow-lg shadow-brand-500/20"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">{t('risks.newRisk')}</span>
                                </Button>
                            </CustomTooltip>
                        </>
                    )}
                </>
            }
            showBottomContent={!!activeFilters.status || !!activeFilters.category || !!activeFilters.criticality}
            bottomContent={
                <>
                    <div className="flex flex-wrap gap-2 flex-1">
                        {activeFilters.status?.map(s => (
                            <FilterPill
                                key={`status-${s}`}
                                label="Statut"
                                value={s}
                                onRemove={() => onClearFilter('status', s)}
                                color="brand"
                            />
                        ))}
                        {activeFilters.category?.map(c => (
                            <FilterPill
                                key={`cat-${c}`}
                                label="Catégorie"
                                value={c}
                                onRemove={() => onClearFilter('category', c)}
                                color="emerald"
                            />
                        ))}
                        {activeFilters.criticality?.map(crit => (
                            <FilterPill
                                key={`crit-${crit}`}
                                label="Criticité"
                                value={crit}
                                onRemove={() => onClearFilter('criticality', crit)}
                                color="amber"
                            />
                        ))}
                    </div>
                    {(activeFilters.status || activeFilters.category || activeFilters.criticality) && (
                        <button
                            onClick={onClearAll}
                            className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-red-500 transition-colors ml-auto px-2 py-1"
                        >
                            {t('common.reset') || 'Effacer'}
                        </button>
                    )}
                </>
            }
        />
    );
};
