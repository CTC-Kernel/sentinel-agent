import React from 'react';
import { createPortal } from 'react-dom';
import { X, Rocket, Check, ChevronRight, Info } from '../../ui/Icons';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../store';
import { ErrorLogger } from '../../../services/errorLogger';

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
    // State is now managed by parent, but we keep local expansion state for UI toggle
    const [isExpanded, setIsExpanded] = React.useState(true);

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
                    ErrorLogger.warn('Permission denied for getting started status', 'GettingStartedWidget', { metadata: { error } });
                    sessionStorage.setItem(blockedKey, '1');
                    return;
                }
                ErrorLogger.warn('Failed to check getting started status', 'GettingStartedWidget', { metadata: { error } });
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
            path: '/settings',
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
            id: 'control',
            label: t('dashboard.stepControl'),
            path: '/compliance',
            isCompleted: status.hasControls
        },
        {
            id: 'policy',
            label: t('dashboard.stepPolicy'),
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

    // Parent handles visibility based on completedCount and closed state
    if (completedCount === steps.length) return null;

    const handleToggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    const handleClose = () => {
        onClose();
    };

    return createPortal(
        <div className="fixed bottom-0 left-6 lg:left-[284px] z-[9999] bg-gradient-to-r from-brand-50 to-brand-100 dark:bg-slate-950/95 dark:from-transparent dark:to-transparent backdrop-blur-xl p-6 rounded-t-2xl rounded-b-none border border-brand-200 dark:border-brand-600 border-b-0 shadow-[0_-10px_40px_-15px_rgba(59,130,246,0.15)] w-[320px] max-w-[calc(100vw-48px)] animate-slide-up">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 shadow-lg border border-slate-200/50 dark:border-slate-700/50">
                        <Rocket className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">{t('dashboard.gettingStarted')}</h3>
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">{t('dashboard.setupProgress')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleToggleExpand}
                        aria-label={isExpanded ? 'Réduire le guide de démarrage' : 'Développer le guide de démarrage'}
                        aria-expanded={isExpanded}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-200 text-muted-foreground hover:text-slate-600 dark:text-slate-300 dark:hover:text-slate-300"
                    >
                        <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    <button
                        onClick={handleClose}
                        aria-label="Fermer le guide de démarrage"
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-200 text-muted-foreground hover:text-slate-600 dark:text-slate-300 dark:hover:text-slate-300"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className={`space-y-1 transition-all duration-300 ${isExpanded ? 'opacity-70 max-h-96' : 'opacity-60 max-h-12 overflow-hidden'}`}>
                {steps.map((step) => (
                    <div
                        key={step.id}
                        role={step.isCompleted ? undefined : 'button'}
                        tabIndex={step.isCompleted ? undefined : 0}
                        onClick={() => {
                            if (!step.isCompleted) navigate(step.path);
                        }}
                        onKeyDown={(e) => {
                            if (!step.isCompleted && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                navigate(step.path);
                            }
                        }}
                        aria-label={step.isCompleted ? `${step.label} - Terminé` : `${step.label} - Cliquez pour compléter`}
                        className={`flex items-center justify-between p-3 rounded-xl text-sm transition-all duration-200 border ${step.isCompleted
                            ? 'bg-success/5 text-success-text dark:text-success cursor-default border-success-border/30 dark:border-success/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-slate-600 dark:text-slate-300 border-slate-200/30 dark:border-slate-700/30 hover:border-slate-300/50 dark:hover:border-slate-600/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${step.isCompleted
                                ? 'bg-success border-success text-white'
                                : 'border-slate-300 dark:border-slate-600'
                                }`}>
                                {step.isCompleted ? <Check className="h-3 w-3" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />}
                            </div>
                            <span className={step.isCompleted ? 'font-medium' : ''}>
                                {step.label}
                            </span>
                        </div>
                        {step.isCompleted ? (
                            <span className="text-[11px] font-bold uppercase tracking-wider bg-success-bg dark:bg-success/20 px-2 py-1 rounded-full text-success-text dark:text-success shadow-sm">
                                {t('common.done')}
                            </span>
                        ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Info className="h-3.5 w-3.5" />
                    <span>{t('dashboard.gettingStartedTip')}</span>
                </div>
            </div>
        </div>,
        document.body
    );
};
