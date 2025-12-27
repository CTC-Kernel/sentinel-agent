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
        <div className="flex gap-4 items-start bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 group hover:border-brand-200 dark:hover:border-brand-900/30 transition-colors">
            <div className="mt-2 text-slate-300 group-hover:text-slate-400 transition-colors">
                <Grip className="w-4 h-4 cursor-grab" />
            </div>
            <div className="flex-1 grid grid-cols-1 gap-3">
                <label htmlFor={`question-text-${sIndex}-${qIndex}`} className="sr-only">Question</label>
                <input
                    id={`question-text-${sIndex}-${qIndex}`}
                    aria-label="Question"
                    {...register(`sections.${sIndex}.questions.${qIndex}.text`, { required: true })}
                    className="w-full px-3 py-1.5 text-sm bg-transparent border border-slate-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-shadow"
                    placeholder="Question..."
                />
                <div className="flex gap-3">
                    <div className="flex-1">
                        <label htmlFor={`question-type-${sIndex}-${qIndex}`} className="sr-only">Type de question</label>
                        <select
                            id={`question-type-${sIndex}-${qIndex}`}
                            aria-label="Type de question"
                            {...register(`sections.${sIndex}.questions.${qIndex}.type`)}
                            className="w-full px-3 py-1.5 text-sm bg-transparent border border-slate-200 rounded-lg text-slate-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-shadow"
                        >
                            <option value="yes_no">Oui / Non</option>
                            <option value="text">Texte Libre</option>
                            <option value="rating">Score (1-5)</option>
                            <option value="multiple_choice">Choix Multiples</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor={`question-weight-${sIndex}-${qIndex}`} className="text-xs text-slate-500 whitespace-nowrap">Poids:</label>
                        <input
                            id={`question-weight-${sIndex}-${qIndex}`}
                            aria-label="Poids de la question"
                            type="number"
                            {...register(`sections.${sIndex}.questions.${qIndex}.weight`)}
                            className="w-16 px-2 py-1.5 text-sm bg-transparent border border-slate-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-shadow"
                            defaultValue={1}
                        />
                    </div>
                </div>
            </div>
            <button
                type="button"
                aria-label="Supprimer la question"
                onClick={handleRemove}
                className="text-slate-300 hover:text-red-500 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
});
