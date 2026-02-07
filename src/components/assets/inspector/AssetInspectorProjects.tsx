import React from 'react';
import { FolderKanban } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import type { Asset, Project } from '../../../types';
import { useLocale } from '../../../hooks/useLocale';

interface AssetInspectorProjectsProps {
 selectedAsset: Asset;
 linkedProjects: Project[];
}

export const AssetInspectorProjects: React.FC<AssetInspectorProjectsProps> = ({
 linkedProjects
}) => {
 const { t } = useLocale();
 return (
 <div className="space-y-6 sm:space-y-8">
 <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center">
 <FolderKanban className="h-4 w-4 mr-2" /> {t('assets.inspector.linkedProjects', { defaultValue: 'Projets Liés' })} ({linkedProjects.length})
 </h3>
 {linkedProjects.length === 0 ? (
 <EmptyState compact icon={FolderKanban} title={t('assets.inspector.noProject', { defaultValue: 'Aucun projet' })} description={t('assets.inspector.noProjectDesc', { defaultValue: 'Aucun projet associé.' })} />
 ) : (
 <div className="grid gap-4">
  {linkedProjects.map(proj => (
  <div key={proj.id || 'unknown'} className="p-5 glass-premium rounded-3xl border border-border/40 shadow-sm hover:shadow-md transition-all">
  <div className="flex justify-between items-start mb-2">
  <span className="text-sm font-bold text-foreground">{proj.name}</span>
  <span className={`text-xs uppercase font-bold px-2.5 py-1 rounded-3xl ${proj.status === 'En cours' ? 'bg-info-bg text-info-text ring-1 ring-info-border' : 'bg-muted/500/10 text-muted-foreground ring-1 ring-slate-500/20'}`}>
   {proj.status}
  </span>
  </div>
  <p className="text-xs text-muted-foreground mb-3">{proj.description}</p>
  <div className="flex items-center justify-between">
  <div className="w-full bg-muted rounded-full h-1.5 mr-4 max-w-[100px]">
   <div className="bg-primary h-1.5 rounded-full" style={{ width: `${proj.progress}%` }}></div>
  </div>
  <span className="text-xs font-bold text-foreground text-muted-foreground">{proj.progress}%</span>
  </div>
  </div>
  ))}
 </div>
 )}
 </div>
 );
};
