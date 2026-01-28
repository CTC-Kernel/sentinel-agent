import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ContinuityDashboard } from './ContinuityDashboard';
import { ContinuityBIA } from './ContinuityBIA';
import { ContinuityStrategies } from './ContinuityStrategies';
import { ContinuityPRA } from './pra/ContinuityPRA';
import { ContinuityDrills } from './ContinuityDrills';
import { ContinuityCrisis } from './ContinuityCrisis';
import { ContinuityMethodsWorkshops } from './ContinuityMethodsWorkshops';
import { EmptyState } from '../ui/EmptyState';
import { AlertOctagon, Download, Plus, Upload } from '../ui/Icons';
import { BusinessProcess, BcpDrill, Asset, UserProfile } from '../../types';
import { TlptCampaign } from '../../types/tlpt';
import { TlptDashboard } from './tlpt/TlptDashboard';
import { PremiumPageControl } from '../ui/PremiumPageControl';
import { useTranslation } from 'react-i18next';
import { ErrorLogger } from '../../services/errorLogger';

interface ContinuityContentProps {
    activeTab: 'overview' | 'strategies' | 'pra' | 'bia' | 'drills' | 'crisis' | 'tlpt' | 'methods';
    loading: boolean;
    viewMode: 'grid' | 'list' | 'matrix' | 'kanban';
    filteredProcesses: BusinessProcess[];
    assets: Asset[];
    drills: BcpDrill[];
    users: UserProfile[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onViewModeChange: (mode: 'grid' | 'list' | 'matrix' | 'kanban') => void;
    onGenerateReport: () => void;
    onImportCsv: () => void;
    canCreate: boolean;
    onOpenProcessModal: () => void;
    onSetSelectedProcess: (process: BusinessProcess) => void;
    onOpenDrillModal: () => void;
    onDeleteDrill: (id: string) => void;
    _tlptCampaigns?: TlptCampaign[];
    _onAddTlpt: (data: Partial<TlptCampaign>) => Promise<void>;
    _onUpdateTlpt: (id: string, data: Partial<TlptCampaign>) => Promise<void>;
    _onDeleteTlpt: (id: string) => Promise<void>;
    // PRA Props
    recoveryPlans: import('../../types').RecoveryPlan[];
    onAddPlan: (data: import('../../schemas/continuitySchema').RecoveryPlanFormData) => Promise<void>;
    onUpdatePlan: (id: string, data: Partial<import('../../schemas/continuitySchema').RecoveryPlanFormData>) => Promise<void>;
    onDeletePlan: (id: string) => Promise<void>;
}

export const ContinuityContent: React.FC<ContinuityContentProps> = ({
    activeTab,
    loading,
    viewMode,
    filteredProcesses,
    assets,
    drills,
    users,
    searchQuery,
    onSearchChange,
    onViewModeChange,
    onGenerateReport,
    onImportCsv,
    canCreate,
    onOpenProcessModal,
    onSetSelectedProcess,
    onOpenDrillModal,
    onDeleteDrill,
    _tlptCampaigns,
    _onAddTlpt,
    _onUpdateTlpt,
    _onDeleteTlpt,
    recoveryPlans,
    onAddPlan,
    onUpdatePlan,
    onDeletePlan
}) => {
    const { t } = useTranslation();

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
            >
                {activeTab === 'overview' && (
                    <div data-tour="continuity-dashboard">
                        <ContinuityDashboard
                            processes={filteredProcesses}
                            drills={drills}
                            loading={loading}
                        />
                    </div>
                )}

                {activeTab === 'bia' && (
                    <div className="space-y-6">
                        <PremiumPageControl
                            searchQuery={searchQuery}
                            onSearchChange={onSearchChange}
                            searchPlaceholder={t('continuity.searchPlaceholder')}
                            onViewModeChange={onViewModeChange}
                            actions={
                                <div className="flex items-center gap-2">
                                    <button
                                        aria-label="Générer le rapport"
                                        onClick={onGenerateReport}
                                        className="p-2 bg-white dark:bg-slate-800 border border-border/40 dark:border-border/40 text-slate-700 dark:text-white rounded-3xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                    >
                                        <Download className="h-5 w-5" />
                                    </button>
                                    {canCreate && (
                                        <button
                                            aria-label={t('continuity.newProcess')}
                                            onClick={onOpenProcessModal}
                                            className="flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-3xl font-bold transition-all shadow-lg shadow-brand-600/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-600"
                                        >
                                            <Plus className="h-5 w-5 mr-2" />
                                            {t('continuity.newProcess')}
                                        </button>
                                    )}

                                    {canCreate && (
                                        <button
                                            aria-label={t('common.importCsv')}
                                            onClick={onImportCsv}
                                            className="p-2 bg-white dark:bg-slate-800 border border-border/40 dark:border-border/40 text-slate-700 dark:text-white rounded-3xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                        >
                                            <Upload className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>
                            }
                        />
                        {filteredProcesses.length === 0 && !loading ? (
                            <EmptyState
                                icon={AlertOctagon}
                                title="Aucun processus défini"
                                description="Commencez par cartographier vos processus critiques pour réaliser votre BIA."
                                actionLabel="Ajouter un processus"
                                onAction={onOpenProcessModal}
                            />
                        ) : (
                            <ContinuityBIA
                                processes={filteredProcesses}
                                loading={loading}
                                viewMode={viewMode as 'grid' | 'list'}
                                onOpenInspector={onSetSelectedProcess}
                                onNewProcess={onOpenProcessModal}
                                users={users}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'strategies' && (
                    <ContinuityStrategies assets={assets} />
                )}

                {activeTab === 'pra' && (
                    <ContinuityPRA
                        plans={recoveryPlans}
                        assets={assets}
                        users={users}
                        loading={loading}
                        onAdd={onAddPlan}
                        onUpdate={onUpdatePlan}
                        onDelete={onDeletePlan}
                    />
                )}

                {activeTab === 'drills' && (
                    <ContinuityDrills
                        drills={drills}
                        processes={filteredProcesses}
                        loading={loading}
                        onNewDrill={onOpenDrillModal}
                        onDelete={onDeleteDrill}
                    />
                )}

                {activeTab === 'crisis' && (
                    <ContinuityCrisis users={users} />
                )}

                {activeTab === 'tlpt' && (
                    <TlptDashboard
                        campaigns={_tlptCampaigns || []}
                        loading={loading}
                        onAdd={_onAddTlpt}
                        onUpdate={_onUpdateTlpt}
                        onDelete={_onDeleteTlpt}
                        canEdit={canCreate}
                    />
                )}

                {activeTab === 'methods' && (
                    <ContinuityMethodsWorkshops
                        onStartWorkshop={(templateId) => {
                            ErrorLogger.debug(`Starting continuity workshop: ${templateId}`, 'ContinuityContent');
                        }}
                    />
                )}
            </motion.div>
        </AnimatePresence>
    );
};
