import { memo, useCallback } from 'react';
import { UseFormRegister } from 'react-hook-form';
import { Trash2, GripVertical as Grip } from '../../ui/Icons';
import { QuestionnaireTemplate } from '../../../types/business';

interface QuestionItemProps {
 sIndex: number;
 qIndex: number;
 register: UseFormRegister<QuestionnaireTemplate>;
 onRemove: (index: number) => void;
}

export const QuestionItem = memo(({ sIndex, qIndex, register, onRemove }: QuestionItemProps) => {
 const handleRemove = useCallback(() => onRemove(qIndex), [onRemove, qIndex]);

 return (
 <div className="flex gap-4 items-start glass-premium p-4 rounded-3xl shadow-sm border border-border/40 group hover:border-primary/30 dark:hover:border-primary/90 transition-colors relative overflow-hidden">
 <div className="mt-2 text-muted-foreground group-hover:text-muted-foreground transition-colors">
 <Grip className="w-4 h-4 cursor-grab" />
 </div>
 <div className="flex-1 grid grid-cols-1 gap-3">
 <label htmlFor={`question-text-${sIndex}-${qIndex}`} className="sr-only">Question</label>
 <input
  id={`question-text-${sIndex}-${qIndex}`}
  aria-label="Question"
  {...register(`sections.${sIndex}.questions.${qIndex}.text`, { required: true })}
  className="w-full px-3 py-1.5 text-sm bg-transparent border border-border/40 rounded-lg focus:border-primary focus:ring-1 focus-visible:ring-primary transition-shadow"
  placeholder="Question..."
 />
 <div className="flex gap-3">
  <div className="flex-1">
  <label htmlFor={`question-type-${sIndex}-${qIndex}`} className="sr-only">Type de question</label>
  <select
  id={`question-type-${sIndex}-${qIndex}`}
  aria-label="Type de question"
  {...register(`sections.${sIndex}.questions.${qIndex}.type`)}
  className="w-full px-3 py-1.5 text-sm bg-transparent border border-border/40 rounded-lg text-muted-foreground focus:border-primary focus:ring-1 focus-visible:ring-primary transition-shadow"
  >
  <option value="yes_no">Oui / Non</option>
  <option value="text">Texte Libre</option>
  <option value="rating">Score (1-5)</option>
  <option value="multiple_choice">Choix Multiples</option>
  </select>
  </div>
  <div className="flex items-center gap-2">
  <label htmlFor={`question-weight-${sIndex}-${qIndex}`} className="text-xs text-muted-foreground whitespace-nowrap">Poids:</label>
  <input
  id={`question-weight-${sIndex}-${qIndex}`}
  aria-label="Poids de la question"
  type="number"
  {...register(`sections.${sIndex}.questions.${qIndex}.weight`)}
  className="w-16 px-2 py-1.5 text-sm bg-transparent border border-border/40 rounded-lg focus:border-primary focus:ring-1 focus-visible:ring-primary transition-shadow"
  defaultValue={1}
  />
  </div>
 </div>
 </div>
 <button
 type="button"
 aria-label="Supprimer la question"
 onClick={handleRemove}
 className="text-muted-foreground hover:text-red-500 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 transition-colors"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 );
});
