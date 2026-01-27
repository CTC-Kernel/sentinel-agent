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
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-20 transition-opacity pointer-events-none">
                <Sparkles className="w-24 h-24 text-brand-500" />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                    <div className="p-1.5 bg-brand-100 dark:bg-brand-900 rounded-lg mr-2">
                        <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    </div>
                    {title}
                </h4>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <select
                        onChange={(e) => onSelectTemplate(e.target.value)}
                        disabled={readOnly}
                        className="flex-1 sm:flex-none text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand-500 transition-colors outline-none cursor-pointer h-9 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:disabled:border-slate-600"
                    >
                        <option value="">Choisir un modèle...</option>
                        {templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                    <Button
                        type="button"
                        onClick={onAutoGenerate}
                        disabled={isGenerating || readOnly}
                        className="flex-1 sm:flex-none text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 border-none flex items-center justify-center gap-2 h-9 shadow-md shadow-brand-500/20"
                    >
                        {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {isGenerating ? 'Génération...' : 'Auto-complétion IA'}
                    </Button>
                </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {description}
            </p>
        </div>
    );
};
