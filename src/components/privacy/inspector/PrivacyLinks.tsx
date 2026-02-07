import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Asset, Risk, ProcessingActivity } from '../../../types';
import { ProcessingActivityFormData } from '../../../schemas/privacySchema';
import { Server, AlertTriangle, Plus, X } from '../../ui/Icons';
import { useStore } from '../../../store';

export interface PrivacyLinksProps {
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
 const { t } = useStore();
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
  <h3 className="font-bold text-foreground flex items-center gap-2">
  <Server className="h-5 w-5 text-primary" />
  {t('privacy.links.linkedAssets', { defaultValue: 'Actifs liés' })} ({linkedAssets.length})
  </h3>
  {isEditing && (
  <div className="relative">
  <select
  onChange={handleAssetChange}
  className="pl-3 pr-8 py-2 bg-card border border-border/40 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-primary appearance-none cursor-pointer"
  defaultValue=""
  >
  <option value="" disabled>{t('privacy.links.linkAssetPlaceholder', { defaultValue: 'Lier un actif...' })}</option>
  {availableAssets.map(asset => (
   <option key={asset.id || 'unknown'} value={asset.id}>{asset.name}</option>
  ))}
  </select>
  <Plus className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
  </div>
  )}
 </div>

 {linkedAssets.length > 0 ? (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {linkedAssets.map(asset => (
  <div key={asset.id || 'unknown'} className="group p-4 bg-card/50 border border-border/40 rounded-3xl hover:border-primary/40 transition-colors">
  <div className="flex justify-between items-start">
   <div className="flex items-center gap-3">
   <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
   <Server className="h-5 w-5" />
   </div>
   <div>
   <p className="font-medium text-foreground">{asset.name}</p>
   <p className="text-xs text-muted-foreground">{asset.type}</p>
   </div>
   </div>
   {isEditing && (
   <button
   onClick={() => handleUnlinkAsset(asset.id)}
   className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-70 transition-opacity"
   title={t('privacy.links.unlinkAsset', { defaultValue: "Délier l'actif" })}
   >
   <X className="h-4 w-4" />
   </button>
   )}
  </div>
  </div>
  ))}
  </div>
 ) : (
  <div className="bg-muted/30 rounded-3xl p-8 text-center border border-dashed border-border/40">
  <p className="text-muted-foreground text-sm">{t('privacy.links.noLinkedAssets', { defaultValue: 'Aucun actif lié à ce traitement.' })}</p>
  </div>
 )}
 </div>

 {/* Risks Section */}
 <div>
 <div className="flex justify-between items-center mb-4">
  <h3 className="font-bold text-foreground flex items-center gap-2">
  <AlertTriangle className="h-5 w-5 text-orange-500" />
  {t('privacy.links.linkedRisks', { defaultValue: 'Risques liés' })} ({linkedRisks.length})
  </h3>
  {isEditing && (
  <div className="relative">
  <select
  onChange={handleRiskChange}
  className="pl-3 pr-8 py-2 bg-card border border-border/40 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-primary appearance-none cursor-pointer"
  defaultValue=""
  >
  <option value="" disabled>{t('privacy.links.linkRiskPlaceholder', { defaultValue: 'Lier un risque...' })}</option>
  {availableRisks.map(risk => (
   <option key={risk.id || 'unknown'} value={risk.id}>{risk.threat}</option>
  ))}
  </select>
  <Plus className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
  </div>
  )}
 </div>

 {linkedRisks.length > 0 ? (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {linkedRisks.map(risk => (
  <div key={risk.id || 'unknown'} className="group p-4 bg-card/50 border border-border/40 rounded-3xl hover:border-orange-300 transition-colors">
  <div className="flex justify-between items-start">
   <div className="flex items-center gap-3">
   <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600">
   <AlertTriangle className="h-5 w-5" />
   </div>
   <div>
   <p className="font-medium text-foreground">{risk.threat}</p>
   <div className="flex gap-2 text-xs mt-1">
   <span className="px-2 py-0.5 bg-muted rounded text-muted-foreground">
    Score: {risk.residualScore}
   </span>
   </div>
   </div>
   </div>
   {isEditing && (
   <button
   onClick={() => handleUnlinkRisk(risk.id)}
   className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-70 transition-opacity"
   title={t('privacy.links.unlinkRisk', { defaultValue: 'Délier le risque' })}
   >
   <X className="h-4 w-4" />
   </button>
   )}
  </div>
  </div>
  ))}
  </div>
 ) : (
  <div className="bg-muted/30 rounded-3xl p-8 text-center border border-dashed border-border/40">
  <p className="text-muted-foreground text-sm">{t('privacy.links.noLinkedRisks', { defaultValue: 'Aucun risque identifié pour ce traitement.' })}</p>
  </div>
 )}
 </div>
 </div>
 );
};
