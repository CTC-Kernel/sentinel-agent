import { useState } from 'react';
import { PrivacyRequest } from '../../types/privacy';
import { InspectorLayout } from '../ui/InspectorLayout';
import { User, Mail, Calendar, Flag, AlertTriangle } from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PrivacyService } from '../../services/PrivacyService';
import { useStore } from '../../store';
import { UserProfile } from '../../types';
import { toast } from '@/lib/toast';
import React from 'react';

interface PrivacyRequestInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    request: PrivacyRequest | null;
    onRequestUpdated?: (updatedRequest: PrivacyRequest) => void;
}

export const PrivacyRequestInspector: React.FC<PrivacyRequestInspectorProps> = ({
    isOpen,
    onClose,
    request,
    onRequestUpdated
}) => {
    const { user, t } = useStore();
    const [isAdvancing, setIsAdvancing] = useState(false);
    const [isHolding, setIsHolding] = useState(false);

    if (!request) return null;

    const WORKFLOW_STEPS = ['New', 'Verifying', 'Processing', 'Review', 'Completed'] as const;

    const handleAdvanceStep = async () => {
        if (!request?.id || !user) return;
        const currentIdx = WORKFLOW_STEPS.indexOf(request.status as typeof WORKFLOW_STEPS[number]);
        if (currentIdx < 0 || currentIdx >= WORKFLOW_STEPS.length - 1) return;

        const nextStatus = WORKFLOW_STEPS[currentIdx + 1];
        setIsAdvancing(true);
        try {
            await PrivacyService.updateRequest(request.id, { status: nextStatus }, user as UserProfile);
            toast.success(t('privacy.request.statusUpdated', { defaultValue: `Statut mis à jour : ${nextStatus}`, status: nextStatus }));
            onRequestUpdated?.({ ...request, status: nextStatus });
        } catch {
            toast.error(t('privacy.request.statusUpdateError', { defaultValue: 'Erreur lors de la mise à jour du statut' }));
        } finally {
            setIsAdvancing(false);
        }
    };

    const handlePutOnHold = async () => {
        if (!request?.id || !user) return;
        setIsHolding(true);
        try {
            await PrivacyService.updateRequest(request.id, { status: 'On Hold' }, user as UserProfile);
            toast.success(t('privacy.request.putOnHold', { defaultValue: 'Demande mise en attente' }));
            onRequestUpdated?.({ ...request, status: 'On Hold' });
        } catch {
            toast.error(t('privacy.request.holdError', { defaultValue: 'Erreur lors de la mise en attente' }));
        } finally {
            setIsHolding(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'New': return 'info';
            case 'Processing': return 'brand';
            case 'Completed': return 'success';
            case 'Rejected': return 'error';
            default: return 'neutral';
        }
    };

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={t('privacy.request.title', { defaultValue: `Demande ${request.id}`, id: request.id })}
            subtitle={t('privacy.request.subtitle', { defaultValue: 'Exercice de droits (GDPR Art. 15-22)' })}
            statusBadge={<Badge status={getStatusColor(request.status) as 'info' | 'brand' | 'success' | 'error' | 'neutral'}>{request.status}</Badge>}
            icon={User}
        >
            <div className="p-6 md:p-8 space-y-8 bg-slate-50/50 dark:bg-transparent min-h-full">
                {/* Summary Card */}
                <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/20 dark:bg-brand-400/15 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 relative z-10">
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-4">{t('privacy.request.requester', { defaultValue: 'Demandeur' })}</h4>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-600 dark:text-muted-foreground">
                                    {request.dataSubject.charAt(0)}
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-slate-900 dark:text-white">{request.dataSubject}</div>
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <Mail className="h-3 w-3" /> {request.email}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-4">{t('privacy.request.details', { defaultValue: 'Détails de la demande' })}</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/30 backdrop-blur-sm rounded-3xl border border-border/40 dark:border-border/40">
                                    <span className="text-sm font-medium text-slate-600 dark:text-muted-foreground">{t('privacy.request.type', { defaultValue: 'Type' })}</span>
                                    <span className="font-bold text-brand-600 dark:text-brand-400">{request.requestType}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/30 backdrop-blur-sm rounded-3xl border border-border/40 dark:border-border/40">
                                    <span className="text-sm font-medium text-slate-600 dark:text-muted-foreground">{t('privacy.request.priority', { defaultValue: 'Priorité' })}</span>
                                    <Badge status={request.priority === 'High' ? 'error' : 'warning'} size="sm">{request.priority}</Badge>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dates & SLA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="p-6 bg-blue-50/80 dark:bg-blue-900/30 dark:bg-blue-900 rounded-4xl border border-blue-100 dark:border-blue-900/30 shadow-sm flex items-center justify-between">
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300 mb-1">{t('privacy.request.receivedOn', { defaultValue: 'Reçu le' })}</h4>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">{format(new Date(request.submissionDate), 'dd MMMM yyyy', { locale: fr })}</div>
                        </div>
                        <Calendar className="h-8 w-8 text-blue-500/50" />
                    </div>
                    <div className={`p-6 rounded-4xl border shadow-sm flex items-center justify-between ${new Date(request.dueDate) < new Date() ? 'bg-red-50/80 dark:bg-red-50 dark:bg-red-900 border-red-100 dark:border-red-900/30' : 'bg-green-50/80 dark:bg-green-50 dark:bg-green-900 border-green-100 dark:border-green-900/30'
                        }`}>
                        <div>
                            <h4 className={`text-xs font-bold uppercase tracking-widest mb-1 ${new Date(request.dueDate) < new Date() ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>{t('privacy.request.dueDate', { defaultValue: 'Date Limite (30j)' })}</h4>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">{format(new Date(request.dueDate), 'dd MMMM yyyy', { locale: fr })}</div>
                        </div>
                        <Flag className={`h-8 w-8 ${new Date(request.dueDate) < new Date() ? 'text-red-500/50' : 'text-green-500/50'}`} />
                    </div>
                </div>

                {/* Workflow Actions */}
                <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-6">{t('privacy.request.workflow', { defaultValue: 'Workflow de Traitement' })}</h4>

                    <div className="relative pl-8 border-l-2 border-border/40 dark:border-slate-700 space-y-6 sm:space-y-8">
                        {['New', 'Verifying', 'Processing', 'Review', 'Completed'].map((step) => {
                            const steps = ['New', 'Verifying', 'Processing', 'Review', 'Completed'];
                            const currentIdx = steps.indexOf(request.status);
                            const stepIdx = steps.indexOf(step);
                            const isCompleted = stepIdx <= currentIdx;
                            const isCurrent = stepIdx === currentIdx;

                            return (
                                <div key={step || 'unknown'} className="relative">
                                    <div className={`absolute -left-[41px] top-0 h-5 w-5 rounded-full border-2 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm ${isCompleted ? 'border-brand-500 text-brand-500' : 'border-border/40 dark:border-slate-600 text-transparent'
                                        }`}>
                                        <div className={`h-2.5 w-2.5 rounded-full ${isCompleted ? 'bg-brand-500' : 'bg-slate-300'}`}></div>
                                    </div>
                                    <h5 className={`text-sm font-bold ${isCompleted ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                                        {step === 'New' && t('privacy.request.steps.new', { defaultValue: 'Réception & Enregistrement' })}
                                        {step === 'Verifying' && t('privacy.request.steps.verifying', { defaultValue: "Vérification d'Identité" })}
                                        {step === 'Processing' && t('privacy.request.steps.processing', { defaultValue: 'Collecte des Données' })}
                                        {step === 'Review' && t('privacy.request.steps.review', { defaultValue: 'Revue Légale & Validation' })}
                                        {step === 'Completed' && t('privacy.request.steps.completed', { defaultValue: 'Réponse Envoyée' })}
                                    </h5>
                                    {isCurrent && (
                                        <div className="mt-4 flex gap-3">
                                            <button
                                                onClick={handleAdvanceStep}
                                                disabled={isAdvancing || step === 'Completed'}
                                                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-3xl text-sm font-bold transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isAdvancing ? t('privacy.request.updating', { defaultValue: 'Mise à jour...' }) : t('privacy.request.validateStep', { defaultValue: "Valider l'étape" })}
                                            </button>
                                            <button
                                                onClick={handlePutOnHold}
                                                disabled={isHolding}
                                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-3xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isHolding ? t('privacy.request.updating', { defaultValue: 'Mise à jour...' }) : t('privacy.request.putOnHoldBtn', { defaultValue: 'Mettre en attente' })}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Validation Info */}
                <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 rounded-3xl flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                    <div>
                        <h5 className="text-sm font-bold text-orange-800 dark:text-orange-200">{t('privacy.request.identityVerificationTitle', { defaultValue: "Vérification d'Identité Requise" })}</h5>
                        <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                            {t('privacy.request.identityVerificationDesc', { defaultValue: "Avant de fournir toute donnée personnelle, assurez-vous de l'identité du demandeur (CNI, Passeport). Ne jamais envoyer de données sensibles par email non sécurisé." })}
                        </p>
                    </div>
                </div>
            </div>
        </InspectorLayout>
    );
};
