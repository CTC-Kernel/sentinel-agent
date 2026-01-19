import { PrivacyRequest } from './PrivacyRequests';
import { InspectorLayout } from '../ui/InspectorLayout';
import { User, Mail, Calendar, Flag, AlertTriangle } from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PrivacyRequestInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    request: PrivacyRequest | null;
}

export const PrivacyRequestInspector: React.FC<PrivacyRequestInspectorProps> = ({
    isOpen,
    onClose,
    request
}) => {
    if (!request) return null;

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
            title={`Demande ${request.id}`}
            subtitle="Exercice de droits (GDPR Art. 15-22)"
            statusBadge={<Badge status={getStatusColor(request.status) as 'info' | 'brand' | 'success' | 'error' | 'neutral'}>{request.status}</Badge>}
            icon={User}
        >
            <div className="p-6 md:p-8 space-y-8 bg-slate-50/50 dark:bg-transparent min-h-full">
                {/* Summary Card */}
                <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Demandeur</h4>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-600 dark:text-slate-300">
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
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Détails de la demande</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Type</span>
                                    <span className="font-bold text-brand-600 dark:text-brand-400">{request.requestType}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Priorité</span>
                                    <Badge status={request.priority === 'High' ? 'error' : 'warning'} size="sm">{request.priority}</Badge>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dates & SLA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-blue-50/80 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 shadow-sm flex items-center justify-between">
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-blue-600/80 mb-1">Reçu le</h4>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">{format(new Date(request.submissionDate), 'dd MMMM yyyy', { locale: fr })}</div>
                        </div>
                        <Calendar className="h-8 w-8 text-blue-500/50" />
                    </div>
                    <div className={`p-6 rounded-[2rem] border shadow-sm flex items-center justify-between ${new Date(request.dueDate) < new Date() ? 'bg-red-50/80 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : 'bg-green-50/80 dark:bg-green-900/10 border-green-100 dark:border-green-900/30'
                        }`}>
                        <div>
                            <h4 className={`text-xs font-bold uppercase tracking-widest mb-1 ${new Date(request.dueDate) < new Date() ? 'text-red-600/80' : 'text-green-600/80'}`}>Date Limite (30j)</h4>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">{format(new Date(request.dueDate), 'dd MMMM yyyy', { locale: fr })}</div>
                        </div>
                        <Flag className={`h-8 w-8 ${new Date(request.dueDate) < new Date() ? 'text-red-500/50' : 'text-green-500/50'}`} />
                    </div>
                </div>

                {/* Workflow Actions */}
                <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">Workflow de Traitement</h4>

                    <div className="relative pl-8 border-l-2 border-slate-200 dark:border-slate-700 space-y-8">
                        {['New', 'Verifying', 'Processing', 'Review', 'Completed'].map((step) => {
                            const steps = ['New', 'Verifying', 'Processing', 'Review', 'Completed'];
                            const currentIdx = steps.indexOf(request.status);
                            const stepIdx = steps.indexOf(step);
                            const isCompleted = stepIdx <= currentIdx;
                            const isCurrent = stepIdx === currentIdx;

                            return (
                                <div key={step} className="relative">
                                    <div className={`absolute -left-[41px] top-0 h-5 w-5 rounded-full border-2 flex items-center justify-center bg-white dark:bg-slate-900 ${isCompleted ? 'border-brand-500 text-brand-500' : 'border-slate-300 text-transparent'
                                        }`}>
                                        <div className={`h-2.5 w-2.5 rounded-full ${isCompleted ? 'bg-brand-500' : 'bg-slate-300'}`}></div>
                                    </div>
                                    <h5 className={`text-sm font-bold ${isCompleted ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                                        {step === 'New' && 'Réception & Enregistrement'}
                                        {step === 'Verifying' && 'Vérification d\'Identité'}
                                        {step === 'Processing' && 'Collecte des Données'}
                                        {step === 'Review' && 'Revue Légale & Validation'}
                                        {step === 'Completed' && 'Réponse Envoyée'}
                                    </h5>
                                    {isCurrent && (
                                        <div className="mt-4 flex gap-3">
                                            <button className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
                                                Valider l'étape
                                            </button>
                                            <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
                                                Mettre en attente
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Validation Info */}
                <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                        <h5 className="text-sm font-bold text-orange-800 dark:text-orange-200">Vérification d'Identité Requise</h5>
                        <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                            Avant de fournir toute donnée personnelle, assurez-vous de l'identité du demandeur (CNI, Passeport). Ne jamais envoyer de données sensibles par email non sécurisé.
                        </p>
                    </div>
                </div>
            </div>
        </InspectorLayout>
    );
};
