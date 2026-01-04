import React, { useState } from 'react';
import { Control, UserProfile } from '../../../types';
import { Button } from '../../ui/button';
import { CustomSelect } from '../../ui/CustomSelect';
import { User, Loader2 } from '../../ui/Icons';
import { ComplianceAIAssistant } from '../ComplianceAIAssistant';

interface ComplianceDetailsProps {
    control: Control;
    canEdit: boolean;
    usersList: UserProfile[];
    handlers: {
        updating: boolean;
        handleStatusChange: (c: Control, s: Control['status']) => Promise<void>;
        handleAssign: (c: Control, uid: string) => Promise<void>;
        updateJustification: (c: Control, text: string) => Promise<void>;
    };
}

export const ComplianceDetails: React.FC<ComplianceDetailsProps> = ({
    control,
    canEdit,
    usersList,
    handlers
}) => {
    const { updating, handleStatusChange, handleAssign, updateJustification } = handlers;

    // Local state for justification text area
    const [justification, setJustification] = useState(control.justification || '');

    // Helper to handle justification update from AI or Textarea
    const handleJustificationChange = (text: string) => {
        setJustification(text);
    };

    const saveJustification = () => {
        if (justification !== control.justification) {
            updateJustification(control, justification);
        }
    };

    return (
        <div className="space-y-8 w-full max-w-3xl mx-auto">
            <ComplianceAIAssistant
                control={control}
                onApplyPolicy={(policy) => handleJustificationChange(justification ? justification + '\n\n' + policy : policy)}
            />

            {/* Status & Assignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Statut d'implémentation</h3>
                    {canEdit ? (
                        <div className="grid grid-cols-2 gap-2">
                            {(['Non commencé', 'Partiel', 'Implémenté', 'En revue', 'Non applicable', 'Exclu'] as Control['status'][]).map((s) => (
                                <Button
                                    key={s}
                                    aria-label={`Changer le statut à ${s}`}
                                    aria-pressed={control.status === s}
                                    onClick={() => handleStatusChange(control, s)}
                                    disabled={updating}
                                    variant={control.status === s ? 'default' : 'outline'}
                                    className={`h-auto py-2 text-[10px] font-bold justify-center whitespace-normal ${control.status === s ? 'bg-brand-600 hover:bg-brand-700' : 'text-slate-600 dark:text-slate-400'}`}
                                >
                                    {updating && control.status === s ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                    {s}
                                </Button>
                            ))}
                        </div>
                    ) : (
                        <span className={`px-4 py-2 rounded-xl text-sm font-bold border uppercase tracking-wide inline-block`}>{control.status}</span>
                    )}
                </div>

                <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Responsable</h3>
                    {canEdit ? (
                        <CustomSelect
                            label="Assigné à"
                            value={control.assigneeId || ''}
                            onChange={(val) => handleAssign(control, val as string)}
                            options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email || u.uid }))}
                            placeholder="Sélectionner un responsable..."
                            disabled={updating}
                        />
                    ) : (
                        <div className="flex items-center p-3 bg-slate-50 dark:bg-black/20 rounded-xl">
                            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 mr-3">
                                <User className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {usersList.find(u => u.uid === control.assigneeId)?.displayName || 'Non assigné'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Justification Area */}
            <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Justification / Politique</h3>
                {canEdit ? (
                    <textarea
                        className="w-full min-h-[120px] bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-y"
                        placeholder="Décrivez comment ce contrôle est implémenté..."
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        onBlur={saveJustification}
                    />
                ) : (
                    <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {control.justification || <span className="text-slate-400 italic">Aucune justification fournie.</span>}
                    </div>
                )}
            </div>
        </div>
    );
};
