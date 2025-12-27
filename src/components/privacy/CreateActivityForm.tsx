import React from 'react';
import { UseFormReturn, FieldErrors } from 'react-hook-form';
import { UserProfile, Asset, Risk } from '../../types';
import { ProcessingActivityFormData } from '../../schemas/privacySchema';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';

interface CreateActivityFormProps {
    createActivityForm: UseFormReturn<ProcessingActivityFormData>;
    usersList: UserProfile[];
    assetsList: Asset[];
    risksList: Risk[];
    handleCreate: (data: ProcessingActivityFormData) => Promise<void>;
    onInvalid: (errors: FieldErrors<ProcessingActivityFormData>) => void;
    onCancel: () => void;
}

export const CreateActivityForm: React.FC<CreateActivityFormProps> = ({
    createActivityForm,
    usersList,
    assetsList,
    risksList,
    handleCreate,
    onInvalid,
    onCancel
}) => {
    return (
        <form onSubmit={createActivityForm.handleSubmit(handleCreate, onInvalid)} className="p-4 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <FloatingLabelInput label="Nom du traitement" {...createActivityForm.register('name')} placeholder="ex: Gestion Paie" error={createActivityForm.formState.errors.name?.message} />
                </div>
                <div>
                    <label htmlFor="privacy-activity-managerId" className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Responsable</label>
                    <CustomSelect
                        value={createActivityForm.watch('managerId') || ''}
                        onChange={(val) => {
                            const value = Array.isArray(val) ? val[0] : val;
                            const selectedUser = usersList.find(u => u.uid === value);
                            createActivityForm.setValue('managerId', value);
                            createActivityForm.setValue('manager', selectedUser?.displayName || '');
                        }}
                        options={usersList.map(u => ({ value: u.uid, label: u.displayName }))}
                        placeholder="Sélectionner..."
                    />
                </div>
            </div>
            <div>
                <FloatingLabelInput label="Finalité principale" textarea rows={2} {...createActivityForm.register('purpose')} placeholder="ex: Payer les salaires et déclarations sociales" />
            </div>
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Base Légale</label>
                    <CustomSelect
                        value={createActivityForm.watch('legalBasis')}
                        onChange={(val) => createActivityForm.setValue('legalBasis', (Array.isArray(val) ? val[0] : val) as ProcessingActivityFormData['legalBasis'])}
                        options={['Consentement', 'Contrat', 'Obligation Légale', 'Intérêt Légitime'].map(c => ({ value: c, label: c }))}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Statut</label>
                    <CustomSelect
                        value={createActivityForm.watch('status')}
                        onChange={(val) => createActivityForm.setValue('status', (Array.isArray(val) ? val[0] : val) as ProcessingActivityFormData['status'])}
                        options={[
                            { value: 'Actif', label: 'Actif' },
                            { value: 'En projet', label: 'En projet' },
                            { value: 'Archivé', label: 'Archivé' }
                        ]}
                    />
                </div>
            </div>
            <div>
                <CustomSelect
                    label="Catégories de données"
                    multiple
                    value={createActivityForm.watch('dataCategories')}
                    onChange={(val) => createActivityForm.setValue('dataCategories', Array.isArray(val) ? val : [val])}
                    options={['État civil', 'Vie personnelle', 'Bancaire / Financier', 'Connexion / Trace', 'Santé (Sensible)', 'Biométrique', 'Judiciaire'].map(c => ({ value: c, label: c }))}
                />
            </div>
            <div className="grid grid-cols-2 gap-6">
                <div><FloatingLabelInput label="Durée Conservation" {...createActivityForm.register('retentionPeriod')} placeholder="ex: 5 ans après départ" /></div>
                <div>
                    <CustomSelect
                        label="DPIA Requis ?"
                        value={createActivityForm.watch('hasDPIA') ? 'yes' : 'no'}
                        onChange={(val) => createActivityForm.setValue('hasDPIA', val === 'yes')}
                        options={[
                            { value: 'yes', label: 'Oui - Requis' },
                            { value: 'no', label: 'Non - Pas nécessaire' }
                        ]}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-white/5">
                <div>
                    <CustomSelect
                        label="Actifs liés"
                        multiple
                        value={createActivityForm.watch('relatedAssetIds') || []}
                        onChange={(val) => createActivityForm.setValue('relatedAssetIds', Array.isArray(val) ? val : [val])}
                        options={assetsList.map(a => ({ value: a.id, label: a.name }))}
                        placeholder="Associer des actifs..."
                    />
                </div>
                <div>
                    <CustomSelect
                        label="Risques liés"
                        multiple
                        value={createActivityForm.watch('relatedRiskIds') || []}
                        onChange={(val) => createActivityForm.setValue('relatedRiskIds', Array.isArray(val) ? val : [val])}
                        options={risksList.map(r => ({ value: r.id, label: r.threat.substring(0, 50) + '...' }))}
                        placeholder="Associer des risques..."
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                <button aria-label="Cancel creation" type="button" onClick={onCancel} className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                <button aria-label="Save creation" type="submit" className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl hover:scale-105 transition-all font-bold text-sm shadow-lg shadow-purple-500/30">Enregistrer</button>
            </div>
        </form>
    );
};
