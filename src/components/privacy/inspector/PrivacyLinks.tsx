import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Asset, Risk, ProcessingActivity } from '../../../types';
import { ProcessingActivityFormData } from '../../../schemas/privacySchema';
import { Server, AlertTriangle, Plus, X } from 'lucide-react';

interface PrivacyLinksProps {
    activity: ProcessingActivity;
    isEditing: boolean;
    form: UseFormReturn<ProcessingActivityFormData>;
    assetsList: Asset[];
    risksList: Risk[];
}

export const PrivacyLinks: React.FC<PrivacyLinksProps> = ({
    activity,
    isEditing,
    form,
    assetsList,
    risksList
}) => {
    const { watch, setValue } = form;
    const watchedAssetIds = watch('relatedAssetIds') || [];
    const watchedRiskIds = watch('relatedRiskIds') || [];

    // Use watched values if editing, otherwise use activity values
    const currentAssetIds = isEditing ? watchedAssetIds : (activity.relatedAssetIds || []);
    const currentRiskIds = isEditing ? watchedRiskIds : (activity.relatedRiskIds || []);

    const linkedAssets = assetsList.filter(a => currentAssetIds.includes(a.id));
    const linkedRisks = risksList.filter(r => currentRiskIds.includes(r.id));

    // Determine available items for linking (exclude already linked)
    const availableAssets = assetsList.filter(a => !currentAssetIds.includes(a.id));
    const availableRisks = risksList.filter(r => !currentRiskIds.includes(r.id));

    const handleLinkAsset = (assetId: string) => {
        const newIds = [...watchedAssetIds, assetId];
        setValue('relatedAssetIds', newIds, { shouldDirty: true });
    };

    const handleUnlinkAsset = (assetId: string) => {
        const newIds = watchedAssetIds.filter(id => id !== assetId);
        setValue('relatedAssetIds', newIds, { shouldDirty: true });
    };

    const handleLinkRisk = (riskId: string) => {
        const newIds = [...watchedRiskIds, riskId];
        setValue('relatedRiskIds', newIds, { shouldDirty: true });
    };

    const handleUnlinkRisk = (riskId: string) => {
        const newIds = watchedRiskIds.filter(id => id !== riskId);
        setValue('relatedRiskIds', newIds, { shouldDirty: true });
    };

    const handleAssetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value) {
            handleLinkAsset(e.target.value);
            e.target.value = ""; // Reset select
        }
    };

    const handleRiskChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value) {
            handleLinkRisk(e.target.value);
            e.target.value = ""; // Reset select
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Assets Section */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Server className="h-5 w-5 text-brand-500" />
                        Actifs liés ({linkedAssets.length})
                    </h3>
                    {isEditing && (
                        <div className="relative">
                            <select
                                onChange={handleAssetChange}
                                className="pl-3 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 appearance-none cursor-pointer"
                                defaultValue=""
                            >
                                <option value="" disabled>Lier un actif...</option>
                                {availableAssets.map(asset => (
                                    <option key={asset.id} value={asset.id}>{asset.name}</option>
                                ))}
                            </select>
                            <Plus className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                    )}
                </div>

                {linkedAssets.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {linkedAssets.map(asset => (
                            <div key={asset.id} className="group p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-300 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
                                            <Server className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white">{asset.name}</p>
                                            <p className="text-xs text-slate-500">{asset.type}</p>
                                        </div>
                                    </div>
                                    {isEditing && (
                                        <button
                                            onClick={() => handleUnlinkAsset(asset.id)}
                                            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Délier l'actif"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-8 text-center border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-slate-500 text-sm">Aucun actif lié à ce traitement.</p>
                    </div>
                )}
            </div>

            {/* Risks Section */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Risques liés ({linkedRisks.length})
                    </h3>
                    {isEditing && (
                        <div className="relative">
                            <select
                                onChange={handleRiskChange}
                                className="pl-3 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 appearance-none cursor-pointer"
                                defaultValue=""
                            >
                                <option value="" disabled>Lier un risque...</option>
                                {availableRisks.map(risk => (
                                    <option key={risk.id} value={risk.id}>{risk.threat}</option>
                                ))}
                            </select>
                            <Plus className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                    )}
                </div>

                {linkedRisks.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {linkedRisks.map(risk => (
                            <div key={risk.id} className="group p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-orange-300 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600">
                                            <AlertTriangle className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white">{risk.threat}</p>
                                            <div className="flex gap-2 text-xs mt-1">
                                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                                                    Score: {risk.residualScore}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {isEditing && (
                                        <button
                                            onClick={() => handleUnlinkRisk(risk.id)}
                                            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Délier le risque"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-8 text-center border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-slate-500 text-sm">Aucun risque identifié pour ce traitement.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
