
import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldErrors } from 'react-hook-form';
import { useZodForm } from '../hooks/useZodForm';
import { processingActivitySchema, ProcessingActivityFormData } from '../schemas/privacySchema';
import { ProcessingActivity } from '../types';
import { Plus, Fingerprint, Trash2, Edit, FileSpreadsheet, Upload, X, Save } from '../components/ui/Icons';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { useStore } from '../store';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Drawer } from '../components/ui/Drawer';
import { InspectorLayout } from '../components/ui/InspectorLayout';
import { Badge } from '../components/ui/Badge';

import { Target } from '../components/ui/Icons';
import { SEO } from '../components/SEO';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';

import { AssessmentView } from '../components/suppliers/AssessmentView';
import { canEditResource } from '../utils/permissions';
import { usePrivacy } from '../hooks/usePrivacy';
import { usePersistedState } from '../hooks/usePersistedState';

import { toast } from '@/lib/toast';
import { ActivityCard } from '../components/privacy/ActivityCard';
import { PrivacyInspector } from '../components/privacy/PrivacyInspector';
import { CreateActivityForm } from '../components/privacy/CreateActivityForm';

export const Privacy: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useStore();
    const {
        activities,
        usersList,
        assetsList,
        risksList,
        loading,
        selectedActivity,
        setSelectedActivity,
        isEditing,
        setIsEditing,
        viewingAssessmentId,
        setViewingAssessmentId,
        showCreateModal,
        setShowCreateModal,
        fetchData: fetchActivities,
        handleCreate,
        handleUpdate,
        handleDelete,
        handleStartDPIA,
        handleViewDPIA,
        activityHistory,
        stats,
        handleFileUpload
    } = usePrivacy();

    const [filter, setFilter] = useState('');
    const [inspectorTab, setInspectorTab] = usePersistedState<'details' | 'data' | 'links' | 'history' | 'comments'>('privacy_inspector_tab', 'details');

    // Forms
    // const createActivityForm removed (moved to component)

    const editActivityForm = useZodForm({
        schema: processingActivitySchema,
        mode: 'onChange'
    });

    const onInvalid = (errors: FieldErrors<ProcessingActivityFormData>) => {
        const missingFields = Object.keys(errors).join(', ');
        toast.error(`${t('privacy.formInvalid')}: ${missingFields}`);
    };

    // Reset edit form when selected activity changes
    useEffect(() => {
        if (selectedActivity) {
            editActivityForm.reset({
                name: selectedActivity.name,
                purpose: selectedActivity.purpose,
                manager: selectedActivity.manager,
                managerId: selectedActivity.managerId,
                status: selectedActivity.status,
                legalBasis: selectedActivity.legalBasis,
                dataCategories: selectedActivity.dataCategories,
                dataSubjects: selectedActivity.dataSubjects,
                retentionPeriod: selectedActivity.retentionPeriod,
                hasDPIA: selectedActivity.hasDPIA,
                relatedAssetIds: selectedActivity.relatedAssetIds || [],
                relatedRiskIds: selectedActivity.relatedRiskIds || []
            });
        }
    }, [selectedActivity, editActivityForm]);

    // Permissions
    const canEdit = canEditResource(user, 'ProcessingActivity');

    // Delete Modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [activityToDelete, setActivityToDelete] = useState<{ id: string, name: string } | null>(null);

    const initiateDelete = (id: string, name: string) => {
        if (!canEdit) return;
        setActivityToDelete({ id, name });
        setDeleteModalOpen(true); // confirmDialog via ConfirmModal
    };

    const confirmDelete = async () => {
        if (activityToDelete) {
            await handleDelete(activityToDelete.id, activityToDelete.name);
            setDeleteModalOpen(false);
            setActivityToDelete(null);
        }
    };

    const openInspector = (activity: ProcessingActivity) => {
        setSelectedActivity(activity);
        setInspectorTab('details');
        setIsEditing(false);
    };

    // CSV Export
    const handleExportCSV = () => {
        const headers = ["Nom", "Finalité", "Responsable", "Base Légale", "Catégories Données", "Durée Conservation", "DPIA"];
        const rows = filteredActivities.map(a => [
            a.name,
            a.purpose,
            a.manager,
            a.legalBasis,
            a.dataCategories.join('; '),
            a.retentionPeriod,
            a.hasDPIA ? 'Oui' : 'Non'
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `ropa_gdpr_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const filteredActivities = activities.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()));

    const handleAddActivity = React.useCallback(() => {
        setShowCreateModal(true);
    }, [setShowCreateModal]);

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
        >
            <MasterpieceBackground />
            <SEO
                title={t('privacy.title')}
                description={t('privacy.subtitle')}
                keywords={t('privacy.keywords')}
            />
            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title={t('privacy.deleteTitle')}
                message={t('privacy.deleteMessage', { name: activityToDelete?.name })}
            />

            <PageHeader
                title={t('privacy.title')}
                subtitle={t('privacy.subtitle')}
                icon={
                    <img
                        src="/images/gouvernance.png"
                        alt="GOUVERNANCE"
                        className="w-full h-full object-contain"
                    />
                }
                actions={canEdit && (
                    <>
                        <div className="flex gap-2 mb-2">
                            <input aria-label="Import activities from CSV" type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} hidden />
                            <button
                                aria-label="Importer"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center px-5 py-2.5 bg-background border border-muted rounded-xl text-sm font-bold hover:bg-muted/40 transition-all shadow-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                <Upload className="h-4 w-4 mr-2" /> {t('common.importCsv')}
                            </button>
                            <button
                                aria-label="Nouveau Traitement"
                                onClick={handleAddActivity}
                                className="flex items-center px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                <Plus className="h-4 w-4 mr-2" /> {t('privacy.newActivity')}
                            </button>
                        </div>
                    </>
                )}
            />

            {/* Insight Card (Summary) */}
            <motion.div variants={slideUpVariants} className="glass-premium p-8 rounded-3xl border border-border/40 shadow-apple-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group min-w-0">
                <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/20 dark:bg-brand-400/15 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>
                </div>
                <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <span className="inline-flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                        {t('privacy.registryLabel')}
                    </p>
                    <div className="flex items-baseline gap-3">
                        <h2 className="text-4xl font-black text-foreground tracking-tight">{stats.total}</h2>
                        <span className="text-sm font-bold text-muted-foreground">{t('privacy.activitiesIdentified')}</span>
                    </div>
                </div>

                <div className="h-px w-full md:w-px md:h-16 bg-slate-200 dark:bg-white/10" />

                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 mb-1">{t('privacy.stats.sensitiveData')}</p>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-orange-500">{stats.sensitive}</span>
                            <Badge status="warning" variant="soft" size="sm">{t('privacy.stats.priority')}</Badge>
                        </div>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 mb-1">{t('privacy.stats.dpiaRequired')}</p>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">
                                {stats.dpiaMissing}
                            </span>
                            <span className="text-xs font-medium text-slate-500">{t('privacy.stats.toComplete')}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 mb-1">{t('privacy.stats.inProgress')}</p>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-blue-500">
                                {stats.review}
                            </span>
                            <span className="text-xs font-medium text-slate-500">{t('privacy.stats.activities')}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 mb-1">{t('privacy.stats.activeCompliance')}</p>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-emerald-500">
                                {stats.total > 0 ? Math.round(((stats.total - stats.review) / stats.total) * 100) : 0}%
                            </span>
                            <Target className="h-4 w-4 text-emerald-500" />
                        </div>
                    </div>
                </div>
            </motion.div>

            <PremiumPageControl
                searchQuery={filter}
                onSearchChange={setFilter}
                searchPlaceholder={t('privacy.searchPlaceholder')}
                actions={
                    <button onClick={handleExportCSV} className="p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" title={t('privacy.exportRegistry')}>
                        <FileSpreadsheet className="h-4 w-4" />
                    </button>
                }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {loading ? (
                    <CardSkeleton count={6} />
                ) : filteredActivities.length === 0 ? (
                    <div className="col-span-full">
                        <EmptyState
                            icon={Fingerprint}
                            title={t('privacy.emptyTitle')}
                            description={filter ? t('privacy.emptySearch') : t('privacy.emptyDescription')}
                            actionLabel={filter ? undefined : t('privacy.newActivity')}
                            onAction={filter ? undefined : () => {
                                setShowCreateModal(true);
                            }}
                        />
                    </div>
                ) : (
                    filteredActivities.map(activity => (
                        <ActivityCard
                            key={activity.id || 'unknown'}
                            activity={activity}
                            onClick={openInspector}
                            onDelete={initiateDelete}
                            canEdit={canEdit}
                        />
                    ))
                )}
            </div>

            <Drawer
                isOpen={!!selectedActivity}
                onClose={() => setSelectedActivity(null)}
                title={selectedActivity?.name}
                width="max-w-6xl"
                subtitle={
                    selectedActivity ? (
                        <span className="flex items-center gap-2" >
                            {selectedActivity.status} • {selectedActivity.manager
                            }
                        </span >
                    ) : null
                }
                actions={
                    selectedActivity && (
                        <>
                            {canEdit && !isEditing && (
                                <button aria-label="Edit Activity" onClick={() => setIsEditing(true)} className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button>
                            )}
                            {canEdit && isEditing && (
                                <button aria-label="Save Activity" onClick={editActivityForm.handleSubmit(handleUpdate, onInvalid)} className="p-2.5 text-brand-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Save className="h-5 w-5" /></button>
                            )}
                            {canEdit && (
                                <button aria-label="Delete Activity" onClick={() => initiateDelete(selectedActivity.id, selectedActivity.name)} className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button>
                            )}
                        </>
                    )
                }
            >
                <PrivacyInspector
                    selectedActivity={selectedActivity}
                    inspectorTab={inspectorTab}
                    setInspectorTab={setInspectorTab}
                    isEditing={isEditing}
                    editActivityForm={editActivityForm}
                    usersList={usersList}
                    assetsList={assetsList}
                    risksList={risksList}
                    activityHistory={activityHistory}
                    handleStartDPIA={handleStartDPIA}
                    handleViewDPIA={handleViewDPIA}
                />
            </Drawer>

            {/* Assessment View Overlay */}
            {
                viewingAssessmentId && (
                    <div className="fixed inset-0 z-modal bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-10 duration-300 flex flex-col">
                        <button
                            aria-label="Close"
                            onClick={() => {
                                setViewingAssessmentId(null);
                                fetchActivities();
                            }}
                            className="absolute top-4 right-4 z-modal p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <X className="w-6 h-6 text-slate-500" />
                        </button>
                        <AssessmentView
                            responseId={viewingAssessmentId}
                            onClose={() => {
                                setViewingAssessmentId(null);
                                fetchActivities();
                            }}
                            context="privacy"
                        />
                    </div>
                )
            }

            {/* Create Drawer */}
            <InspectorLayout
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title={t('privacy.newActivity')}
                subtitle={t('privacy.newActivitySubtitle')}
                width="max-w-6xl"
                icon={Fingerprint}
                disableContentPadding={true}
            >
                <div className="max-w-5xl mx-auto w-full">
                    <CreateActivityForm
                        usersList={usersList}
                        assetsList={assetsList}
                        risksList={risksList}
                        onSubmit={handleCreate}
                        onCancel={() => setShowCreateModal(false)}
                    />
                </div>
            </InspectorLayout>
        </motion.div >
    );
};

// Headless UI handles FocusTrap and keyboard navigation
