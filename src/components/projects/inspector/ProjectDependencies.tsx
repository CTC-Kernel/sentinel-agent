import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Risk, Control, Asset, Audit } from '../../../types';
import { Badge } from '../../ui/Badge';
import { ShieldAlert, CheckSquare, Server, ClipboardCheck, Edit } from '../../ui/Icons';

type DependencyType = 'risks' | 'controls' | 'assets' | 'audits';

interface ProjectDependenciesProps {
    type: DependencyType;
    items: (Risk | Control | Asset | Audit)[];
}

export const ProjectDependencies: React.FC<ProjectDependenciesProps> = ({ type, items }) => {
    const navigate = useNavigate();

    // Empty State Helpers
    const getEmptyState = () => {
        switch (type) {
            case 'risks':
                return { icon: ShieldAlert, text: 'Aucun risque lié à ce projet.' };
            case 'controls':
                return { icon: CheckSquare, text: 'Aucun contrôle lié à ce projet.' };
            case 'assets':
                return { icon: Server, text: 'Aucun actif lié à ce projet.' };
            case 'audits':
                return { icon: ClipboardCheck, text: 'Aucun audit lié à ce projet.' };
        }
    };

    if (items.length === 0) {
        const { icon: Icon, text } = getEmptyState();
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <Icon className="h-12 w-12 mb-2 opacity-50" />
                <p>{text}</p>
            </div>
        );
    }

    // Render Items
    const renderContent = () => {
        return (
            <div className="space-y-4">
                {items.map(item => {
                    switch (type) {
                        case 'risks': {
                            const risk = item as Risk;
                            return (
                                <LinkedRiskItem
                                    key={risk.id}
                                    risk={risk}
                                    onClick={() => navigate(`/risks?id=${risk.id}`)}
                                />
                            );
                        }

                        case 'controls': {
                            const control = item as Control;
                            return (
                                <div key={control.id} className="glass-panel p-4 rounded-xl border border-white/60 dark:border-white/10 flex justify-between items-center bg-white/40 dark:bg-white/5">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-mono text-slate-400">{control.code}</span>
                                            <h4 className="font-bold text-slate-900 dark:text-white">{control.name}</h4>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{control.description}</p>
                                    </div>
                                </div>
                            );
                        }

                        case 'assets': {
                            const asset = item as Asset;
                            return (
                                <LinkedAssetItem
                                    key={asset.id}
                                    asset={asset}
                                    onClick={() => navigate(`/assets?id=${asset.id}`)}
                                />
                            );
                        }

                        case 'audits': {
                            const audit = item as Audit;
                            return (
                                <LinkedAuditItem
                                    key={audit.id}
                                    audit={audit}
                                    onClick={() => navigate(`/audits?id=${audit.id}`)}
                                />
                            );
                        }

                        default: return null;
                    }
                })}
            </div>
        );
    };

    return renderContent();
};

/* --- Internal Components for List Items --- */

const LinkedRiskItem = React.memo(({ risk, onClick }: { risk: Risk, onClick: () => void }) => {
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    }, [onClick]);

    return (
        <div
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            className="cursor-pointer glass-panel p-4 rounded-xl border border-white/60 dark:border-white/10 flex justify-between items-center group hover:bg-white/50 dark:hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
            <div>
                <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">{risk.threat}</h4>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${risk.score >= 12 ? 'bg-red-100 text-red-600' : risk.score >= 5 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>Score: {risk.score}</span>
                    <span className="text-xs text-slate-500">{risk.category}</span>
                </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit className="h-4 w-4 text-slate-400" />
            </div>
        </div>
    );
});

const LinkedAssetItem = React.memo(({ asset, onClick }: { asset: Asset, onClick: () => void }) => {
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    }, [onClick]);

    return (
        <div
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            className="cursor-pointer glass-panel p-4 rounded-xl border border-white/60 dark:border-white/10 flex items-center gap-4 group hover:bg-white/50 dark:hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
            <div className="h-10 w-10 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                <Server className="h-5 w-5" />
            </div>
            <div>
                <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">{asset.name}</h4>
                <span className="text-xs text-slate-500">{asset.type}</span>
            </div>
        </div>
    );
});

const LinkedAuditItem = React.memo(({ audit, onClick }: { audit: Audit, onClick: () => void }) => {
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    }, [onClick]);

    return (
        <div
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            className="cursor-pointer glass-panel p-4 rounded-xl border border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">{audit.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">Ref: {audit.reference}</p>
                </div>
                <Badge status={audit.status === 'Validé' || audit.status === 'Terminé' ? 'success' : 'warning'}>{audit.status}</Badge>
            </div>
        </div>
    );
});
