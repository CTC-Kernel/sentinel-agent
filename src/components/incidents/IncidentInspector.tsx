import React, { useState } from 'react';
import { Button } from '../ui/button';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Incident, UserProfile, BusinessProcess, Asset, Risk } from '../../types';
import { Siren, BookOpen, CalendarDays, BrainCircuit, Trash2 } from '../ui/Icons';
import { IncidentForm } from './IncidentForm';
import { IncidentFormData } from '../../schemas/incidentSchema';

import { IncidentTimeline } from './IncidentTimeline';
import { IncidentPlaybook } from './IncidentPlaybook';
import { IncidentAIAssistant } from './IncidentAIAssistant';
import { IncidentGeneralDetails } from './inspector/IncidentGeneralDetails';
import { IncidentImpactDetails } from './inspector/IncidentImpactDetails';
// Form validation: useForm with required fields

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
    const [activeTab, setActiveTab] = useState('details');
    const [isEditing, setIsEditing] = useState(false);

    // Reset editing state when incident changes or closes
    React.useEffect(() => {
        if (!isOpen) setIsEditing(false);
    }, [isOpen]);

    if (!incident) return null;

    const handleUpdate = async (data: IncidentFormData) => {
        await onUpdate(data);
        setIsEditing(false);
    };

    const tabs = [
        { id: 'details', label: 'Détails', icon: Siren },
        { id: 'playbook', label: 'Playbook', icon: BookOpen },
        { id: 'timeline', label: 'Timeline', icon: CalendarDays },
        { id: 'ai', label: 'Analyse IA', icon: BrainCircuit },
    ];

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={incident.title || 'Détails de l\'incident'}
            subtitle={incident.category}
            icon={Siren}
            tabs={!isEditing ? tabs : []} // Hide tabs when editing
            activeTab={activeTab}
            onTabChange={setActiveTab}
            actions={
                <div className="flex gap-2">
                    {!isEditing && canEdit && (
                        <>
                            {onDelete && (
                                <Button
                                    onClick={() => onDelete(incident.id)}
                                    variant="ghost"
                                    size="icon"
                                    className="text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </Button>
                            )}
                            <Button
                                onClick={() => setIsEditing(true)}
                                className="bg-brand-600 hover:bg-brand-700 text-white"
                            >
                                Modifier
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
                    />
                </div>
            ) : (
                <div className="space-y-6">
                    {activeTab === 'details' && (
                        <div className="space-y-6 sm:space-y-8">
                            <IncidentGeneralDetails incident={incident} />
                            <IncidentImpactDetails
                                incident={incident}
                                assets={assets}
                                processes={processes}
                                risks={risks}
                            />
                        </div>
                    )}
                    {activeTab === 'playbook' && (
                        <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-white/60 dark:border-white/10 shadow-sm">
                            <IncidentPlaybook incident={incident} />
                        </div>
                    )}
                    {activeTab === 'timeline' && (
                        <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-white/60 dark:border-white/10 shadow-sm">
                            <IncidentTimeline selectedIncident={incident} getTimeToResolve={getTimeToResolve} />
                        </div>
                    )}
                    {activeTab === 'ai' && (
                        <IncidentAIAssistant incident={incident} />
                    )}
                </div>
            )}
        </InspectorLayout>
    );
};

// Helper function
const getTimeToResolve = (incident: Incident) => {
    if (!incident.dateResolved || !incident.dateReported) return null;
    const start = new Date(incident.dateReported).getTime();
    const end = new Date(incident.dateResolved).getTime();
    const diff = end - start;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}j ${hours}h`;
    return `${hours}h`;
};

