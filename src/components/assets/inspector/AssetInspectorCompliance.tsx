import { useTranslation } from 'react-i18next';
import { Shield, HeartPulse } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import { CONTROL_STATUS } from '../../../constants/complianceConfig';
import type { Asset, BusinessProcess, Control } from '../../../types';

interface AssetInspectorComplianceProps {
    selectedAsset: Asset;
    linkedControls: Control[];
    processes: BusinessProcess[];
}

export const AssetInspectorCompliance: React.FC<AssetInspectorComplianceProps> = ({
    selectedAsset,
    linkedControls,
    processes
}) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-6 sm:space-y-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-4 flex items-center">
                <Shield className="h-4 w-4 mr-2" /> {t('common.inspector.compliance.securityControls')} ({linkedControls.length})
            </h3>
            {linkedControls.length === 0 ? (
                <EmptyState
                    compact
                    icon={Shield}
                    title={t('common.inspector.compliance.noControls')}
                    description={t('common.inspector.compliance.noControlsDesc')}
                />
            ) : (
                <div className="grid gap-4">
                    {linkedControls.map(ctrl => (
                        <div key={ctrl.id || 'unknown'} className="p-5 glass-premium rounded-3xl border border-border/40 shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {ctrl.code}
                                </span>
                                <span className={`text-[11px] uppercase font-bold px-2.5 py-1 rounded-3xl ${ctrl.status === CONTROL_STATUS.IMPLEMENTED ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20' : ctrl.status === CONTROL_STATUS.PARTIAL ? 'bg-amber-100 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20' : 'bg-red-100 text-red-700 dark:text-red-400 ring-1 ring-red-500/20'}`}>
                                    {t(`common.status.${ctrl.status === CONTROL_STATUS.IMPLEMENTED ? 'implemented' : ctrl.status === CONTROL_STATUS.PARTIAL ? 'partial' : 'notSupported'}`)}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-muted-foreground mb-2">{ctrl.name}</p>
                            <div className="text-[11px] text-muted-foreground">{t('common.type')}: {ctrl.type || t('common.undefined')}</div>
                        </div>
                    ))}
                </div>
            )}
            <p className="text-xs text-muted-foreground text-center mt-4">{t('common.inspector.compliance.managedInModule')}</p>

            {/* Supported Processes */}
            <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-4 flex items-center">
                    <HeartPulse className="h-4 w-4 mr-2" /> {t('common.inspector.compliance.supportedProcesses')}
                </h3>
                {(() => {
                    const supported = processes.filter(p => p.supportingAssetIds?.includes(selectedAsset.id));
                    return supported.length > 0 ? (
                        <div className="space-y-2">
                            {supported.map(p => (
                                <div key={p.id || 'unknown'} className="p-3 bg-slate-50 dark:bg-white/5 rounded-3xl border border-border/40 dark:border-white/5 flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-700 dark:text-white">{p.name}</span>
                                    <span className={`text-[11px] px-2 py-0.5 rounded-3xl font-bold ${p.priority === 'Critique' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{p.priority}</span>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-sm text-slate-500 dark:text-slate-300 italic">{t('common.inspector.compliance.noProcesses')}</p>;
                })()}
            </div>
        </div>
    );
};
