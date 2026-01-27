import React, { useState } from 'react';
import { Control, UserProfile, Framework } from '../../../types';
import { Button } from '../../ui/button';
import { CustomSelect } from '../../ui/CustomSelect';
import { User, Loader2, X, Plus, Layers } from '../../ui/Icons';
import { ComplianceAIAssistant } from '../ComplianceAIAssistant';
import { FRAMEWORKS } from '../../../data/frameworks';

interface ComplianceDetailsProps {
    control: Control;
    canEdit: boolean;
    usersList: UserProfile[];
    enabledFrameworks?: Framework[];
    handlers: {
        updating: boolean;
        handleStatusChange: (c: Control, s: Control['status']) => Promise<void>;
        handleAssign: (c: Control, uid: string) => Promise<void>;
        updateJustification: (c: Control, text: string) => Promise<void>;
        handleMapFramework?: (c: Control, f: Framework) => Promise<void>;
        handleUnmapFramework?: (c: Control, f: Framework) => Promise<void>;
    };
}

export const ComplianceDetails: React.FC<ComplianceDetailsProps> = ({
    control,
    canEdit,
    usersList,
    enabledFrameworks,
    handlers
}) => {
    const { updating, handleStatusChange, handleAssign, updateJustification, handleMapFramework, handleUnmapFramework } = handlers;

    // Get available frameworks for mapping (exclude primary and already mapped)
    const availableFrameworks = FRAMEWORKS.filter(f => {
        const isEnabled = !enabledFrameworks || enabledFrameworks.includes(f.id as Framework);
        const isPrimary = f.id === control.framework;
        const isAlreadyMapped = control.mappedFrameworks?.includes(f.id as Framework);
        return isEnabled && !isPrimary && !isAlreadyMapped;
    });

    // Get framework label by id
    const getFrameworkLabel = (id: string) => FRAMEWORKS.find(f => f.id === id)?.label || id;

    // Local state for justification text area
    const [justification, setJustification] = useState(control.justification || '');
    const [isSaving, setIsSaving] = useState(false);

    // Helper to handle justification update from AI or Textarea
    const handleJustificationChange = (text: string) => {
        setJustification(text);
    };

    const saveJustification = async () => {
        if (justification !== control.justification && !isSaving && !updating) {
            setIsSaving(true);
            try {
                await updateJustification(control, justification);
            } finally {
                setIsSaving(false);
            }
        }
    };

    return (
        <div className="space-y-8 w-full max-w-3xl mx-auto">
            <ComplianceAIAssistant
                control={control}
                onApplyPolicy={(policy) => handleJustificationChange(justification ? justification + '\n\n' + policy : policy)}
            />

            {/* Status & Assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 mb-4 tracking-widest">Statut d'implémentation</h3>
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
                                    className={`h-auto py-2 text-[11px] font-bold justify-center whitespace-normal ${control.status === s ? 'bg-brand-600 hover:bg-brand-700' : 'text-slate-600 dark:text-slate-300'}`}
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

                <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 mb-4 tracking-widest">Responsable</h3>
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
                            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-600 mr-3">
                                <User className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {usersList.find(u => u.uid === control.assigneeId)?.displayName || 'Non assigné'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Framework Mapping Section */}
            <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-white/60 dark:border-white/10 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-slate-500" />
                        <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 tracking-widest">Référentiels Satisfaits</h3>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {1 + (control.mappedFrameworks?.length || 0)} référentiel(s)
                    </span>
                </div>

                {/* Primary Framework Badge */}
                <div className="flex flex-wrap gap-2 mb-3">
                    {control.framework && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-brand-500 text-white border border-brand-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            {getFrameworkLabel(control.framework)}
                            <span className="text-[11px] text-brand-100 ml-1">(principal)</span>
                        </span>
                    )}

                    {/* Mapped Framework Badges */}
                    {control.mappedFrameworks?.map(fw => (
                        <span
                            key={fw}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        >
                            {getFrameworkLabel(fw)}
                            {canEdit && handleUnmapFramework && (
                                <button
                                    onClick={() => handleUnmapFramework(control, fw)}
                                    className="ml-1 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                                    disabled={updating}
                                    aria-label={`Retirer ${getFrameworkLabel(fw)}`}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </span>
                    ))}
                </div>

                {/* Add Framework Mapping */}
                {canEdit && handleMapFramework && availableFrameworks.length > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <Plus className="h-4 w-4 text-slate-400" />
                        <CustomSelect
                            label=""
                            value=""
                            onChange={(val) => {
                                if (val) handleMapFramework(control, val as Framework);
                            }}
                            options={availableFrameworks.map(f => ({ value: f.id, label: f.label }))}
                            placeholder="Ajouter un référentiel..."
                            disabled={updating}
                        />
                    </div>
                )}

                {availableFrameworks.length === 0 && !control.mappedFrameworks?.length && (
                    <p className="text-xs text-muted-foreground italic mt-2">
                        Ce contrôle ne satisfait que son référentiel principal.
                    </p>
                )}
            </div>

            {/* Justification Area */}
            <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-white/60 dark:border-white/10 shadow-sm">
                <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 mb-4 tracking-widest">Justification / Politique</h3>
                {canEdit ? (
                    <>
                        <textarea
                            className="w-full min-h-[120px] bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm focus:ring-2 focus-visible:ring-brand-500 outline-none transition-all resize-y disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                            placeholder="Décrivez comment ce contrôle est implémenté..."
                            value={justification}
                            onChange={(e) => setJustification(e.target.value)}
                            onBlur={saveJustification}
                            maxLength={2000}
                            disabled={!canEdit || updating || isSaving}
                        />
                        <div className="text-[11px] text-right text-muted-foreground mt-1">
                            {justification.length}/2000
                        </div>
                    </>
                ) : (
                    <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {control.justification || <span className="text-muted-foreground italic">Aucune justification fournie.</span>}
                    </div>
                )}
            </div>
        </div>
    );
};
