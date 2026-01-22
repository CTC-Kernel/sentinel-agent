/**
 * DORA ICT Providers Page
 * DORA Art. 28 - Story 35.1
 * Main view for ICT Provider Management
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { Button } from '../components/ui/button';
import { SearchInput } from '../components/ui/SearchInput';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Drawer } from '../components/ui/Drawer';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Plus, Upload, Download, Globe, AlertTriangle, Shield, FileText, ArrowLeft } from '../components/ui/Icons';

import { ICTProviderList } from '../components/dora/ICTProviderList';
import { ICTProviderDrawer } from '../components/dora/ICTProviderDrawer';
import { ICTProviderInspector } from '../components/dora/ICTProviderInspector';
import { ImportICTProvidersModal } from '../components/dora/ImportICTProvidersModal';
import { ExportDORARegisterModal } from '../components/dora/ExportDORARegisterModal';
import { ExportHistoryPanel } from '../components/dora/ExportHistoryPanel';

import { useICTProviders } from '../hooks/useICTProviders';
import { ICTProvider, ICTCriticality, ICTProviderFilters } from '../types/dora';
import { ErrorLogger } from '../services/errorLogger';

interface DORAProvidersProps {
    hideHeader?: boolean;
}

export const DORAProviders: React.FC<DORAProvidersProps> = ({ hideHeader = false }) => {
    const { t } = useTranslation();

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<ICTCriticality | ''>('');
    const [complianceFilter, setComplianceFilter] = useState<boolean | ''>('');

    const filters: ICTProviderFilters = {
        searchTerm: searchTerm || undefined,
        category: categoryFilter || undefined,
        doraCompliant: complianceFilter === '' ? undefined : complianceFilter
    };

    const {
        providers,
        loading,
        stats,
        concentrationAnalysis,
        deleteProvider,
        refresh
    } = useICTProviders({ filters });

    // Drawer states
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<ICTProvider | null>(null);
    const [isInspectorOpen, setIsInspectorOpen] = useState(false);
    const [inspectedProvider, setInspectedProvider] = useState<ICTProvider | null>(null);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [deleteProviderId, setDeleteProviderId] = useState<string | null>(null);

    const handleCreate = useCallback(() => {
        setSelectedProvider(null);
        setIsDrawerOpen(true);
    }, []);

    const handleEdit = useCallback((provider: ICTProvider) => {
        setSelectedProvider(provider);
        setIsDrawerOpen(true);
        setIsInspectorOpen(false);
    }, []);

    const handleSelect = useCallback((provider: ICTProvider) => {
        setInspectedProvider(provider);
        setIsInspectorOpen(true);
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        try {
            await deleteProvider(id);
            toast.success(t('dora.providers.toastDeleted'));
        } catch (error) {
            ErrorLogger.error(error, 'DORAProviders.handleDelete');
            toast.error(t('common.error'));
        } finally {
            setDeleteProviderId(null);
        }
    }, [deleteProvider, t]);

    const handleExport = useCallback(() => {
        setIsExportOpen(true);
    }, []);

    return (
        <div className={hideHeader ? "" : "min-h-screen bg-slate-50 dark:bg-slate-950"}>
            {!hideHeader && (
                /* Header */
                <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => window.open('/#/suppliers', '_blank')}
                                    className="flex items-center"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Retour Fournisseurs
                                </Button>
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {t('dora.title')}
                                    </h1>
                                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                                        {t('dora.subtitle')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsImportOpen(true)}
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    {t('dora.providers.importCsv')}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleExport}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    {t('dora.providers.exportRegister')}
                                </Button>
                                <Button onClick={handleCreate}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    {t('dora.providers.new')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className={hideHeader ? "" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"}>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="glass-panel p-4 rounded-2xl border border-white/50 dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                                <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                                <p className="text-xs text-slate-500">{t('dora.stats.totalProviders')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel p-4 rounded-2xl border border-white/50 dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
                                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.critical}</p>
                                <p className="text-xs text-slate-500">{t('dora.stats.criticalProviders')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel p-4 rounded-2xl border border-white/50 dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                                <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.expiringSoon}</p>
                                <p className="text-xs text-slate-500">{t('dora.stats.expiringContracts')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel p-4 rounded-2xl border border-white/50 dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {concentrationAnalysis.nonEuProviders?.length || 0}
                                </p>
                                <p className="text-xs text-slate-500">{t('dora.stats.nonEuProviders')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="glass-panel p-4 rounded-2xl border border-white/50 dark:border-white/5 mb-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <SearchInput
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder={t('dora.providers.searchPlaceholder')}
                            />
                        </div>
                        <div className="w-full sm:w-48">
                            <CustomSelect
                                options={[
                                    { value: '', label: t('dora.filters.allCategories') },
                                    { value: 'critical', label: t('dora.category.critical') },
                                    { value: 'important', label: t('dora.category.important') },
                                    { value: 'standard', label: t('dora.category.standard') }
                                ]}
                                value={categoryFilter}
                                onChange={(v) => setCategoryFilter(v as ICTCriticality | '')}
                                placeholder={t('dora.filters.allCategories')}
                            />
                        </div>
                        <div className="w-full sm:w-48">
                            <CustomSelect
                                options={[
                                    { value: '', label: t('dora.filters.allStatuses') },
                                    { value: 'true', label: t('dora.filters.doraCompliant') },
                                    { value: 'false', label: t('dora.filters.nonCompliant') }
                                ]}
                                value={complianceFilter === '' ? '' : String(complianceFilter)}
                                onChange={(v) => setComplianceFilter(v === '' ? '' : v === 'true')}
                                placeholder={t('dora.filters.allStatuses')}
                            />
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="glass-panel rounded-2xl border border-white/50 dark:border-white/5 overflow-hidden">
                    <ICTProviderList
                        providers={providers}
                        loading={loading}
                        onSelect={handleSelect}
                        onEdit={handleEdit}
                        onDelete={async (id) => setDeleteProviderId(id)}
                    />
                </div>
            </div>

            {/* Create/Edit Drawer */}
            <ICTProviderDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                provider={selectedProvider}
                onSuccess={refresh}
            />

            {/* Inspector Drawer */}
            <Drawer
                isOpen={isInspectorOpen}
                onClose={() => setIsInspectorOpen(false)}
                width="max-w-xl"
            >
                {inspectedProvider && (
                    <ICTProviderInspector
                        provider={inspectedProvider}
                        onEdit={() => handleEdit(inspectedProvider)}
                    />
                )}
            </Drawer>

            {/* Import Modal */}
            <ImportICTProvidersModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                onSuccess={refresh}
            />

            {/* Export Modal */}
            <ExportDORARegisterModal
                isOpen={isExportOpen}
                onClose={() => setIsExportOpen(false)}
                providers={providers}
            />

            {/* Export History Drawer */}
            <Drawer
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                width="max-w-md"
            >
                <ExportHistoryPanel onClose={() => setIsHistoryOpen(false)} />
            </Drawer>

            <ConfirmModal
                isOpen={deleteProviderId !== null}
                onClose={() => setDeleteProviderId(null)}
                onConfirm={() => deleteProviderId && handleDelete(deleteProviderId)}
                title={t('dora.providers.deleteTitle', 'Supprimer le fournisseur')}
                message={t('dora.providers.confirmDelete', 'Êtes-vous sûr de vouloir supprimer ce fournisseur ICT ?')}
                type="danger"
                confirmText={t('common.delete', 'Supprimer')}
                cancelText={t('common.cancel', 'Annuler')}
            />
        </div>
    );
};
