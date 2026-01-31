import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ProcessingActivity, UserProfile, Asset, Risk, SystemLog } from '../../types';
import { ProcessingActivityFormData } from '../../schemas/privacySchema';
import { LayoutDashboard, FileSpreadsheet, Shield, History, MessageSquare } from '../ui/Icons';
import { ScrollableTabs } from '../ui/ScrollableTabs';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { DiscussionPanel } from '../collaboration/DiscussionPanel';
import { PrivacyDetails } from './inspector/PrivacyDetails';
import { PrivacyData } from './inspector/PrivacyData';
import { PrivacyLinks } from './inspector/PrivacyLinks';
import { useStore } from '../../store';
// Focus indicators: focus-visible:ring-2 applied globally via CSS

export type InspectorTab = 'details' | 'data' | 'links' | 'history' | 'comments';

interface PrivacyInspectorProps {
    selectedActivity: ProcessingActivity | null;
    inspectorTab: InspectorTab;
    setInspectorTab: (tab: InspectorTab) => void;
    isEditing: boolean;
    editActivityForm: UseFormReturn<ProcessingActivityFormData>;
    usersList: UserProfile[];
    assetsList: Asset[];
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
    const { t } = useStore();

    if (!selectedActivity) return null;

    // Watch forms
    const watchedManagerId = editActivityForm.watch('managerId');
    const watchedLegalBasis = editActivityForm.watch('legalBasis');
    const watchedStatus = editActivityForm.watch('status');

    return (
        <div className="flex flex-col h-full">
            <div className="px-4 sm:px-8 border-b border-border/40 dark:border-white/5 bg-white/30 dark:bg-white/5">
                <ScrollableTabs
                    tabs={[
                        { id: 'details', label: t('privacy.tabs.details', { defaultValue: 'Fiche Registre' }), icon: LayoutDashboard },
                        { id: 'data', label: t('privacy.tabs.data', { defaultValue: 'Données' }), icon: FileSpreadsheet },
                        { id: 'links', label: t('privacy.tabs.links', { defaultValue: 'Liens (Actifs/Risques)' }), icon: Shield },
                        { id: 'history', label: t('privacy.tabs.history', { defaultValue: 'Historique' }), icon: History },
                        { id: 'comments', label: t('privacy.tabs.comments', { defaultValue: 'Discussion' }), icon: MessageSquare },
                    ]}
                    activeTab={inspectorTab}
                    onTabChange={(id) => setInspectorTab(id as InspectorTab)}
                />
            </div>

            <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar">
                {inspectorTab === 'details' && (
                    <div className="space-y-6 sm:space-y-8">
                        {isEditing ? (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <FloatingLabelInput label="Nom" {...editActivityForm.register('name')} />
                                    </div>
                                    <div>
                                        <div className="block text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-2">{t('privacy.fields.manager', { defaultValue: 'Responsable' })}</div>
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
                                        <label htmlFor="legalBasis" className="block text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-2">{t('privacy.fields.legalBasis', { defaultValue: 'Base Légale' })}</label>
                                        <CustomSelect
                                            id="legalBasis"
                                            value={watchedLegalBasis}
                                            onChange={(val) => editActivityForm.setValue('legalBasis', (Array.isArray(val) ? val[0] : val) as ProcessingActivityFormData['legalBasis'])}
                                            options={['Consentement', 'Contrat', 'Obligation Légale', 'Intérêt Légitime', 'Sauvegarde Intérêts', 'Mission Publique'].map(c => ({ value: c, label: c }))}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="status" className="block text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-2">{t('privacy.fields.status', { defaultValue: 'Statut' })}</label>
                                        <CustomSelect
                                            id="status"
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
                            <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
                                <PrivacyDetails
                                    activity={selectedActivity}
                                    isEditing={isEditing}
                                    form={editActivityForm}
                                    usersList={usersList}
                                />
                            </div>
                        )}
                    </div>
                )}

                {inspectorTab === 'data' && (
                    <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
                        <PrivacyData
                            activity={selectedActivity}
                            isEditing={isEditing}
                            form={editActivityForm}
                            onStartDPIA={() => handleStartDPIA(selectedActivity)}
                            onViewDPIA={() => handleViewDPIA(selectedActivity)}
                        />
                    </div>
                )}

                {inspectorTab === 'links' && (
                    <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
                        <PrivacyLinks
                            activity={selectedActivity}
                            isEditing={isEditing}
                            form={editActivityForm}
                            assetsList={assetsList}
                            risksList={risksList}
                        />
                    </div>
                )}

                {inspectorTab === 'history' && (
                    <div className="relative border-l-2 border-border/40 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                        {activityHistory.map((log, i) => (
                            <div key={`${log.timestamp || 'unknown'}-${i}`} className="relative">
                                <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-2 border-brand-200 dark:border-brand-800">
                                    <div className="h-2 w-2 rounded-full bg-brand-600"></div>
                                </span>
                                <div>
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                    <p className="text-xs text-slate-600 dark:text-muted-foreground mt-1">{log.details}</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-300 mt-1">Par: {log.userEmail}</p>
                                </div>
                            </div>
                        ))}
                        {activityHistory.length === 0 && (
                            <div className="text-center py-4 text-slate-500 dark:text-slate-300 text-sm">{t('privacy.history.empty', { defaultValue: 'Aucun historique disponible.' })}</div>
                        )}
                    </div>
                )}

                {inspectorTab === 'comments' && (
                    <div className="h-full">
                        <DiscussionPanel
                            collectionName="processing_activities"
                            documentId={selectedActivity.id}
                            title={`Discussion - ${selectedActivity.name}`}
                            enableSearch={true}
                            enableFilters={true}
                            enableExport={true}
                            enableNotifications={true}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
