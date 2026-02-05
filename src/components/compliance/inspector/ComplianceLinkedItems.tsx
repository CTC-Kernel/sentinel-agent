import React from 'react';
import { Control, Asset, Supplier, Risk, Project, Finding } from '../../../types';
import { Button } from '../../ui/button';
import { CustomSelect } from '../../ui/CustomSelect';
import { FolderKanban, ShieldAlert, AlertOctagon, X } from '../../ui/Icons';
import { useLocale } from '@/hooks/useLocale';

interface ComplianceLinkedItemsProps {
 control: Control;
 canEdit: boolean;
 assets: Asset[];
 suppliers: Supplier[];
 projects: Project[];
 risks: Risk[];
 findings: Finding[];
 handlers: {
 updating: boolean;
 handleLinkAsset: (c: Control, aid: string) => Promise<void>;
 handleUnlinkAsset: (c: Control, aid: string) => Promise<void>;
 handleLinkSupplier: (c: Control, sid: string) => Promise<void>;
 handleUnlinkSupplier: (c: Control, sid: string) => Promise<void>;
 handleLinkProject: (c: Control, pid: string) => Promise<void>;
 handleUnlinkProject: (c: Control, pid: string) => Promise<void>;
 };
}

export const ComplianceLinkedItems: React.FC<ComplianceLinkedItemsProps> = ({
 control,
 canEdit,
 assets,
 suppliers,
 projects,
 risks,
 findings,
 handlers
}) => {
 const { t } = useLocale();
 const { updating, handleLinkAsset, handleUnlinkAsset, handleLinkSupplier, handleUnlinkSupplier, handleLinkProject, handleUnlinkProject } = handlers;

 // Safely access arrays with null protection
 const safeAssets = assets ?? [];
 const safeSuppliers = suppliers ?? [];
 const safeProjects = projects ?? [];
 const safeRisks = risks ?? [];
 const safeFindings = findings ?? [];

 const riskCount = safeRisks.filter(r => r.mitigationControlIds?.includes(control.id)).length;
 const findingsCount = safeFindings.filter(f => f.relatedControlId === control.id && f.status === 'Ouvert').length;

 return (
 <div className="space-y-6 max-w-3xl mx-auto">
 {/* Use 2 columns grid */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
 {/* Assets */}
 <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm">
  <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 tracking-widest">{t('compliance.linkedAssets', { defaultValue: 'Actifs Liés' })}</h3>
  <div className="space-y-2 mb-4">
  {(Array.isArray(control.relatedAssetIds) ? control.relatedAssetIds : []).map(assetId => {
  const asset = safeAssets.find(a => a.id === assetId);
  return asset ? (
  <div key={assetId || 'unknown'} className="flex items-center justify-between p-2 bg-white/40 dark:bg-white/5 rounded-lg text-sm border border-border/40 shadow-sm">
   <span className="truncate flex-1 font-medium text-foreground">{asset.name}</span>
   {canEdit && <Button variant="ghost" size="icon" aria-label={t('compliance.unlinkAsset', { defaultValue: 'Délier l\'actif' })} onClick={() => handleUnlinkAsset(control, assetId)} disabled={updating} className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20"><X className="h-3.5 w-3.5" /></Button>}
  </div>
  ) : null;
  })}
  {(!control.relatedAssetIds || control.relatedAssetIds.length === 0) && <p className="text-xs text-muted-foreground italic">{t('compliance.noLinkedAssets', { defaultValue: 'Aucun actif lié.' })}</p>}
  </div>
  {canEdit && (
  <CustomSelect
  label=""
  value=""
  onChange={(val) => handleLinkAsset(control, val as string)}
  options={safeAssets.filter(a => !(Array.isArray(control.relatedAssetIds) ? control.relatedAssetIds : []).includes(a.id)).map(a => ({ value: a.id, label: a.name }))}
  placeholder={t('compliance.linkAssetPlaceholder', { defaultValue: 'Lier un actif...' })}
  disabled={updating}
  />
  )}
 </div>

 {/* Suppliers */}
 <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm">
  <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 tracking-widest">{t('compliance.linkedSuppliers', { defaultValue: 'Fournisseurs Liés' })}</h3>
  <div className="space-y-2 mb-4">
  {(Array.isArray(control.relatedSupplierIds) ? control.relatedSupplierIds : []).map(supplierId => {
  const supplier = safeSuppliers.find(s => s.id === supplierId);
  return supplier ? (
  <div key={supplierId || 'unknown'} className="flex items-center justify-between p-2 bg-white/40 dark:bg-white/5 rounded-lg text-sm border border-border/40 shadow-sm">
   <span className="truncate flex-1 font-medium text-foreground">{supplier.name}</span>
   {canEdit && <Button variant="ghost" size="icon" aria-label={t('compliance.unlinkSupplier', { defaultValue: 'Délier le fournisseur' })} onClick={() => handleUnlinkSupplier(control, supplierId)} disabled={updating} className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20"><X className="h-3.5 w-3.5" /></Button>}
  </div>
  ) : null;
  })}
  {(!control.relatedSupplierIds || control.relatedSupplierIds.length === 0) && <p className="text-xs text-muted-foreground italic">{t('compliance.noLinkedSuppliers', { defaultValue: 'Aucun fournisseur lié.' })}</p>}
  </div>
  {canEdit && (
  <CustomSelect
  label=""
  value=""
  onChange={(val) => handleLinkSupplier(control, val as string)}
  options={safeSuppliers.filter(s => !(Array.isArray(control.relatedSupplierIds) ? control.relatedSupplierIds : []).includes(s.id)).map(s => ({ value: s.id, label: s.name }))}
  placeholder={t('compliance.linkSupplierPlaceholder', { defaultValue: 'Lier un fournisseur...' })}
  disabled={updating}
  />
  )}
 </div>
 </div>

 {/* Projects (Full Width) */}
 <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm">
 <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 tracking-widest">{t('compliance.linkedProjects', { defaultValue: 'Projets Liés' })}</h3>
 <div className="space-y-2 mb-4">
  {(Array.isArray(control.relatedProjectIds) ? control.relatedProjectIds : []).map(pid => {
  const project = safeProjects.find(p => p.id === pid);
  return project ? (
  <div key={pid || 'unknown'} className="flex items-center justify-between p-3 bg-white/40 dark:bg-white/5 rounded-lg text-sm border border-border/40 shadow-sm">
  <div className="flex items-center gap-3">
   <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
   <FolderKanban className="h-4 w-4" />
   </div>
   <div>
   <span className="block font-medium text-foreground">{project.name}</span>
   <span className="text-xs text-muted-foreground">{project.status}</span>
   </div>
  </div>
  {canEdit && <Button variant="ghost" size="icon" aria-label={t('compliance.unlinkProject', { defaultValue: 'Délier le projet' })} onClick={() => handleUnlinkProject(control, pid)} disabled={updating} className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20"><X className="h-3.5 w-3.5" /></Button>}
  </div>
  ) : null;
  })}
  {(!control.relatedProjectIds || control.relatedProjectIds.length === 0) && <p className="text-xs text-muted-foreground italic">{t('compliance.noLinkedProjects', { defaultValue: 'Aucun projet lié.' })}</p>}
 </div>
 {canEdit && (
  <CustomSelect
  label=""
  value=""
  onChange={(val) => handleLinkProject(control, val as string)}
  options={safeProjects.filter(p => !(Array.isArray(control.relatedProjectIds) ? control.relatedProjectIds : []).includes(p.id)).map(p => ({ value: p.id, label: p.name }))}
  placeholder={t('compliance.linkProjectPlaceholder', { defaultValue: 'Lier un projet...' })}
  disabled={updating}
  />
 )}
 </div>

 {/* Risks & Findings Display (Read Only) */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
 <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 bg-red-50/30 dark:bg-red-50 dark:bg-red-900">
  <div className="flex items-center gap-3 mb-4">
  <ShieldAlert className="h-5 w-5 text-red-500" />
  <h3 className="text-sm font-bold text-foreground">{t('compliance.risks', { defaultValue: 'Risques' })} ({riskCount})</h3>
  </div>
  <div className="space-y-2">
  {safeRisks.filter(r => r.mitigationControlIds?.includes(control.id)).map(risk => (
  <div key={risk.id || 'unknown'} className="p-2 bg-white/60 dark:bg-black/20 rounded-lg text-xs border border-red-100 dark:border-red-900/30">
  <div className="font-bold truncate">{risk.threat}</div>
  <div className="text-muted-foreground">{t('compliance.grossRisk', { defaultValue: 'Risque brut' })}: {risk.score}</div>
  </div>
  ))}
  {riskCount === 0 && <p className="text-xs text-muted-foreground">{t('compliance.noRisksMitigated', { defaultValue: 'Aucun risque atténué par ce contrôle.' })}</p>}
  </div>
 </div>
 <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 bg-yellow-50/30 dark:bg-yellow-900/10">
  <div className="flex items-center gap-3 mb-4">
  <AlertOctagon className="h-5 w-5 text-yellow-500" />
  <h3 className="text-sm font-bold text-foreground">{t('compliance.nonConformities', { defaultValue: 'Non-conformités' })} ({findingsCount})</h3>
  </div>
  <div className="space-y-2">
  {safeFindings.filter(f => f.relatedControlId === control.id && f.status === 'Ouvert').map(finding => (
  <div key={finding.id || 'unknown'} className="p-2 bg-white/60 dark:bg-black/20 rounded-lg text-xs border border-yellow-100 dark:border-yellow-900/30">
  <div className="font-bold truncate">{finding.description}</div>
  <div className="text-muted-foreground">{t('compliance.type', { defaultValue: 'Type' })}: {finding.type}</div>
  </div>
  ))}
  {findingsCount === 0 && <p className="text-xs text-muted-foreground">{t('compliance.noOpenNonConformities', { defaultValue: 'Aucune non-conformité ouverte.' })}</p>}
  </div>
 </div>
 </div>

 </div>
 );
};
