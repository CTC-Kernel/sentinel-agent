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
        <div className="bg-brand-50/50 dark:bg-brand-900/10 p-4 rounded-2xl border border-brand-100 dark:border-brand-900/20 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                    <Sparkles className="h-4 w-4 mr-2 text-brand-500" />
                    {title}
                </h4>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <select
                        onChange={(e) => onSelectTemplate(e.target.value)}
                        disabled={readOnly}
                        className="flex-1 sm:flex-none text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors outline-none cursor-pointer h-9 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="">Choisir un modèle...</option>
                        {templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                    <Button
                        type="button"
                        onClick={onAutoGenerate}
                        disabled={isGenerating || readOnly}
                        variant="outline"
                        className="flex-1 sm:flex-none text-xs font-bold bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 h-9"
                    >
                        {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {isGenerating ? 'IA...' : 'Auto-complétion IA'}
                    </Button>
                </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {description}
            </p>
        </div>
    );
};
