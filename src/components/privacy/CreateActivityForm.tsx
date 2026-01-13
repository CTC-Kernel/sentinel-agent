import { FieldErrors, useWatch } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { UserProfile, Asset, Risk } from '../../types';
import { processingActivitySchema, ProcessingActivityFormData } from '../../schemas/privacySchema';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { useStore } from '../../store';
import { toast } from '@/lib/toast';
// Focus indicators: focus-visible:ring-2 applied globally via CSS

interface CreateActivityFormProps {
    usersList: UserProfile[];
    assetsList: Asset[];
    risksList: Risk[];
    onSubmit: (data: ProcessingActivityFormData) => Promise<void>;
    onCancel: () => void;
}

export const CreateActivityForm: React.FC<CreateActivityFormProps> = ({
    usersList,
    assetsList,
    risksList,
    onSubmit,
    onCancel
}) => {
    const { user } = useStore();

    const { register, handleSubmit, control, setValue, formState: { errors } } = useZodForm<typeof processingActivitySchema>({
        schema: processingActivitySchema,
        mode: 'onChange',
        defaultValues: {
            name: '',
            purpose: '',
            manager: user?.displayName || '',
            managerId: user?.uid || '',
            status: 'Actif',
            legalBasis: 'Intérêt Légitime',
            dataCategories: [],
            dataSubjects: [],
            retentionPeriod: '5 ans',
            hasDPIA: false,
            relatedAssetIds: [],
            relatedRiskIds: []
        }
    });

    const [managerId, legalBasis, status, dataCategories, hasDPIA, relatedAssetIds, relatedRiskIds] = useWatch({
        control,
        name: ['managerId', 'legalBasis', 'status', 'dataCategories', 'hasDPIA', 'relatedAssetIds', 'relatedRiskIds']
    });

    const onInvalid = (errors: FieldErrors<ProcessingActivityFormData>) => {
        const missingFields = Object.keys(errors).join(', ');
        toast.error(`Formulaire invalide. Champs en erreur : ${missingFields}`);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="p-4 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <FloatingLabelInput label="Nom du traitement" {...register('name')} placeholder="ex: Gestion Paie" error={errors.name?.message} />
                </div>
                <div>
                    <label htmlFor="privacy-activity-managerId" className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Responsable</label>
                    <CustomSelect
                        value={managerId || ''}
                        onChange={(val) => {
                            const value = Array.isArray(val) ? val[0] : val;
                            const selectedUser = usersList.find(u => u.uid === value);
                            setValue('managerId', value);
                            setValue('manager', selectedUser?.displayName || '');
                        }}
                        options={usersList.map(u => ({ value: u.uid, label: u.displayName }))}
                        placeholder="Sélectionner..."
                    />
                    {errors.managerId && <p className="text-red-500 text-xs mt-1">{errors.managerId.message}</p>}
                </div>
            </div>
            <div>
                <FloatingLabelInput label="Finalité principale" textarea rows={2} {...register('purpose')} placeholder="ex: Payer les salaires et déclarations sociales" error={errors.purpose?.message} />
            </div>
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Base Légale</label>
                    <CustomSelect
                        value={legalBasis}
                        onChange={(val) => setValue('legalBasis', (Array.isArray(val) ? val[0] : val) as ProcessingActivityFormData['legalBasis'])}
                        options={['Consentement', 'Contrat', 'Obligation Légale', 'Intérêt Légitime', 'Sauvegarde Intérêts', 'Mission Publique'].map(c => ({ value: c, label: c }))}
                    />
                    {errors.legalBasis && <p className="text-red-500 text-xs mt-1">{errors.legalBasis.message}</p>}
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Statut</label>
                    <CustomSelect
                        value={status}
                        onChange={(val) => setValue('status', (Array.isArray(val) ? val[0] : val) as ProcessingActivityFormData['status'])}
                        options={[
                            { value: 'Actif', label: 'Actif' },
                            { value: 'En projet', label: 'En projet' },
                            { value: 'Archivé', label: 'Archivé' }
                        ]}
                    />
                    {errors.status && <p className="text-red-500 text-xs mt-1">{errors.status.message}</p>}
                </div>
            </div>
            <div>
                <CustomSelect
                    label="Catégories de données"
                    multiple
                    value={dataCategories}
                    onChange={(val) => setValue('dataCategories', Array.isArray(val) ? val : [val])}
                    options={['État civil', 'Vie personnelle', 'Bancaire / Financier', 'Connexion / Trace', 'Santé (Sensible)', 'Biométrique', 'Judiciaire'].map(c => ({ value: c, label: c }))}
                />
            </div>
            <div className="grid grid-cols-2 gap-6">
                <div><FloatingLabelInput label="Durée Conservation" {...register('retentionPeriod')} placeholder="ex: 5 ans après départ" error={errors.retentionPeriod?.message} /></div>
                <div>
                    <CustomSelect
                        label="DPIA Requis ?"
                        value={hasDPIA ? 'yes' : 'no'}
                        onChange={(val) => setValue('hasDPIA', val === 'yes')}
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
                        value={relatedAssetIds || []}
                        onChange={(val) => setValue('relatedAssetIds', Array.isArray(val) ? val : [val])}
                        options={assetsList.map(a => ({ value: a.id, label: a.name }))}
                        placeholder="Associer des actifs..."
                    />
                </div>
                <div>
                    <CustomSelect
                        label="Risques liés"
                        multiple
                        value={relatedRiskIds || []}
                        onChange={(val) => setValue('relatedRiskIds', Array.isArray(val) ? val : [val])}
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
