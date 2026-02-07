import { memo, useCallback } from 'react';
import { Control, UseFormRegister, useFieldArray } from 'react-hook-form';
import { Trash2, Plus } from '../../ui/Icons';
import { QuestionnaireTemplate } from '../../../types/business';
import { QuestionItem } from './QuestionItem';

interface SectionEditorProps {
 control: Control<QuestionnaireTemplate>;
 register: UseFormRegister<QuestionnaireTemplate>;
 sIndex: number;
 onRemove: (index: number) => void;
}

export const SectionEditor = memo(({ control, register, sIndex, onRemove }: SectionEditorProps) => {
 const { fields: questions, append, remove } = useFieldArray({
 control,
 name: `sections.${sIndex}.questions`
 });

 const handleAddQuestion = useCallback(() => {
 append({ id: crypto.randomUUID(), text: '', type: 'yes_no', weight: 1, required: true });
 }, [append]);

 const handleRemoveQuestion = useCallback((index: number) => {
 remove(index);
 }, [remove]);

 const handleRemoveSection = useCallback(() => {
 onRemove(sIndex);
 }, [onRemove, sIndex]);

 return (
 <div className="bg-muted/50 p-6 rounded-2xl border border-border/40">
 <div className="flex justify-between items-start mb-4">
 <div className="flex-1 grid grid-cols-12 gap-4">
  <div className="col-span-8">
  <label htmlFor={`section-title-${sIndex}`} className="sr-only">Titre de la section</label>
  <input
  id={`section-title-${sIndex}`}
  aria-label="Titre de la section"
  {...register(`sections.${sIndex}.title`, { required: true })}
  className="w-full text-lg font-bold bg-transparent border-0 border-b border-dashed border-border/40 focus-visible:border-primary focus-visible:ring-0 px-0"
  placeholder="Titre de la section"
  />
  </div>
  <div className="col-span-4">
  <label htmlFor={`section-weight-${sIndex}`} className="sr-only">Poids de la section</label>
  <input
  id={`section-weight-${sIndex}`}
  aria-label="Poids de la section"
  type="number"
  {...register(`sections.${sIndex}.weight`)}
  className="w-full bg-transparent border border-border/40 rounded-lg text-sm px-2 py-1"
  placeholder="Poids (ex: 1)"
  />
  </div>
 </div>
 <button
  type="button"
  aria-label="Supprimer la section"
  onClick={handleRemoveSection}
  className="ml-4 text-muted-foreground hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20"
 >
  <Trash2 className="w-5 h-5" />
 </button>
 </div>

 <div className="space-y-3 pl-4 border-l-2 border-border/40">
 {questions.map((q, qIndex) => (
  <QuestionItem
  key={q.id || 'unknown'}
  sIndex={sIndex}
  qIndex={qIndex}
  register={register}
  onRemove={handleRemoveQuestion}
  />
 ))}

 <button
  type="button"
  aria-label="Ajouter une Question"
  onClick={handleAddQuestion}
  className="text-sm text-primary font-medium hover:text-primary flex items-center mt-2 px-2 py-1 rounded-lg hover:bg-primary/10 dark:hover:bg-primary/10 transition-colors w-fit"
 >
  <Plus className="w-3 h-3 mr-1" />
  Ajouter une Question
 </button>
 </div>
 </div>
 );
});
