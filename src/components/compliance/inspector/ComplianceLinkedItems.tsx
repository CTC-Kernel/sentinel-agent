import React from 'react';
import { Control, Asset, Supplier, Risk, Project, Finding } from '../../../types';
import { Button } from '../../ui/button';
import { CustomSelect } from '../../ui/CustomSelect';
import { FolderKanban, ShieldAlert, AlertOctagon, X } from '../../ui/Icons';

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Assets */}
                <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Actifs Liés</h3>
                    <div className="space-y-2 mb-4">
                        {control.relatedAssetIds?.map(assetId => {
                            const asset = safeAssets.find(a => a.id === assetId);
                            return asset ? (
                                <div key={assetId} className="flex items-center justify-between p-2 bg-white/40 dark:bg-white/5 rounded-lg text-sm border border-white/10 shadow-sm">
                                    <span className="truncate flex-1 font-medium text-slate-700 dark:text-slate-200">{asset.name}</span>
                                    {canEdit && <Button variant="ghost" size="icon" aria-label="Délier l'actif" onClick={() => handleUnlinkAsset(control, assetId)} disabled={updating} className="h-6 w-6 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><X className="h-3.5 w-3.5" /></Button>}
                                </div>
                            ) : null;
                        })}
                        {(!control.relatedAssetIds || control.relatedAssetIds.length === 0) && <p className="text-xs text-slate-500 italic">Aucun actif lié.</p>}
                    </div>
                    {canEdit && (
                        <CustomSelect
                            label=""
                            value=""
                            onChange={(val) => handleLinkAsset(control, val as string)}
                            options={safeAssets.filter(a => !control.relatedAssetIds?.includes(a.id)).map(a => ({ value: a.id, label: a.name }))}
                            placeholder="Lier un actif..."
                            disabled={updating}
                        />
                    )}
                </div>

                {/* Suppliers */}
                <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Fournisseurs Liés</h3>
                    <div className="space-y-2 mb-4">
                        {control.relatedSupplierIds?.map(supplierId => {
                            const supplier = safeSuppliers.find(s => s.id === supplierId);
                            return supplier ? (
                                <div key={supplierId} className="flex items-center justify-between p-2 bg-white/40 dark:bg-white/5 rounded-lg text-sm border border-white/10 shadow-sm">
                                    <span className="truncate flex-1 font-medium text-slate-700 dark:text-slate-200">{supplier.name}</span>
                                    {canEdit && <Button variant="ghost" size="icon" aria-label="Délier le fournisseur" onClick={() => handleUnlinkSupplier(control, supplierId)} disabled={updating} className="h-6 w-6 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><X className="h-3.5 w-3.5" /></Button>}
                                </div>
                            ) : null;
                        })}
                        {(!control.relatedSupplierIds || control.relatedSupplierIds.length === 0) && <p className="text-xs text-slate-500 italic">Aucun fournisseur lié.</p>}
                    </div>
                    {canEdit && (
                        <CustomSelect
                            label=""
                            value=""
                            onChange={(val) => handleLinkSupplier(control, val as string)}
                            options={safeSuppliers.filter(s => !control.relatedSupplierIds?.includes(s.id)).map(s => ({ value: s.id, label: s.name }))}
                            placeholder="Lier un fournisseur..."
                            disabled={updating}
                        />
                    )}
                </div>
            </div>

            {/* Projects (Full Width) */}
            <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Projets Liés</h3>
                <div className="space-y-2 mb-4">
                    {control.relatedProjectIds?.map(pid => {
                        const project = safeProjects.find(p => p.id === pid);
                        return project ? (
                            <div key={pid} className="flex items-center justify-between p-3 bg-white/40 dark:bg-white/5 rounded-lg text-sm border border-white/10 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                        <FolderKanban className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <span className="block font-medium text-slate-900 dark:text-white">{project.name}</span>
                                        <span className="text-xs text-slate-500">{project.status}</span>
                                    </div>
                                </div>
                                {canEdit && <Button variant="ghost" size="icon" aria-label="Délier le projet" onClick={() => handleUnlinkProject(control, pid)} disabled={updating} className="h-6 w-6 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><X className="h-3.5 w-3.5" /></Button>}
                            </div>
                        ) : null;
                    })}
                    {(!control.relatedProjectIds || control.relatedProjectIds.length === 0) && <p className="text-xs text-slate-500 italic">Aucun projet lié.</p>}
                </div>
                {canEdit && (
                    <CustomSelect
                        label=""
                        value=""
                        onChange={(val) => handleLinkProject(control, val as string)}
                        options={safeProjects.filter(p => !control.relatedProjectIds?.includes(p.id)).map(p => ({ value: p.id, label: p.name }))}
                        placeholder="Lier un projet..."
                        disabled={updating}
                    />
                )}
            </div>

            {/* Risks & Findings Display (Read Only) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 bg-red-50/30 dark:bg-red-900/10">
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldAlert className="h-5 w-5 text-red-500" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Risques ({riskCount})</h3>
                    </div>
                    <div className="space-y-2">
                        {safeRisks.filter(r => r.mitigationControlIds?.includes(control.id)).map(risk => (
                            <div key={risk.id} className="p-2 bg-white/60 dark:bg-black/20 rounded-lg text-xs border border-red-100 dark:border-red-900/30">
                                <div className="font-bold truncate">{risk.threat}</div>
                                <div className="text-slate-500">Risque brut: {risk.score}</div>
                            </div>
                        ))}
                        {riskCount === 0 && <p className="text-xs text-slate-500">Aucun risque atténué par ce contrôle.</p>}
                    </div>
                </div>
                <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 bg-orange-50/30 dark:bg-orange-900/10">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertOctagon className="h-5 w-5 text-orange-500" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Non-conformités ({findingsCount})</h3>
                    </div>
                    <div className="space-y-2">
                        {safeFindings.filter(f => f.relatedControlId === control.id && f.status === 'Ouvert').map(finding => (
                            <div key={finding.id} className="p-2 bg-white/60 dark:bg-black/20 rounded-lg text-xs border border-orange-100 dark:border-orange-900/30">
                                <div className="font-bold truncate">{finding.description}</div>
                                <div className="text-slate-500">Type: {finding.type}</div>
                            </div>
                        ))}
                        {findingsCount === 0 && <p className="text-xs text-slate-500">Aucune non-conformité ouverte.</p>}
                    </div>
                </div>
            </div>

        </div>
    );
};
