import React, { useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { InspectorLayout } from '../ui/InspectorLayout';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Incident, UserProfile, BusinessProcess, Asset, Risk } from '../../types';
import { Siren, BookOpen, CalendarDays, BrainCircuit, Trash2 } from '../ui/Icons';
import { IncidentForm } from './IncidentForm';
import { IncidentFormData } from '../../schemas/incidentSchema';
import { useStore } from '../../store';
import { Loader2 } from '../ui/Icons';

import { IncidentTimeline } from './IncidentTimeline';
import { IncidentPlaybook } from './IncidentPlaybook';
import { IncidentAIAssistant } from './IncidentAIAssistant';
import { IncidentGeneralDetails } from './inspector/IncidentGeneralDetails';
import { IncidentImpactDetails } from './inspector/IncidentImpactDetails';

interface IncidentInspectorProps {
 isOpen: boolean;
 onClose: () => void;
 incident: Incident | null;
 users: UserProfile[];
 processes: BusinessProcess[];
 assets: Asset[];
 risks: Risk[];
 canEdit: boolean;
 onUpdate: (data: IncidentFormData) => Promise<void>;
 onDelete?: (id: string) => void;
 isSubmitting?: boolean;
}

export const IncidentInspector: React.FC<IncidentInspectorProps> = ({
 isOpen,
 onClose,
 incident,
 users,
 processes,
 assets,
 risks,
 canEdit,
 onUpdate,
 onDelete,
 isSubmitting = false
}) => {
 const { t, addToast } = useStore();
 const [activeTab, setActiveTab] = useState('details');
 const [isEditing, setIsEditing] = useState(false);
 const [isFormDirty, setIsFormDirty] = useState(false);
 const [isStatusUpdating, setIsStatusUpdating] = useState(false);
 const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

 const handleStatusChange = useCallback(async (newStatus: string) => {
 if (!incident || isStatusUpdating) return;
 setIsStatusUpdating(true);
 try {
 await onUpdate({ ...incident, status: newStatus } as IncidentFormData);
 const statusGuidance: Record<string, string> = {
 'Analyse': t('incidents.statusGuidance.analysis', { defaultValue: 'Statut : Analyse. Consultez le playbook pour les prochaines étapes.' }),
 'Contenu': t('incidents.statusGuidance.contained', { defaultValue: 'Statut : Contenu. Préparez le rapport de résolution.' }),
 'Résolu': t('incidents.statusGuidance.resolved', { defaultValue: 'Statut : Résolu. Documentez les corrections apportées.' }),
 'Fermé': t('incidents.statusGuidance.closed', { defaultValue: 'Incident fermé.' }),
 };
 const message = statusGuidance[newStatus] || t('incidents.inspector.statusUpdated', { defaultValue: `Statut mis à jour : ${newStatus}`, status: newStatus });
 addToast(message, 'success');
 } finally {
 setIsStatusUpdating(false);
 }
 }, [incident, onUpdate, isStatusUpdating, addToast, t]);

 // Reset editing state and dirty state when incident changes or closes
 React.useEffect(() => {
 if (!isOpen) {
 setIsEditing(false);
 setIsFormDirty(false);
 }
 }, [isOpen]);

 if (!incident) return null;

 const handleUpdate = async (data: IncidentFormData) => {
 await onUpdate(data);
 setIsEditing(false);
 setIsFormDirty(false);
 };

 const tabs = [
 { id: 'details', label: t('incidents.inspector.details'), icon: Siren },
 { id: 'playbook', label: t('incidents.inspector.playbook'), icon: BookOpen },
 { id: 'timeline', label: t('incidents.inspector.timeline'), icon: CalendarDays },
 { id: 'ai', label: t('incidents.inspector.aiAnalysis'), icon: BrainCircuit },
 ];

 // Helper function moved inside to access t()
 const getTimeToResolveLabel = (incident: Incident) => {
 if (!incident.dateResolved || !incident.dateReported) return null;
 const start = new Date(incident.dateReported).getTime();
 const end = new Date(incident.dateResolved).getTime();
 const diff = end - start;

 const days = Math.floor(diff / (1000 * 60 * 60 * 24));
 const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

 if (days > 0) return `${days}${t('common.daysAbbreviation') || 'j'} ${hours}${t('common.hoursAbbreviation') || 'h'}`;
 return `${hours}${t('common.hoursAbbreviation') || 'h'}`;
 };

 return (<>
 <InspectorLayout
 isOpen={isOpen}
 onClose={onClose}
 title={incident.title || t('incidents.inspector.titleFallback')}
 subtitle={incident.category}
 icon={Siren}
 tabs={!isEditing ? tabs : []} // Hide tabs when editing
 activeTab={activeTab}
 onTabChange={setActiveTab}
 hasUnsavedChanges={isFormDirty}
 actions={
 <div className="flex gap-2">
  {!isEditing && canEdit && (
  <>
  {onDelete && (
  <Button
   onClick={() => setShowDeleteConfirm(true)}
   variant="ghost"
   size="icon"
   className="text-muted-foreground hover:text-destructive hover:bg-error-bg rounded-xl transition-all duration-normal ease-apple"
  >
   <Trash2 className="h-5 w-5" />
  </Button>
  )}
  <Button
  onClick={() => setIsEditing(true)}
  className="bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-all duration-normal ease-apple"
  >
  {t('common.edit')}
  </Button>
  </>
  )}
 </div>
 }
 >
 {isEditing ? (
 <div className="p-1">
  <IncidentForm
  onSubmit={handleUpdate}
  onCancel={() => setIsEditing(false)}
  initialData={incident}
  users={users}
  processes={processes}
  assets={assets}
  risks={risks}
  isLoading={isSubmitting}
  onDirtyChange={setIsFormDirty}
  />
 </div>
 ) : (
 <div className="space-y-6">
  {activeTab === 'details' && (
  <div className="space-y-6 sm:space-y-8">
  <div className="relative">
  {isStatusUpdating && (
   <div className="absolute inset-0 bg-card/50 z-decorator flex items-center justify-center rounded-xl">
   <Loader2 className="h-6 w-6 animate-spin text-primary" />
   </div>
  )}
  <IncidentGeneralDetails incident={incident} onStatusChange={canEdit ? handleStatusChange : undefined} isUpdating={isStatusUpdating} />
  </div>
  <IncidentImpactDetails
  incident={incident}
  assets={assets}
  processes={processes}
  risks={risks}
  />
  </div>
  )}
  {activeTab === 'playbook' && (
  <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-4 sm:p-6 rounded-xl border border-border/40 shadow-premium">
  <IncidentPlaybook incident={incident} />
  </div>
  )}
  {activeTab === 'timeline' && (
  <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-4 sm:p-6 rounded-xl border border-border/40 shadow-premium">
  <IncidentTimeline selectedIncident={incident} getTimeToResolve={getTimeToResolveLabel} />
  </div>
  )}
  {activeTab === 'ai' && (
  <IncidentAIAssistant incident={incident} />
  )}
 </div>
 )}
 </InspectorLayout>

 {/* Delete Confirmation Dialog */}
 {incident && onDelete && (
 <ConfirmModal
 isOpen={showDeleteConfirm}
 onClose={() => setShowDeleteConfirm(false)}
 onConfirm={() => onDelete(incident.id)}
 title={t('incidents.deleteConfirmTitle', { defaultValue: 'Supprimer cet incident' })}
 message={t('incidents.deleteConfirmMessage', { defaultValue: 'Cette action est irréversible. L\'incident et toutes ses données associées seront supprimés.' })}
 type="danger"
 confirmText={t('common.delete', { defaultValue: 'Supprimer' })}
 cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
 />
 )}
 </>
 );
};

