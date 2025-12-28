import React, { useState } from 'react';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Incident, UserProfile, BusinessProcess, Asset, Risk, Criticality } from '../../types';
import { Siren, BookOpen, CalendarDays, BrainCircuit, Activity, Server, AlertTriangle } from '../ui/Icons';
import { IncidentForm } from './IncidentForm';
import { IncidentFormData } from '../../schemas/incidentSchema';
import { SafeHTML } from '../ui/SafeHTML';
import { Badge } from '../ui/Badge';
import { ThreatIntelChecker } from './ThreatIntelChecker';
import { IncidentTimeline } from './IncidentTimeline';
import { IncidentPlaybook } from './IncidentPlaybook';
import { IncidentAIAssistant } from './IncidentAIAssistant';
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
                        <button
                            onClick={() => setIsEditing(true)}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                            Modifier
                        </button>
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
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-8">
                                    {/* Description */}
                                    <div className="glass-panel p-6 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                        <div className="relative z-10">
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                                <BookOpen className="h-5 w-5 text-brand-500" />
                                                Description
                                            </h3>
                                            {incident.description ? (
                                                <SafeHTML content={incident.description} />
                                            ) : (
                                                <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                    Aucune description.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Badges & Status */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-4 glass-panel rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                            <div className="relative z-10">
                                                <span className="text-xs text-slate-500 block mb-1">Sévérité</span>
                                                <Badge
                                                    status={incident.severity === Criticality.CRITICAL ? 'error' : incident.severity === Criticality.HIGH ? 'warning' : 'info'}
                                                    variant="soft"
                                                >
                                                    {incident.severity}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="p-4 glass-panel rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                            <div className="relative z-10">
                                                <span className="text-xs text-slate-500 block mb-1">Statut</span>
                                                <Badge status={incident.status === 'Résolu' ? 'success' : 'info'} variant="outline">
                                                    {incident.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="p-4 glass-panel rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                            <div className="relative z-10">
                                                <span className="text-xs text-slate-500 block mb-1">Impact Financier</span>
                                                <span className="font-bold text-slate-900 dark:text-white">{incident.financialImpact ? `${incident.financialImpact} €` : '-'}</span>
                                            </div>
                                        </div>
                                        <div className="p-4 glass-panel rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                            <div className="relative z-10">
                                                <span className="text-xs text-slate-500 block mb-1">Reporter</span>
                                                <span className="font-bold text-slate-900 dark:text-white">{incident.reporter}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Impact & Assets */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="glass-panel p-6 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                            <div className="relative z-10">
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                                                    <Server className="h-4 w-4" />
                                                    Actif Impacté
                                                </h3>
                                                {incident.affectedAssetId ? (
                                                    <div className="space-y-2">
                                                        {(() => {
                                                            const asset = assets.find(a => a.id === incident.affectedAssetId);
                                                            return asset ? (
                                                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5">
                                                                    <span className="font-medium text-slate-700 dark:text-slate-200">{asset.name}</span>
                                                                    <Badge status="neutral" size="sm">{asset.type}</Badge>
                                                                </div>
                                                            ) : <p className="text-sm text-slate-600 italic">Actif introuvable</p>;
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-600 italic">Aucun actif lié</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="glass-panel p-6 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                            <div className="relative z-10">
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                                                    <Activity className="h-4 w-4" />
                                                    Service Impacté
                                                </h3>
                                                {incident.affectedProcessId ? (
                                                    <div className="space-y-2">
                                                        {(() => {
                                                            const proc = processes.find(p => p.id === incident.affectedProcessId);
                                                            return proc ? (
                                                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5">
                                                                    <span className="font-medium text-slate-700 dark:text-slate-200">{proc.name}</span>
                                                                </div>
                                                            ) : <p className="text-sm text-slate-600 italic">Processus introuvable</p>;
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-600 italic">Aucun service lié</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="glass-panel p-6 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden md:col-span-2">
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                            <div className="relative z-10">
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    Risque Lié
                                                </h3>
                                                {incident.relatedRiskId ? (
                                                    <div className="space-y-2">
                                                        {(() => {
                                                            const risk = risks.find(r => r.id === incident.relatedRiskId);
                                                            return risk ? (
                                                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium text-slate-700 dark:text-slate-200">{risk.threat}</span>
                                                                        <span className="text-xs text-slate-500">{risk.scenario}</span>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="block text-xs font-bold uppercase text-slate-500">Score</span>
                                                                        <span className={`font-bold ${risk.score >= 15 ? 'text-red-500' : risk.score >= 8 ? 'text-orange-500' : 'text-emerald-500'}`}>
                                                                            {risk.score}/25
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ) : <p className="text-sm text-slate-600 italic">Risque introuvable</p>;
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-600 italic">Aucun risque lié</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Meta Info */}
                                    <div className="glass-panel p-6 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm space-y-4 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                        <div className="relative z-10">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Déclaré le</label>
                                                <p className="font-medium text-slate-900 dark:text-white mt-1">
                                                    {new Date(incident.dateReported).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="mt-4">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Déclaré par</label>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="h-6 w-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
                                                        {incident.reporter.charAt(0)}
                                                    </div>
                                                    <span className="font-medium text-slate-900 dark:text-white">{incident.reporter}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Threat Intel Check */}
                                    <ThreatIntelChecker />
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'playbook' && (
                        <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                            <IncidentPlaybook incident={incident} />
                        </div>
                    )}
                    {activeTab === 'timeline' && (
                        <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
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

