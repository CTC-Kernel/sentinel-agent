
import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { processingActivitySchema, ProcessingActivityFormData } from '../schemas/privacySchema';
import { ProcessingActivity } from '../types';
import { Plus, Fingerprint, Trash2, Edit, GlobeLock, Scale, FileSpreadsheet, CheckCircle2, Clock, Upload, Shield, AlertOctagon, X, Save, LayoutDashboard, MessageSquare, AlertTriangle, History } from '../components/ui/Icons';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { CustomSelect } from '../components/ui/CustomSelect';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';
import { useStore } from '../store';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CommentSection } from '../components/collaboration/CommentSection';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Drawer } from '../components/ui/Drawer';
import { Badge } from '../components/ui/Badge';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { Target, Link as LinkIcon } from 'lucide-react';
import { SEO } from '../components/SEO';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { Link } from 'react-router-dom';
import { AssessmentView } from '../components/suppliers/AssessmentView';
import { canEditResource } from '../utils/permissions';
import { usePrivacy } from '../hooks/usePrivacy';

export const Privacy: React.FC = () => {
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
    const [inspectorTab, setInspectorTab] = useState<'details' | 'data' | 'links' | 'history' | 'comments'>('details');

    // Forms
    const createActivityForm = useForm<ProcessingActivityFormData>({
        resolver: zodResolver(processingActivitySchema),
        defaultValues: {
            name: '', purpose: '', manager: user?.displayName || '', managerId: user?.uid || '',
            status: 'Actif',
            legalBasis: 'Intérêt Légitime',
            dataCategories: [],
            dataSubjects: [],
            retentionPeriod: '5 ans',
            hasDPIA: false,
            relatedAssetIds: [], relatedRiskIds: []
        }
    });

    const editActivityForm = useForm<ProcessingActivityFormData>({
        resolver: zodResolver(processingActivitySchema)
    });

    // Watch form values unconditionally at top level
    // Watch form values unconditionally at top level
    // eslint-disable-next-line react-hooks/incompatible-library
    const watchedManagerId = editActivityForm.watch('managerId');
    const watchedLegalBasis = editActivityForm.watch('legalBasis');
    const watchedStatus = editActivityForm.watch('status');
    const watchedDataCategories = editActivityForm.watch('dataCategories');
    const watchedHasDPIA = editActivityForm.watch('hasDPIA');
    const watchedRelatedAssetIds = editActivityForm.watch('relatedAssetIds');
    const watchedRelatedRiskIds = editActivityForm.watch('relatedRiskIds');

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
        setDeleteModalOpen(true);
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

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <MasterpieceBackground />
            <SEO
                title="Registre RGPD"
                description="Registre des Activités de Traitement (ROPA) - Art. 30."
                keywords="RGPD, ROPA, Privacy, Confidentialité"
            />
            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Supprimer le traitement ?"
                message={`Êtes-vous sûr de vouloir supprimer ${activityToDelete?.name} ?`}
            />

            <PageHeader
                title="Registre RGPD"
                subtitle="Registre des Activités de Traitement (ROPA) - Art. 30."
                breadcrumbs={[
                    { label: 'RGPD' }
                ]}
                icon={<GlobeLock className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={canEdit && (
                    <>
                        <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm text-slate-700 dark:text-white"
                        >
                            <Upload className="h-4 w-4 mr-2" /> Importer
                        </button>
                        <button
                            onClick={() => {
                                createActivityForm.reset({ name: '', purpose: '', manager: user?.displayName || '', managerId: user?.uid || '', legalBasis: 'Intérêt Légitime', dataCategories: [], dataSubjects: [], retentionPeriod: '5 ans', hasDPIA: false, status: 'Actif' });
                                setShowCreateModal(true);
                            }}
                            className="flex items-center px-5 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/30"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Nouveau Traitement
                        </button>
                    </>
                )}
            />

            {/* Insight Card (Summary) */}
            <motion.div variants={slideUpVariants} className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group min-w-0">
                <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>
                </div>
                <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                        <span className="inline-flex h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                        Registre des Traitements
                    </p>
                    <div className="flex items-baseline gap-3">
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{stats.total}</h2>
                        <span className="text-sm font-bold text-slate-600">Traitements identifiés</span>
                    </div>
                </div>

                <div className="h-px w-full md:w-px md:h-16 bg-slate-200 dark:bg-white/10" />

                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Données Sensibles</p>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-orange-500">{stats.sensitive}</span>
                            <Badge status="warning" variant="soft" size="sm">Prioritaire</Badge>
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">DPIA Requis</p>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">
                                {stats.dpiaMissing}
                            </span>
                            <span className="text-xs font-medium text-slate-500">à réaliser</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">En Projet</p>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-blue-500">
                                {stats.review}
                            </span>
                            <span className="text-xs font-medium text-slate-500">Traitements</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Conformité Actifs</p>
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
                searchPlaceholder="Rechercher un traitement (ex: Paie, CRM)..."
                actions={
                    <button onClick={handleExportCSV} className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors" title="Exporter le Registre">
                        <FileSpreadsheet className="h-4 w-4" />
                    </button>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <CardSkeleton count={6} />
                ) : filteredActivities.length === 0 ? (
                    <div className="col-span-full">
                        <EmptyState
                            icon={Fingerprint}
                            title="Aucun traitement trouvé"
                            description={filter ? "Aucun traitement ne correspond à votre recherche." : "Commencez par ajouter vos activités de traitement au registre."}
                            actionLabel={filter ? undefined : "Nouveau Traitement"}
                            onAction={filter ? undefined : () => {
                                createActivityForm.reset({ name: '', purpose: '', manager: user?.displayName || '', managerId: user?.uid || '', legalBasis: 'Intérêt Légitime', dataCategories: [], dataSubjects: [], retentionPeriod: '5 ans', hasDPIA: false, status: 'Actif' });
                                setShowCreateModal(true);
                            }}
                        />
                    </div>
                ) : (
                    filteredActivities.map(activity => (
                        <motion.div variants={slideUpVariants} key={activity.id} onClick={() => openInspector(activity)} className="glass-panel rounded-[2.5rem] p-7 shadow-sm card-hover flex flex-col relative overflow-hidden cursor-pointer group border border-white/50 dark:border-white/5">
                            <div className="flex justify-between items-start mb-5">
                                <div className="p-3 bg-purple-50 dark:bg-slate-800 rounded-2xl text-purple-600 shadow-inner">
                                    <Fingerprint className="h-6 w-6" />
                                </div>
                                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${activity.status === 'Actif' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400' : 'bg-gray-50 text-slate-600 border-gray-100 dark:bg-white/5 dark:border-white/10 dark:text-slate-400'}`}>
                                    {activity.status}
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight">{activity.name}</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 line-clamp-2 flex-1 leading-relaxed">{activity.purpose}</p>

                            <div className="space-y-3 pt-5 border-t border-dashed border-gray-200 dark:border-white/10">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center"><Scale className="h-3 w-3 mr-1.5" />Base Légale</span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg">{activity.legalBasis}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center"><GlobeLock className="h-3 w-3 mr-1.5" />Catégories</span>
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                                        {activity.dataCategories.length > 0 ? activity.dataCategories.join(', ') : '-'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center"><Clock className="h-3 w-3 mr-1.5" />Conservation</span>
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{activity.retentionPeriod}</span>
                                </div>
                            </div>

                            {
                                activity.hasDPIA && (
                                    <div className="mt-5 flex items-center justify-center bg-purple-50 dark:bg-purple-900/20 py-2 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30">
                                        <CheckCircle2 className="h-3 w-3 mr-1.5" /> DPIA Effectué
                                    </div>
                                )
                            }

                            {
                                canEdit && (
                                    <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); initiateDelete(activity.id, activity.name) }} className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl text-slate-500 hover:text-red-50 shadow-sm backdrop-blur-sm"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                )
                            }
                        </motion.div>
                    ))
                )}
            </div>

            {/* Inspector Drawer */}
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
                                <button onClick={() => setIsEditing(true)} className="p-2.5 text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button>
                            )}
                            {canEdit && isEditing && (
                                <button onClick={editActivityForm.handleSubmit(handleUpdate)} className="p-2.5 text-brand-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Save className="h-5 w-5" /></button>
                            )}
                            {canEdit && (
                                <button onClick={() => initiateDelete(selectedActivity.id, selectedActivity.name)} className="p-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button>
                            )}
                        </>
                    )
                }
            >
                {selectedActivity && (
                    <div className="flex flex-col h-full">
                        <div className="px-4 sm:px-8 border-b border-gray-100 dark:border-white/5 bg-white/30 dark:bg-white/5">
                            <ScrollableTabs
                                tabs={[
                                    { id: 'details', label: 'Fiche Registre', icon: LayoutDashboard },
                                    { id: 'data', label: 'Données', icon: FileSpreadsheet },
                                    { id: 'links', label: 'Liens (Actifs/Risques)', icon: Shield },
                                    { id: 'history', label: 'Historique', icon: History },
                                    { id: 'comments', label: 'Discussion', icon: MessageSquare },
                                ]}
                                activeTab={inspectorTab}
                                onTabChange={(id) => setInspectorTab(id as typeof inspectorTab)}
                            />
                        </div>

                        {/* Inspector Content */}
                        <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar">
                            {inspectorTab === 'details' && selectedActivity && (
                                <div className="space-y-8">
                                    {isEditing ? (
                                        <>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <div>
                                                    <FloatingLabelInput label="Nom" {...editActivityForm.register('name')} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Responsable</label>
                                                    <CustomSelect
                                                        value={watchedManagerId || ''}
                                                        onChange={(val) => {
                                                            const value = Array.isArray(val) ? val[0] : val;
                                                            const selectedUser = usersList.find(u => u.uid === value);
                                                            editActivityForm.setValue('managerId', value);
                                                            editActivityForm.setValue('manager', selectedUser?.displayName || '');
                                                        }}
                                                        options={usersList.map(u => ({ value: u.uid, label: u.displayName }))}
                                                        placeholder="Sélectionner..."
                                                    />
                                                </div>
                                            </div>

                                            <FloatingLabelInput label="Finalité" textarea rows={3} {...editActivityForm.register('purpose')} />

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Base Légale</label>
                                                    <CustomSelect
                                                        value={watchedLegalBasis}
                                                        onChange={(val) => editActivityForm.setValue('legalBasis', (Array.isArray(val) ? val[0] : val) as 'Consentement' | 'Contrat' | 'Obligation Légale' | 'Intérêt Légitime' | 'Sauvegarde Intérêts' | 'Mission Publique')}
                                                        options={['Consentement', 'Contrat', 'Obligation Légale', 'Intérêt Légitime', 'Sauvegarde Intérêts', 'Mission Publique'].map(c => ({ value: c, label: c }))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Statut</label>
                                                    <CustomSelect
                                                        value={watchedStatus}
                                                        onChange={(val) => editActivityForm.setValue('status', Array.isArray(val) ? val[0] as 'Actif' | 'En projet' | 'Archivé' : val as 'Actif' | 'En projet' | 'Archivé')}
                                                        options={[
                                                            { value: 'Actif', label: 'Actif' },
                                                            { value: 'En projet', label: 'En projet' },
                                                            { value: 'Archivé', label: 'Archivé' }
                                                        ]}
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Finalité</h4>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedActivity.purpose}</p>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <div className="bg-white dark:bg-slate-800/50 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm text-center">
                                                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1 tracking-wide">Base Légale</span>
                                                    <span className="text-lg font-bold text-slate-900 dark:text-white">{selectedActivity.legalBasis}</span>
                                                </div>
                                                <div className="bg-white dark:bg-slate-800/50 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm text-center">
                                                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1 tracking-wide">Responsable</span>
                                                    <span className="text-lg font-bold text-slate-900 dark:text-white">{selectedActivity.manager}</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {inspectorTab === 'data' && selectedActivity && (
                                <div className="space-y-8">
                                    {isEditing ? (
                                        <>
                                            <div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div className="col-span-2">
                                                        <CustomSelect
                                                            label="Catégories de données"
                                                            multiple
                                                            value={watchedDataCategories}
                                                            onChange={(val) => editActivityForm.setValue('dataCategories', Array.isArray(val) ? val : [val])}
                                                            options={['État civil', 'Vie personnelle', 'Bancaire / Financier', 'Connexion / Trace', 'Santé (Sensible)', 'Biométrique', 'Judiciaire'].map(c => ({ value: c, label: c }))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <div>
                                                    <FloatingLabelInput label="Durée Conservation" {...editActivityForm.register('retentionPeriod')} />
                                                </div>
                                                <div>
                                                    <CustomSelect
                                                        label="DPIA Requis ?"
                                                        value={watchedHasDPIA ? 'yes' : 'no'}
                                                        onChange={(val) => editActivityForm.setValue('hasDPIA', val === 'yes')}
                                                        options={[
                                                            { value: 'yes', label: 'Oui - Requis' },
                                                            { value: 'no', label: 'Non - Pas nécessaire' }
                                                        ]}
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Catégories de Données</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedActivity.dataCategories.map(c => (
                                                        <span key={c} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-600">
                                                            {c}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 p-6 rounded-3xl border border-purple-100 dark:border-purple-900/30">
                                                <div>
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-300 mb-1">Analyse d'Impact (DPIA)</h4>
                                                    <p className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">
                                                        {selectedActivity.hasDPIA ? 'Dossier DPIA existant' : 'Aucune analyse effectuée'}
                                                    </p>
                                                    {selectedActivity.hasDPIA ? (
                                                        <button
                                                            onClick={() => handleViewDPIA(selectedActivity)}
                                                            className="text-xs font-bold bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                                        >
                                                            Consulter le DPIA
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStartDPIA(selectedActivity)}
                                                            className="text-xs font-bold bg-white text-purple-600 border border-purple-200 px-4 py-2 rounded-lg hover:bg-purple-50 transition"
                                                        >
                                                            Démarrer une analyse
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="p-3 bg-white/50 dark:bg-white/10 rounded-2xl">
                                                    {selectedActivity.hasDPIA ? <CheckCircle2 className="h-8 w-8 text-purple-600" /> : <AlertTriangle className="h-8 w-8 text-purple-400" />}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {inspectorTab === 'history' && selectedActivity && (
                                <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                    {activityHistory.map((log, i) => (
                                        <div key={i} className="relative">
                                            <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-brand-100 dark:border-brand-900">
                                                <div className="h-2 w-2 rounded-full bg-brand-600"></div>
                                            </span>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{log.details}</p>
                                                <p className="text-[10px] text-slate-500 mt-1">Par: {log.userEmail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {inspectorTab === 'comments' && selectedActivity && (
                                <div className="h-full flex flex-col">
                                    <CommentSection collectionName="processing_activities" documentId={selectedActivity.id} />
                                </div>
                            )}

                            {inspectorTab === 'links' && selectedActivity && (
                                <div className="space-y-8">
                                    {isEditing ? (
                                        <div className="space-y-6">
                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
                                                    <Shield className="h-4 w-4" /> Actifs Liés
                                                </h4>
                                                <CustomSelect
                                                    label="Sélectionner des actifs (Stockage, Support...)"
                                                    multiple
                                                    value={watchedRelatedAssetIds || []}
                                                    onChange={(val) => editActivityForm.setValue('relatedAssetIds', Array.isArray(val) ? val : [val])}
                                                    options={assetsList.map(a => ({ value: a.id, label: a.name }))}
                                                    placeholder="Associer des actifs..."
                                                />
                                            </div>

                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
                                                    <AlertOctagon className="h-4 w-4" /> Risques Associés
                                                </h4>
                                                <CustomSelect
                                                    label="Sélectionner des risques (DPIA, Menaces...)"
                                                    multiple
                                                    value={watchedRelatedRiskIds || []}
                                                    onChange={(val) => editActivityForm.setValue('relatedRiskIds', Array.isArray(val) ? val : [val])}
                                                    options={risksList.map(r => ({ value: r.id, label: r.threat.substring(0, 50) + (r.threat.length > 50 ? '...' : '') }))}
                                                    placeholder="Associer des risques..."
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">
                                                    <Shield className="h-4 w-4 text-brand-500" /> Actifs Liés (supports)
                                                </h4>
                                                {selectedActivity.relatedAssetIds && selectedActivity.relatedAssetIds.length > 0 ? (
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {selectedActivity.relatedAssetIds.map(assetId => {
                                                            const asset = assetsList.find(a => a.id === assetId);
                                                            if (!asset) return null;
                                                            return (
                                                                <Link to={`/assets?open=${asset.id}`} key={assetId} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 group-hover:text-brand-500 transition-colors">
                                                                            <Shield className="h-4 w-4" />
                                                                        </div>
                                                                        <span className="font-bold text-slate-700 dark:text-slate-200">{asset.name}</span>
                                                                    </div>
                                                                    <LinkIcon className="h-4 w-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <EmptyState icon={Shield} title="Aucun actif lié" description="Associez des actifs (serveurs, logiciels) à ce traitement." />
                                                )}
                                            </div>

                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">
                                                    <AlertOctagon className="h-4 w-4 text-red-500" /> Risques Identifiés
                                                </h4>
                                                {selectedActivity.relatedRiskIds && selectedActivity.relatedRiskIds.length > 0 ? (
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {selectedActivity.relatedRiskIds.map(riskId => {
                                                            const risk = risksList.find(r => r.id === riskId);
                                                            if (!risk) return null;
                                                            return (
                                                                <Link to={`/risks?open=${risk.id}`} key={riskId} className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors group border border-red-100 dark:border-red-900/20">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-xl text-red-500">
                                                                            <AlertOctagon className="h-4 w-4" />
                                                                        </div>
                                                                        <p className="font-bold text-slate-700 dark:text-slate-200 line-clamp-1 flex-1">{risk.threat}</p>
                                                                    </div>
                                                                    <LinkIcon className="h-4 w-4 text-slate-400 group-hover:text-red-500 transition-colors" />
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <EmptyState icon={AlertOctagon} title="Aucun risque associé" description="Liez les risques identifiés pour ce traitement." />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Drawer>

            {/* Assessment View Overlay */}
            {
                viewingAssessmentId && (
                    <div className="fixed inset-0 z-[60] bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-10 duration-300 flex flex-col">
                        <button
                            onClick={() => {
                                setViewingAssessmentId(null);
                                fetchActivities();
                            }}
                            className="absolute top-4 right-4 z-50 p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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
            < Drawer
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Nouveau Traitement"
                subtitle="Ajoutez une nouvelle activité de traitement au registre."
                width="max-w-4xl"
            >
                <form onSubmit={createActivityForm.handleSubmit(handleCreate)} className="p-4 sm:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FloatingLabelInput label="Nom du traitement" {...createActivityForm.register('name')} placeholder="ex: Gestion Paie" error={createActivityForm.formState.errors.name?.message} />
                        </div>
                        <div>
                            <label htmlFor="privacy-activity-managerId" className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Responsable</label>
                            <CustomSelect
                                value={createActivityForm.watch('managerId') || ''}
                                onChange={(val) => {
                                    const value = Array.isArray(val) ? val[0] : val;
                                    const selectedUser = usersList.find(u => u.uid === value);
                                    createActivityForm.setValue('managerId', value);
                                    createActivityForm.setValue('manager', selectedUser?.displayName || '');
                                }}
                                options={usersList.map(u => ({ value: u.uid, label: u.displayName }))}
                                placeholder="Sélectionner..."
                            />
                        </div>
                    </div>
                    <div>
                        <FloatingLabelInput label="Finalité principale" textarea rows={2} {...createActivityForm.register('purpose')} placeholder="ex: Payer les salaires et déclarations sociales" />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Base Légale</label>
                            <CustomSelect
                                value={createActivityForm.watch('legalBasis')}
                                onChange={(val) => createActivityForm.setValue('legalBasis', (Array.isArray(val) ? val[0] : val) as 'Consentement' | 'Contrat' | 'Obligation Légale' | 'Intérêt Légitime' | 'Sauvegarde Intérêts' | 'Mission Publique')}
                                options={['Consentement', 'Contrat', 'Obligation Légale', 'Intérêt Légitime'].map(c => ({ value: c, label: c }))}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Statut</label>
                            <CustomSelect
                                value={createActivityForm.watch('status')}
                                onChange={(val) => createActivityForm.setValue('status', Array.isArray(val) ? val[0] as 'Actif' | 'En projet' | 'Archivé' : val as 'Actif' | 'En projet' | 'Archivé')}
                                options={[
                                    { value: 'Actif', label: 'Actif' },
                                    { value: 'En projet', label: 'En projet' },
                                    { value: 'Archivé', label: 'Archivé' }
                                ]}
                            />
                        </div>
                    </div>
                    <div>
                        <CustomSelect
                            label="Catégories de données"
                            multiple
                            value={createActivityForm.watch('dataCategories')}
                            onChange={(val) => createActivityForm.setValue('dataCategories', Array.isArray(val) ? val : [val])}
                            options={['État civil', 'Vie personnelle', 'Bancaire / Financier', 'Connexion / Trace', 'Santé (Sensible)', 'Biométrique', 'Judiciaire'].map(c => ({ value: c, label: c }))}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div><FloatingLabelInput label="Durée Conservation" {...createActivityForm.register('retentionPeriod')} placeholder="ex: 5 ans après départ" /></div>
                        <div>
                            <CustomSelect
                                label="DPIA Requis ?"
                                value={createActivityForm.watch('hasDPIA') ? 'yes' : 'no'}
                                onChange={(val) => createActivityForm.setValue('hasDPIA', val === 'yes')}
                                options={[
                                    { value: 'yes', label: 'Oui - Requis' },
                                    { value: 'no', label: 'Non - Pas nécessaire' }
                                ]}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-white/5">
                        <div>
                            <CustomSelect
                                label="Actifs liés"
                                multiple
                                value={createActivityForm.watch('relatedAssetIds') || []}
                                onChange={(val) => createActivityForm.setValue('relatedAssetIds', Array.isArray(val) ? val : [val])}
                                options={assetsList.map(a => ({ value: a.id, label: a.name }))}
                                placeholder="Associer des actifs..."
                            />
                        </div>
                        <div>
                            <CustomSelect
                                label="Risques liés"
                                multiple
                                value={createActivityForm.watch('relatedRiskIds') || []}
                                onChange={(val) => createActivityForm.setValue('relatedRiskIds', Array.isArray(val) ? val : [val])}
                                options={risksList.map(r => ({ value: r.id, label: r.threat.substring(0, 50) + '...' }))}
                                placeholder="Associer des risques..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                        <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                        <button type="submit" className="px-8 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 hover:scale-105 transition-all font-bold text-sm shadow-lg shadow-purple-500/30">Enregistrer</button>
                    </div>
                </form>
            </Drawer >
        </motion.div >
    );
};
