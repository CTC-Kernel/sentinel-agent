import React from 'react';
import { CheckCircle2, Circle, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../store';

interface Step {
    id: string;
    label: string;
    path: string;
    isCompleted: boolean;
}

export const GettingStartedWidget: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const navigate = useNavigate();
    const { user } = useStore();

    const [status, setStatus] = React.useState({
        hasTeam: false,
        hasAssets: false,
        hasRisks: false
    });

    React.useEffect(() => {
        const checkStatus = async () => {
            if (!user?.organizationId) return;
            try {
                const db = await import('../../../firebase').then(m => m.db);
                const { collection, query, where, getCountFromServer } = await import('firebase/firestore');

                const usersColl = collection(db, 'users');
                const assetsColl = collection(db, 'assets');
                const risksColl = collection(db, 'risks');

                const qUsers = query(usersColl, where('organizationId', '==', user.organizationId));
                const qAssets = query(assetsColl, where('organizationId', '==', user.organizationId));
                const qRisks = query(risksColl, where('organizationId', '==', user.organizationId));

                const [usersSnap, assetsSnap, risksSnap] = await Promise.all([
                    getCountFromServer(qUsers),
                    getCountFromServer(qAssets),
                    getCountFromServer(qRisks)
                ]);

                setStatus({
                    hasTeam: usersSnap.data().count > 1,
                    hasAssets: assetsSnap.data().count > 0,
                    hasRisks: risksSnap.data().count > 0
                });
            } catch (error) {
                console.error("Failed to check getting started status", error);
            }
        };
        checkStatus();
    }, [user?.organizationId]);

    const steps: Step[] = [
        {
            id: 'org',
            label: 'Créer votre organisation',
            path: '/settings',
            isCompleted: !!user?.organizationId
        },
        {
            id: 'team',
            label: 'Inviter votre équipe',
            path: '/team',
            isCompleted: status.hasTeam
        },
        {
            id: 'asset',
            label: 'Ajouter votre premier actif',
            path: '/assets',
            isCompleted: status.hasAssets
        },
        {
            id: 'risk',
            label: 'Identifier un risque',
            path: '/risks',
            isCompleted: status.hasRisks
        }
    ];

    const completedCount = steps.filter(s => s.isCompleted).length;
    const progress = (completedCount / steps.length) * 100;

    if (completedCount === steps.length) return null;

    return (
        <div className="mb-8 glass-panel p-6 rounded-2xl border border-brand-500/20 bg-gradient-to-r from-brand-50/50 to-background/50 dark:from-brand-900/10 dark:to-background/50 relative overflow-hidden">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
                <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground mb-2">
                        Bienvenue sur Sentinel GRC ! 🚀
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-lg">
                        Suivez ces étapes pour configurer votre espace et sécuriser votre entreprise.
                    </p>

                    <div className="space-y-3">
                        {steps.map((step) => (
                            <div
                                key={step.id}
                                onClick={() => !step.isCompleted && navigate(step.path)}
                                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${step.isCompleted
                                    ? 'opacity-60'
                                    : 'bg-background/60 hover:bg-accent cursor-pointer shadow-sm'
                                    }`}
                            >
                                {step.isCompleted ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />
                                )}
                                <span className={`font-medium ${step.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                    {step.label}
                                </span>
                                {!step.isCompleted && (
                                    <ArrowRight className="h-4 w-4 text-brand-500 ml-auto" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-full md:w-64 flex-shrink-0">
                    <div className="bg-card text-card-foreground rounded-2xl p-6 shadow-lg text-center border border-border">
                        <div className="relative w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 128 128">
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="56"
                                    stroke="currentColor"
                                    strokeWidth="12"
                                    fill="transparent"
                                    className="text-muted-foreground/20"
                                />
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="56"
                                    stroke="currentColor"
                                    strokeWidth="12"
                                    fill="transparent"
                                    strokeDasharray={351.86}
                                    strokeDashoffset={351.86 - (351.86 * progress) / 100}
                                    className="text-brand-500 transition-all duration-1000 ease-out"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-xl font-bold text-foreground">{Math.round(progress)}%</span>
                            </div>
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                            Configuration
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
