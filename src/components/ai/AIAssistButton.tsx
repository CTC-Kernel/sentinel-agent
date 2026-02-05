import React, { useState } from 'react';
import { Sparkles, Loader2 } from '../ui/Icons';
import { aiService } from '../../services/aiService';
import { ErrorLogger } from '../../services/errorLogger';
import { useStore } from '../../store';

interface AIAssistButtonProps {
 context: Record<string, unknown>;
 fieldName: string;
 onSuggest: (value: string) => void;
 prompt?: string;
 className?: string;
 tooltip?: string;
}

export const AIAssistButton: React.FC<AIAssistButtonProps> = ({ context, fieldName, onSuggest, prompt, className, tooltip = "Suggérer avec l'IA" }) => {
 const [loading, setLoading] = useState(false);
 const { addToast, t } = useStore();

 const handleSuggest = async () => {
 setLoading(true);
 try {
 // If a specific prompt is provided, use chatWithAI for more flexibility
 // Otherwise use the structured suggestField
 let suggestion = '';

 if (prompt) {
 // Add context to the prompt
 const fullPrompt = `${prompt}\n\nContexte actuel:\n${JSON.stringify(context, null, 2)}`;
 suggestion = await aiService.chatWithAI(fullPrompt);
 } else {
 const result = await aiService.suggestField(context, fieldName);
 suggestion = result.value;
 }

 if (suggestion) {
 onSuggest(suggestion);
 addToast(t('ai.toast.suggestionApplied', { defaultValue: "Suggestion appliquée !" }), "success");
 } else {
 addToast(t('ai.toast.noSuggestionFound', { defaultValue: "Je n'ai pas trouvé de suggestion pertinente." }), "info");
 }
 } catch (error) {
 ErrorLogger.error(error, 'AIAssistButton.handleSuggest');
 addToast(t('ai.toast.generationError', { defaultValue: "Erreur lors de la génération." }), "error");
 } finally {
 setLoading(false);
 }
 };

 return (
 <button
 type="button"
 onClick={handleSuggest}
 disabled={loading}
 className={`p-2 rounded-lg transition-all duration-300 group relative ${loading ? 'cursor-wait' : 'cursor-pointer'} ${className || 'text-primary hover:bg-primary/10 dark:hover:bg-primary'} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
 title={tooltip}
 >
 {loading ? (
 <Loader2 className="h-4 w-4 animate-spin text-primary" />
 ) : (
 <>
  <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110 group-active:scale-95" />
  <span className="absolute -top-1 -right-1 flex h-2 w-2">
  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75"></span>
  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
  </span>
 </>
 )}
 </button>
 );
};
