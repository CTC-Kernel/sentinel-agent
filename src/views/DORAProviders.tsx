/**
 * DORA ICT Providers Page
 * DORA Art. 28 - Story 35.1
 * Main view for ICT Provider Management
 */

import React, { useEffect, useState, useCallback, useMemo} from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale';
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
import { useStore } from '../store';
import { canEditResource } from '../utils/permissions';

interface DORAProvidersProps {
 hideHeader?: boolean;
}

export const DORAProviders: React.FC<DORAProvidersProps> = ({ hideHeader = false }) => {
 const { t } = useLocale();
 const navigate = useNavigate();
 const { user } = useStore();

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
 if (!canEditResource(user, 'Supplier')) {
 toast.error(t('common.permissionDenied', { defaultValue: 'Permission denied' }));
 return;
 }
 setSelectedProvider(null);
 setIsDrawerOpen(true);
 }, [user, t]);

 const handleEdit = useCallback((provider: ICTProvider) => {
 if (!canEditResource(user, 'Supplier')) {
 toast.error(t('common.permissionDenied', { defaultValue: 'Permission denied' }));
 return;
 }
 setSelectedProvider(provider);
 setIsDrawerOpen(true);
 setIsInspectorOpen(false);
 }, [user, t]);

 const handleSelect = useCallback((provider: ICTProvider) => {
 setInspectedProvider(provider);
 setIsInspectorOpen(true);
 }, []);

 const handleDelete = useCallback(async (id: string) => {
 if (!canEditResource(user, 'Supplier')) {
 toast.error(t('common.permissionDenied', { defaultValue: 'Permission denied' }));
 return;
 }
 try {
 await deleteProvider(id);
 toast.info(t('dora.providerDeleted', { defaultValue: 'Fournisseur ICT supprimé' }));
 } catch (error) {
 ErrorLogger.error(error, 'DORAProviders.handleDelete');
 toast.error(t('common.error'));
 } finally {
 setDeleteProviderId(null);
 }
 }, [deleteProvider, t, user]);

 const handleExport = useCallback(() => {
 setIsExportOpen(true);
 }, []);


  // Extracted callbacks (useCallback)
  const handleClose = useCallback(() => {
    setIsDrawerOpen(false)
  }, []);

  const handleClose2 = useCallback(() => {
    setIsInspectorOpen(false)
  }, []);

  const handleEdit = useCallback(() => {
    handleEdit(inspectedProvider)
  }, []);

  const handleClose3 = useCallback(() => {
    setIsImportOpen(false)
  }, []);

  const handleClose4 = useCallback(() => {
    setIsExportOpen(false)
  }, []);

  const handleClose5 = useCallback(() => {
    setIsHistoryOpen(false)
  }, []);

  const handleClose6 = useCallback(() => {
    setIsHistoryOpen(false)
  }, []);

  const handleClose7 = useCallback(() => {
    setDeleteProviderId(null)
  }, []);

  const handleConfirm = useCallback(() => {
    deleteProviderId && handleDelete(deleteProviderId)
  }, []);

  const handleClick = useCallback(() => {
    navigate('/suppliers')
  }, []);

  const handleClick2 = useCallback(() => {
    setIsImportOpen(true)
  }, []);

  const handleClick3 = useCallback(() => {
    setIsImportOpen(true)
  }, []);

  const handleClick4 = useCallback(() => {
    { setCategoryFilter(''); setComplianceFilter(''); setSearchTerm(''); }
  }, []);

  const handleClick5 = useCallback(() => {
    { setCategoryFilter('critical'); setComplianceFilter(''); setSearchTerm(''); }
  }, []);

  const handleClick6 = useCallback(() => {
    { setCategoryFilter(''); setComplianceFilter(false); setSearchTerm(''); }
  }, []);

  const handleClick7 = useCallback(() => {
    { setCategoryFilter(''); setComplianceFilter(''); setSearchTerm(''); }
  }, []);

  const handleChange = useCallback((v) => {
    setCategoryFilter(v as ICTCriticality | '')
  }, []);

  const handleChange2 = useCallback((v) => {
    setComplianceFilter(v === '' ? '' : v === 'true')
  }, []);

  // Keyboard support: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);



 return (
 <div className={hideHeader ? "" : "min-h-screen bg-muted"}>
 {!hideHeader && (
 /* Header */
 <div className="bg-card border-b border-border">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div className="flex items-center gap-3">
  <Button
   variant="outline"
   onClick={handleClick}
   className="flex items-center"
  >
   <ArrowLeft className="w-4 h-4 mr-2" />
   {t('dora.providers.backToSuppliers', 'Retour Fournisseurs')}
  </Button>
  <div>
   <h1 className="text-2xl font-bold text-foreground">
   {t('dora.title')}
   </h1>
   <p className="text-muted-foreground mt-1">
   {t('dora.subtitle')}
   </p>
  </div>
  </div>
  <div className="flex items-center gap-3">
  <Button
   variant="outline"
   onClick={handleClick2}
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
 {/* Action Bar when embedded */}
 {hideHeader && (
  <div className="flex items-center justify-end gap-3 mb-6">
  <Button
  variant="outline"
  onClick={handleClick3}
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
 )}

 {/* Stats Cards */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
  <button
  type="button"
  onClick={handleClick4}
  className="glass-premium p-5 rounded-4xl border border-border/40 shadow-apple-sm transition-all duration-300 hover:-translate-y-1 cursor-pointer hover:ring-2 hover:ring-primary/30 text-left w-full"
  >
  <div className="flex items-center gap-3">
  <div className="p-3 bg-primary/10 rounded-2xl ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm">
  <Globe className="w-6 h-6 text-primary" />
  </div>
  <div>
  <p className="text-2xl font-black tracking-tight text-foreground">{stats.total}</p>
  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('dora.stats.totalProviders')}</p>
  </div>
  </div>
  </button>

  <button
  type="button"
  onClick={handleClick5}
  className="glass-premium p-5 rounded-4xl border border-border/40 shadow-apple-sm transition-all duration-300 hover:-translate-y-1 cursor-pointer hover:ring-2 hover:ring-primary/30 text-left w-full"
  >
  <div className="flex items-center gap-3">
  <div className="p-3 bg-error-bg rounded-2xl ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm">
  <AlertTriangle className="w-6 h-6 text-error-text" />
  </div>
  <div>
  <p className="text-2xl font-black tracking-tight text-foreground">{stats.critical}</p>
  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('dora.stats.criticalProviders')}</p>
  </div>
  </div>
  </button>

  <button
  type="button"
  onClick={handleClick6}
  className="glass-premium p-5 rounded-4xl border border-border/40 shadow-apple-sm transition-all duration-300 hover:-translate-y-1 cursor-pointer hover:ring-2 hover:ring-primary/30 text-left w-full"
  >
  <div className="flex items-center gap-3">
  <div className="p-3 bg-warning-bg rounded-2xl ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm">
  <FileText className="w-6 h-6 text-warning-text" />
  </div>
  <div>
  <p className="text-2xl font-black tracking-tight text-foreground">{stats.expiringSoon}</p>
  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('dora.stats.expiringContracts')}</p>
  </div>
  </div>
  </button>

  <button
  type="button"
  onClick={handleClick7}
  className="glass-premium p-5 rounded-4xl border border-border/40 shadow-apple-sm transition-all duration-300 hover:-translate-y-1 cursor-pointer hover:ring-2 hover:ring-primary/30 text-left w-full"
  >
  <div className="flex items-center gap-3">
  <div className="p-3 bg-info-bg rounded-2xl ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm">
  <Shield className="w-6 h-6 text-info-text" />
  </div>
  <div>
  <p className="text-2xl font-black tracking-tight text-foreground">
   {concentrationAnalysis.nonEuProviders?.length || 0}
  </p>
  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('dora.stats.nonEuProviders')}</p>
  </div>
  </div>
  </button>
 </div>

 {/* Filters */}
 <div className="glass-premium p-4 rounded-3xl border border-border/40 mb-6 shadow-sm">
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
  onChange={handleChange}
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
  onChange={handleChange2}
  placeholder={t('dora.filters.allStatuses')}
  />
  </div>
  </div>
 </div>

 {/* List */}
 <div className="glass-premium rounded-4xl border border-border/40 overflow-hidden shadow-apple-sm">
  <ICTProviderList
  providers={providers}
  loading={loading}
  onSelect={handleSelect}
  onEdit={handleEdit}
  onDelete={async (id) => setDeleteProviderId(id)}
  onCreateNew={handleCreate}
  />
 </div>
 </div>

 {/* Create/Edit Drawer */}
 <ICTProviderDrawer
 isOpen={isDrawerOpen}
 onClose={handleClose}
 provider={selectedProvider}
 onSuccess={refresh}
 />

 {/* Inspector Drawer */}
 <Drawer
 isOpen={isInspectorOpen}
 onClose={handleClose2}
 width="max-w-xl"
 >
 {inspectedProvider && (
  <ICTProviderInspector
  provider={inspectedProvider}
  onEdit={handleEdit}
  />
 )}
 </Drawer>

 {/* Import Modal */}
 <ImportICTProvidersModal
 isOpen={isImportOpen}
 onClose={handleClose3}
 onSuccess={refresh}
 />

 {/* Export Modal */}
 <ExportDORARegisterModal
 isOpen={isExportOpen}
 onClose={handleClose4}
 providers={providers}
 />

 {/* Export History Drawer */}
 <Drawer
 isOpen={isHistoryOpen}
 onClose={handleClose5}
 width="max-w-md"
 >
 <ExportHistoryPanel onClose={handleClose6} />
 </Drawer>

 <ConfirmModal
 isOpen={deleteProviderId !== null}
 onClose={handleClose7}
 onConfirm={handleConfirm}
 title={t('dora.providers.deleteTitle', 'Supprimer le fournisseur')}
 message={t('dora.providers.confirmDelete', 'Êtes-vous sûr de vouloir supprimer ce fournisseur ICT ?')}
 type="danger"
 confirmText={t('common.delete', 'Supprimer')}
 cancelText={t('common.cancel', 'Annuler')}
 />
 </div>
 );
};
