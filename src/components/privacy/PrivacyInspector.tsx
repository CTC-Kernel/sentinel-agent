import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ProcessingActivity, UserProfile, Asset, Risk, SystemLog } from '../../types';
import { ProcessingActivityFormData } from '../../schemas/privacySchema';
import { LayoutDashboard, FileSpreadsheet, Shield, History, MessageSquare, AlertOctagon, Link as LinkIcon, CheckCircle2, AlertTriangle } from '../ui/Icons';
import { ScrollableTabs } from '../ui/ScrollableTabs';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { Link } from 'react-router-dom';
import { EmptyState } from '../ui/EmptyState';
import { CommentSection } from '../collaboration/CommentSection';

risksList: Risk[];
activityHistory: SystemLog[];
handleStartDPIA: (activity: ProcessingActivity) => void;
handleViewDPIA: (activity: ProcessingActivity) => void;
}

export const PrivacyInspector: React.FC<PrivacyInspectorProps> = ({
    selectedActivity,
    inspectorTab,
    setInspectorTab,
    isEditing,
    editActivityForm,
    usersList,
    assetsList,
    risksList,
    activityHistory,
    handleStartDPIA,
    handleViewDPIA
}) => {
    if (!selectedActivity) return null;

    // Watch form values
    const watchedManagerId = editActivityForm.watch('managerId');
    const watchedLegalBasis = editActivityForm.watch('legalBasis');
    const watchedStatus = editActivityForm.watch('status');
    const watchedDataCategories = editActivityForm.watch('dataCategories');
    const watchedHasDPIA = editActivityForm.watch('hasDPIA');
    const watchedRelatedAssetIds = editActivityForm.watch('relatedAssetIds');
    const watchedRelatedRiskIds = editActivityForm.watch('relatedRiskIds');

    return (
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
                {inspectorTab === 'details' && (
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
                                            onChange={(val) => editActivityForm.setValue('legalBasis', (Array.isArray(val) ? val[0] : val) as ProcessingActivityFormData['legalBasis'])}
                                            options={['Consentement', 'Contrat', 'Obligation Légale', 'Intérêt Légitime', 'Sauvegarde Intérêts', 'Mission Publique'].map(c => ({ value: c, label: c }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Statut</label>
                                        <CustomSelect
                                            value={watchedStatus}
                                            onChange={(val) => editActivityForm.setValue('status', (Array.isArray(val) ? val[0] : val) as ProcessingActivityFormData['status'])}
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

                {inspectorTab === 'data' && (
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
                                                aria-label="Consulter le DPIA"
                                                onClick={() => handleViewDPIA(selectedActivity)}
                                                className="text-xs font-bold bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                            >
                                                Consulter le DPIA
                                            </button>
                                        ) : (
                                            <button
                                                aria-label="Démarrer une analyse"
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

                {inspectorTab === 'history' && (
                    <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                        {activityHistory.map((log, i) => (
                            <div key={`${log.timestamp} -${i} `} className="relative">
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

                {inspectorTab === 'comments' && (
                    <div className="h-full flex flex-col">
                        <CommentSection collectionName="processing_activities" documentId={selectedActivity.id} />
                    </div>
                )}

                {inspectorTab === 'links' && (
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
                                                    <Link to={`/ assets ? open = ${asset.id} `} key={assetId} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group">
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
                                                    <Link to={`/ risks ? open = ${risk.id} `} key={riskId} className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors group border border-red-100 dark:border-red-900/20">
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
    );
};
