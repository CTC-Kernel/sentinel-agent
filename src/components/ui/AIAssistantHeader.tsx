import { Sparkles, Loader2 } from './Icons';
import { Button } from './button';

export interface BaseTemplate {
 name: string;
 description: string;
}

interface AIAssistantHeaderProps<TTemplate extends BaseTemplate> {
 templates: TTemplate[];
 onSelectTemplate: (templateName: string) => void;
 onAutoGenerate: () => void;
 isGenerating: boolean;
 title?: string;
 description?: string;
 readOnly?: boolean;
}

export const AIAssistantHeader = <TTemplate extends BaseTemplate>({
 templates,
 onSelectTemplate,
 onAutoGenerate,
 isGenerating,
 title = "Assistant IA & Modèles",
 description = "Sélectionnez un modèle standard ou utilisez l'IA pour générer une proposition sur mesure.",
 readOnly = false
}: AIAssistantHeaderProps<TTemplate>) => {
 return (
 <div className="glass-premium p-4 rounded-2xl border border-border/40 shadow-sm mb-6 relative overflow-hidden group">
 <div className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-20 transition-opacity pointer-events-none">
 <Sparkles className="w-24 h-24 text-primary" />
 </div>
 <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
 <h4 className="text-sm font-bold text-foreground flex items-center">
  <div className="p-1.5 bg-primary/15 dark:bg-primary rounded-lg mr-2">
  <Sparkles className="h-4 w-4 text-primary" />
  </div>
  {title}
 </h4>
 <div className="flex flex-wrap gap-2 w-full sm:w-auto">
  <select
  onChange={(e) => onSelectTemplate(e.target.value)}
  disabled={readOnly}
  className="flex-1 sm:flex-none text-xs font-bold bg-muted text-foreground px-3 py-1.5 rounded-lg border border-border/40 hover:border-primary transition-colors outline-none cursor-pointer h-9 disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-border"
  >
  <option value="">Choisir un modèle...</option>
  {templates.map(t => <option key={t.name || 'unknown'} value={t.name}>{t.name}</option>)}
  </select>
  <Button
  type="button"
  onClick={onAutoGenerate}
  disabled={isGenerating || readOnly}
  className="flex-1 sm:flex-none text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 border-none flex items-center justify-center gap-2 h-9 shadow-md shadow-primary/20"
  >
  {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
  {isGenerating ? 'Génération...' : 'Auto-complétion IA'}
  </Button>
 </div>
 </div>
 <p className="text-xs text-muted-foreground leading-relaxed">
 {description}
 </p>
 </div>
 );
};
