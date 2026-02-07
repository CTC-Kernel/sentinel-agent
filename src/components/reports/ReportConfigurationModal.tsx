import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/button';
import { FileText, ShieldAlert, CheckSquare, Server, Activity, ArrowRight } from '../ui/Icons';
import { /* schema validation via zod */ useForm, useWatch } from 'react-hook-form';

export interface ReportConfig {
 title: string;
 includeRisks: boolean;
 includeCompliance: boolean;
 includeAudits: boolean;
 includeProjects: boolean;
 includeIncidents: boolean;
}

interface ReportConfigurationModalProps {
 isOpen: boolean;
 onClose: () => void;
 onGenerate: (config: ReportConfig) => void;
 defaultTitle?: string;
}

export const ReportConfigurationModal: React.FC<ReportConfigurationModalProps> = ({
 isOpen,
 onClose,
 onGenerate,
 defaultTitle = "Rapport Exécutif Global"
}) => {
 const { t } = useTranslation();
 const { register, handleSubmit, setValue, control, formState: { isDirty } } = useForm<ReportConfig>({
 defaultValues: {
 title: defaultTitle,
 includeRisks: true,
 includeCompliance: true,
 includeAudits: true,
 includeProjects: true,
 includeIncidents: true
 }
 });

 const sections = useWatch({ control });

 const toggleSection = (key: keyof Omit<ReportConfig, 'title'>) => {
 setValue(key, !sections[key], { shouldDirty: true });
 };

 const handleGenerate = (data: ReportConfig) => {
 onGenerate(data);
 onClose();
 };

  // Keyboard support: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);


 return (
 <Modal
 isOpen={isOpen}
 onClose={onClose}
 title=""
 maxWidth="max-w-lg"
 hasUnsavedChanges={isDirty}
 >
 <div className="p-6">
 <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-3xl text-purple-600 dark:text-purple-400">
  <FileText className="h-6 w-6" />
  </div>
  Configuration du Rapport
 </h3>

 <div className="space-y-6">
  {/* Title Input */}
  <div className="space-y-2">
  <label htmlFor="report-title" className="text-sm font-medium text-foreground">
  Titre du rapport
  </label>
  <input
  id="report-title"
  type="text"
  {...register('title')}
  className="w-full px-4 py-2.5 rounded-3xl border border-border/40 bg-muted/50 dark:bg-white/5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
  placeholder="Ex: Rapport Trimestriel Q1 2024"
  />
  </div>

  <div className="space-y-3">
  <span className="text-sm font-medium text-foreground block mb-2">
  Sections à inclure
  </span>

  <button
  type="button"
  onClick={() => toggleSection('includeRisks')}
  aria-pressed={sections.includeRisks}
  className={`w-full flex items-center justify-between p-3 rounded-3xl border transition-all ${sections.includeRisks ? 'border-red-200 bg-red-50 dark:bg-red-900/20' : 'border-border/40 opacity-60'}`}
  >
  <div className="flex items-center gap-3">
  <ShieldAlert className={`h-5 w-5 ${sections.includeRisks ? 'text-red-500' : 'text-muted-foreground'}`} />
  <span className={`font-medium ${sections.includeRisks ? 'text-foreground' : 'text-muted-foreground'}`}>Risques Cyber</span>
  </div>
  <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${sections.includeRisks ? 'bg-red-500 border-red-500' : 'border-border/40'}`}>
  {sections.includeRisks && <ArrowRight className="h-3 w-3 text-white rotate-45" />}
  </div>
  </button>

  <button
  type="button"
  onClick={() => toggleSection('includeCompliance')}
  aria-pressed={sections.includeCompliance}
  className={`w-full flex items-center justify-between p-3 rounded-3xl border transition-all ${sections.includeCompliance ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-900/10' : 'border-border/40 opacity-60'}`}
  >
  <div className="flex items-center gap-3">
  <CheckSquare className={`h-5 w-5 ${sections.includeCompliance ? 'text-emerald-500' : 'text-muted-foreground'}`} />
  <span className={`font-medium ${sections.includeCompliance ? 'text-foreground' : 'text-muted-foreground'}`}>Conformité & Contrôles</span>
  </div>
  <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${sections.includeCompliance ? 'bg-emerald-500 border-emerald-500' : 'border-border/40'}`}>
  {sections.includeCompliance && <ArrowRight className="h-3 w-3 text-white rotate-45" />}
  </div>
  </button>

  <button
  type="button"
  onClick={() => toggleSection('includeProjects')}
  aria-pressed={sections.includeProjects}
  className={`w-full flex items-center justify-between p-3 rounded-3xl border transition-all ${sections.includeProjects ? 'border-blue-500/50 bg-blue-50 dark:bg-blue-900/20' : 'border-border/40 opacity-60'}`}
  >
  <div className="flex items-center gap-3">
  <Activity className={`h-5 w-5 ${sections.includeProjects ? 'text-blue-500' : 'text-muted-foreground'}`} />
  <span className={`font-medium ${sections.includeProjects ? 'text-foreground' : 'text-muted-foreground'}`}>Projets & Audits</span>
  </div>
  <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${sections.includeProjects ? 'bg-blue-500 border-blue-500' : 'border-border/40'}`}>
  {sections.includeProjects && <ArrowRight className="h-3 w-3 text-white rotate-45" />}
  </div>
  </button>

  <button
  type="button"
  onClick={() => toggleSection('includeIncidents')}
  aria-pressed={sections.includeIncidents}
  className={`w-full flex items-center justify-between p-3 rounded-3xl border transition-all ${sections.includeIncidents ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-900/10' : 'border-border/40 opacity-60'}`}
  >
  <div className="flex items-center gap-3">
  <Server className={`h-5 w-5 ${sections.includeIncidents ? 'text-orange-500' : 'text-muted-foreground'}`} />
  <span className={`font-medium ${sections.includeIncidents ? 'text-foreground' : 'text-muted-foreground'}`}>Incidents</span>
  </div>
  <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${sections.includeIncidents ? 'bg-orange-500 border-orange-500' : 'border-border/40'}`}>
  {sections.includeIncidents && <ArrowRight className="h-3 w-3 text-white rotate-45" />}
  </div>
  </button>
  </div>
 </div>
 </div>
 <div className="flex border-t border-border/40 dark:border-white/5">
 <Button
  type="button"
  variant="ghost"
  className="flex-1 py-4 h-auto rounded-none text-sm font-bold text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted/50 transition-colors"
  onClick={onClose}
 >
  {t('common.cancel', { defaultValue: 'Annuler' })}
 </Button>
 <div className="w-px bg-muted dark:bg-white/5"></div>
 <Button
  type="button"
  variant="ghost"
  className="flex-1 py-4 h-auto rounded-none text-sm font-bold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
  onClick={handleSubmit(handleGenerate)}
 >
  Générer le rapport
 </Button>
 </div>
 </Modal>
 );
};
