import React from 'react';
import { CheckCircle2, Circle, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../store';

let lastStatusFetchAt = 0;
let lastStatusOrgId: string | null = null;
let lastStatusValue: { hasTeam: boolean; hasAssets: boolean; hasRisks: boolean; hasControls: boolean; hasPolicies: boolean; hasAudits: boolean } | null = null;

interface Step {
    id: string;
    label: string;
    path: string;
    isCompleted: boolean;
}

export const GettingStartedWidget: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const navigate = useNavigate();
    const { user, t } = useStore();

    const inFlightKeyRef = React.useRef(false);

    const [status, setStatus] = React.useState({
        hasTeam: false,
        hasAssets: false,
        hasRisks: false,
        hasControls: false,
        hasPolicies: false,
        hasAudits: false
    });

    React.useEffect(() => {
        let isMounted = true;
        let didCancel = false;

        const checkStatus = async () => {
            if (!user?.organizationId) return;

            const blockedKey = `agg_blocked_${user.organizationId}`;
            if (sessionStorage.getItem(blockedKey)) return;

            const now = Date.now();
            const cacheTtlMs = 60 * 1000;
            if (
                lastStatusValue &&
                lastStatusOrgId === user.organizationId &&
                now - lastStatusFetchAt < cacheTtlMs
            ) {
                setStatus(lastStatusValue);
                return;
            }

            if (inFlightKeyRef.current) return;
            inFlightKeyRef.current = true;

            try {
                const db = await import('../../../firebase').then(m => m.db);
                const { collection, query, where, getCountFromServer } = await import('firebase/firestore');

                const usersColl = collection(db, 'users');
                const assetsColl = collection(db, 'assets');
                const risksColl = collection(db, 'risks');
                const controlsColl = collection(db, 'controls');
                const docsColl = collection(db, 'documents');
                const auditsColl = collection(db, 'audits');

                const qUsers = query(usersColl, where('organizationId', '==', user.organizationId));
                const qAssets = query(assetsColl, where('organizationId', '==', user.organizationId));
                const qRisks = query(risksColl, where('organizationId', '==', user.organizationId));
                // Controls that are implemented or in progress (not "Non commencé")
                const qControls = query(controlsColl, where('organizationId', '==', user.organizationId), where('status', 'in', ['Implémenté', 'Partiel', 'En cours']));
                const qDocs = query(docsColl, where('organizationId', '==', user.organizationId));
                const qAudits = query(auditsColl, where('organizationId', '==', user.organizationId));

                const [usersSnap, assetsSnap, risksSnap, controlsSnap, docsSnap, auditsSnap] = await Promise.all([
                    getCountFromServer(qUsers),
                    getCountFromServer(qAssets),
                    getCountFromServer(qRisks),
                    getCountFromServer(qControls),
                    getCountFromServer(qDocs),
                    getCountFromServer(qAudits)
                ]);

                const next = {
                    hasTeam: usersSnap.data().count > 1,
                    hasAssets: assetsSnap.data().count > 0,
                    hasRisks: risksSnap.data().count > 0,
                    hasControls: controlsSnap.data().count > 0,
                    hasPolicies: docsSnap.data().count > 0,
                    hasAudits: auditsSnap.data().count > 0
                };

                lastStatusValue = next;
                lastStatusOrgId = user.organizationId;
                lastStatusFetchAt = now;

                if (!didCancel && isMounted) setStatus(next);
            } catch (error) {
                const code = (error as { code?: string })?.code;
                if (code === 'permission-denied') {
                    sessionStorage.setItem(blockedKey, '1');
                    return;
                }
            }
            finally {
                inFlightKeyRef.current = false;
            }
        };
        checkStatus();

        return () => {
            didCancel = true;
            isMounted = false;
        };
    }, [user?.organizationId]);

    const steps: Step[] = [
        {
            id: 'org',
            label: t('dashboard.stepOrg'),
            path: '/settings',
            isCompleted: !!user?.organizationId
        },
        {
            id: 'team',
            label: t('dashboard.stepTeam'),
            path: '/settings', // Assuming team invite is under settings/users
            isCompleted: status.hasTeam
        },
        {
            id: 'asset',
            label: t('dashboard.stepAsset'),
            path: '/assets',
            isCompleted: status.hasAssets
        },
        {
            id: 'risk',
            label: t('dashboard.stepRisk'),
            path: '/risks',
            isCompleted: status.hasRisks
        },
        {
            id: 'controls',
            label: t('dashboard.stepControls'),
            path: '/compliance',
            isCompleted: status.hasControls
        },
        {
            id: 'policies',
            label: t('dashboard.stepPolicies'),
            path: '/documents',
            isCompleted: status.hasPolicies
        },
        {
            id: 'audit',
            label: t('dashboard.stepAudit'),
            path: '/audits',
            isCompleted: status.hasAudits
        }
    ];

    const completedCount = steps.filter(s => s.isCompleted).length;
    const progress = (completedCount / steps.length) * 100;

    if (completedCount === steps.length) return null;

    return (
        <div className="mb-8 glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/10 bg-gradient-to-br from-brand-50/50 via-white/40 to-white/10 dark:from-brand-900/10 dark:via-slate-900/40 dark:to-slate-900/10 relative overflow-hidden shadow-sm hover:shadow-apple transition-all duration-500 group">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-100%] group-hover:animate-shine pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

            <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all duration-200 z-10"
                aria-label="Close"
            >
                <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center relative z-10">
                <div className="flex-1">
                    <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
                        Bienvenue sur Sentinel GRC ! 🚀
                    </h3>
                    <p className="text-muted-foreground mb-8 max-w-lg text-base leading-relaxed">
                        Suivez ces étapes pour configurer votre espace et garantir votre conformité.
                    </p>

                    <div className="space-y-3">
                        {steps.map((step) => (
                            <div
                                key={step.id}
                                onClick={() => !step.isCompleted && navigate(step.path)}
                                className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-200 border border-transparent ${step.isCompleted
                                    ? 'opacity-60 bg-transparent'
                                    : 'bg-white/40 dark:bg-black/20 hover:bg-white/60 dark:hover:bg-black/30 cursor-pointer shadow-sm hover:translate-x-1 hover:border-white/20'
                                    }`}
                            >
                                {step.isCompleted ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />
                                )}
                                <span className={`font-medium flex-1 ${step.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                    {step.label}
                                </span>
                                {!step.isCompleted && (
                                    <ArrowRight className="h-4 w-4 text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-full md:w-72 flex-shrink-0">
                    <div className="glass-panel text-card-foreground rounded-[2rem] p-8 shadow-xl text-center border border-white/20 dark:border-white/5 bg-white/30 dark:bg-black/20">
                        <div className="relative w-40 h-40 mx-auto mb-6 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 128 128">
                                <defs>
                                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#3b82f6" />
                                        <stop offset="100%" stopColor="#8b5cf6" />
                                    </linearGradient>
                                </defs>
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="58"
                                    stroke="currentColor"
                                    strokeWidth="10"
                                    fill="transparent"
                                    className="text-slate-200 dark:text-slate-800"
                                />
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="58"
                                    stroke="url(#progressGradient)"
                                    strokeWidth="10"
                                    fill="transparent"
                                    strokeDasharray={364.4}
                                    strokeDashoffset={364.4 - (364.4 * progress) / 100}
                                    className="transition-all duration-1000 ease-out"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-3xl font-black text-foreground tracking-tighter">{Math.round(progress)}%</span>
                            </div>
                        </div>
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                            Progression
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
