import React, { useState, useEffect } from 'react';
import { Dialog, Transition, Listbox } from '@headlessui/react';
import { Fragment } from 'react';
import { X, Calendar, Check, ChevronDown, Link as LinkIcon } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { useStore } from '../../store';
import { CalendarService } from '../../services/calendarService';
import { GoogleCalendarService } from '../../services/googleCalendarService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Asset, Risk } from '../../types';
import { toast } from 'sonner';
import { ErrorLogger } from '../../services/errorLogger';

interface CreateEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEventCreated: () => void;
    initialDate?: Date;
}

type EventType = 'audit' | 'project' | 'maintenance' | 'drill';

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ isOpen, onClose, onEventCreated, initialDate }) => {
    const { user } = useStore();
    const [eventType, setEventType] = useState<EventType>('audit');
    const [assets, setAssets] = useState<Asset[]>([]);
    const [risks, setRisks] = useState<Risk[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [syncToGoogle, setSyncToGoogle] = useState(false);
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);

    useEffect(() => {
        setIsGoogleConnected(!!sessionStorage.getItem('google_access_token'));
    }, [isOpen]);

    const { register, handleSubmit, control, reset, setValue } = useForm({
        defaultValues: {
            title: '',
            description: '',
            start: initialDate ? initialDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            startTime: '09:00',
            end: initialDate ? initialDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            endTime: '10:00',
            subType: '',
            manager: user?.displayName || '',
            auditor: user?.displayName || '',
            technician: user?.displayName || '',
            linkedAssetIds: [] as string[],
            linkedRiskIds: [] as string[],
            allDay: false
        }
    });

    // Reset form when modal opens or date changes
    useEffect(() => {
        if (isOpen && initialDate) {
            setValue('start', initialDate.toISOString().split('T')[0]);
            setValue('end', initialDate.toISOString().split('T')[0]);
        }
    }, [isOpen, initialDate, setValue]);

    // Fetch Assets and Risks for linking
    useEffect(() => {
        const fetchData = async () => {
            if (!user?.organizationId) return;

            try {
                const assetsQuery = query(collection(db, 'assets'), where('organizationId', '==', user.organizationId));
                const risksQuery = query(collection(db, 'risks'), where('organizationId', '==', user.organizationId));

                const [assetsSnap, risksSnap] = await Promise.all([getDocs(assetsQuery), getDocs(risksQuery)]);

                setAssets(assetsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Asset)));
                setRisks(risksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Risk)));
            } catch (error) {
                ErrorLogger.error(error, "CreateEventModal.fetchData");
            }
        };

        if (isOpen) fetchData();
    }, [isOpen, user?.organizationId]);

    interface CreateEventFormData {
        title: string;
        description: string;
        start: string;
        startTime: string;
        end: string;
        endTime: string;
        subType: string;
        manager: string;
        auditor: string;
        technician: string;
        linkedAssetIds: string[];
        linkedRiskIds: string[];
        allDay: boolean;
    }

    const onSubmit = async (data: CreateEventFormData) => {
        if (!user?.organizationId || !user?.uid) return;
        setIsSubmitting(true);

        try {
            // Combine date and time
            const startDateTime = new Date(`${data.start}T${data.startTime}`);
            const endDateTime = new Date(`${data.end}T${data.endTime}`);

            await CalendarService.createEvent({
                type: eventType,
                title: data.title,
                description: data.description,
                start: startDateTime,
                end: endDateTime,
                subType: data.subType,
                manager: data.manager,
                auditor: data.auditor,
                technician: data.technician,
                linkedAssetIds: data.linkedAssetIds,
                linkedRiskIds: data.linkedRiskIds
            }, user.organizationId, user.uid);

            // 2. Sync to Google Calendar (if enabled)
            if (syncToGoogle && isGoogleConnected) {
                const token = sessionStorage.getItem('google_access_token');
                if (token) {
                    await GoogleCalendarService.createEvent(token, {
                        title: data.title,
                        description: data.description,
                        start: startDateTime,
                        end: endDateTime,
                    });
                    toast.success("Événement synchronisé avec Google Calendar");
                }
            }

            toast.success('Événement créé avec succès');
            onEventCreated();
            onClose();
            reset();
        } catch (error) {
            ErrorLogger.error(error, "CreateEventModal.onSubmit");
            toast.error("Erreur lors de la création de l'événement");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 text-left align-middle shadow-xl transition-all border border-slate-200 dark:border-white/10">
                                <div className="flex justify-between items-center mb-6">
                                    <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-slate-900 dark:text-white flex items-center">
                                        <Calendar className="h-5 w-5 mr-2 text-brand-500" />
                                        Nouvel Événement
                                    </Dialog.Title>
                                    <button onClick={onClose} className="text-slate-500 hover:text-slate-600 transition-colors">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="mb-6 flex space-x-2 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
                                    {(['audit', 'project', 'maintenance', 'drill'] as EventType[]).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setEventType(type)}
                                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all capitalize ${eventType === type
                                                ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                                }`}
                                        >
                                            {type === 'drill' ? 'Exercice BCP' : type}
                                        </button>
                                    ))}
                                </div>

                                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                    {/* Common Fields */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Titre</label>
                                        <input
                                            {...register('title', { required: true })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                                            placeholder="Ex: Audit ISO 27001, Maintenance Serveur..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date de début</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="date"
                                                    {...register('start', { required: true })}
                                                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                                                />
                                                <input
                                                    type="time"
                                                    {...register('startTime', { required: true })}
                                                    className="w-24 px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date de fin / Échéance</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="date"
                                                    {...register('end', { required: true })}
                                                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                                                />
                                                <input
                                                    type="time"
                                                    {...register('endTime', { required: true })}
                                                    className="w-24 px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Type Specific Fields */}
                                    {eventType === 'audit' && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type d'audit</label>
                                                <select {...register('subType')} className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white">
                                                    <option value="Interne">Interne</option>
                                                    <option value="Externe">Externe</option>
                                                    <option value="Certification">Certification</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Auditeur</label>
                                                <input {...register('auditor')} className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white" />
                                            </div>
                                        </div>
                                    )}

                                    {eventType === 'maintenance' && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type de maintenance</label>
                                                <select {...register('subType')} className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white">
                                                    <option value="Préventive">Préventive</option>
                                                    <option value="Corrective">Corrective</option>
                                                    <option value="Mise à jour">Mise à jour</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Technicien</label>
                                                <input {...register('technician')} className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Linking Section */}
                                    <div className="border-t border-slate-200 dark:border-white/10 pt-4 mt-4">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center">
                                            <LinkIcon className="h-4 w-4 mr-2 text-brand-500" />
                                            Lier des éléments
                                        </h4>

                                        <div className="space-y-4">
                                            {/* Asset Linking */}
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Actifs concernés</label>
                                                <Controller
                                                    control={control}
                                                    name="linkedAssetIds"
                                                    render={({ field }) => (
                                                        <Listbox value={field.value} onChange={field.onChange} multiple>
                                                            <div className="relative mt-1">
                                                                <Listbox.Button className="relative w-full cursor-default rounded-xl bg-slate-50 dark:bg-black/20 py-2 pl-3 pr-10 text-left border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm dark:text-white min-h-[42px]">
                                                                    <span className="block truncate">
                                                                        {field.value.length === 0
                                                                            ? 'Sélectionner des actifs...'
                                                                            : `${field.value.length} actif(s) sélectionné(s)`}
                                                                    </span>
                                                                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                                                        <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                                                                    </span>
                                                                </Listbox.Button>
                                                                <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                                                                    <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-xl bg-white dark:bg-slate-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-50">
                                                                        {assets.map((asset) => (
                                                                            <Listbox.Option
                                                                                key={asset.id}
                                                                                className={({ active }) =>
                                                                                    `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-900 dark:text-brand-100' : 'text-slate-900 dark:text-slate-100'}`
                                                                                }
                                                                                value={asset.id}
                                                                            >
                                                                                {({ selected }) => (
                                                                                    <>
                                                                                        <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                                                                            {asset.name}
                                                                                        </span>
                                                                                        {selected ? (
                                                                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600 dark:text-brand-400">
                                                                                                <Check className="h-4 w-4" aria-hidden="true" />
                                                                                            </span>
                                                                                        ) : null}
                                                                                    </>
                                                                                )}
                                                                            </Listbox.Option>
                                                                        ))}
                                                                    </Listbox.Options>
                                                                </Transition>
                                                            </div>
                                                        </Listbox>
                                                    )}
                                                />
                                            </div>

                                            {/* Risk Linking */}
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Risques associés</label>
                                                <Controller
                                                    control={control}
                                                    name="linkedRiskIds"
                                                    render={({ field }) => (
                                                        <Listbox value={field.value} onChange={field.onChange} multiple>
                                                            <div className="relative mt-1">
                                                                <Listbox.Button className="relative w-full cursor-default rounded-xl bg-slate-50 dark:bg-black/20 py-2 pl-3 pr-10 text-left border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm dark:text-white min-h-[42px]">
                                                                    <span className="block truncate">
                                                                        {field.value.length === 0
                                                                            ? 'Sélectionner des risques...'
                                                                            : `${field.value.length} risque(s) sélectionné(s)`}
                                                                    </span>
                                                                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                                                        <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                                                                    </span>
                                                                </Listbox.Button>
                                                                <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                                                                    <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-xl bg-white dark:bg-slate-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-50">
                                                                        {risks.map((risk) => (
                                                                            <Listbox.Option
                                                                                key={risk.id}
                                                                                className={({ active }) =>
                                                                                    `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-900 dark:text-brand-100' : 'text-slate-900 dark:text-slate-100'}`
                                                                                }
                                                                                value={risk.id}
                                                                            >
                                                                                {({ selected }) => (
                                                                                    <>
                                                                                        <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                                                                            {risk.threat}
                                                                                        </span>
                                                                                        {selected ? (
                                                                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600 dark:text-brand-400">
                                                                                                <Check className="h-4 w-4" aria-hidden="true" />
                                                                                            </span>
                                                                                        ) : null}
                                                                                    </>
                                                                                )}
                                                                            </Listbox.Option>
                                                                        ))}
                                                                    </Listbox.Options>
                                                                </Transition>
                                                            </div>
                                                        </Listbox>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="allDay"
                                            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                            {...register('allDay')}
                                        />
                                        <label htmlFor="allDay" className="text-sm text-slate-700 dark:text-slate-300">Toute la journée</label>
                                    </div>

                                    {isGoogleConnected && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="syncGoogle"
                                                checked={syncToGoogle}
                                                onChange={(e) => setSyncToGoogle(e.target.checked)}
                                                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                            />
                                            <label htmlFor="syncGoogle" className="text-sm text-slate-700 dark:text-slate-300 flex items-center">
                                                Synchroniser avec Google
                                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-3 h-3 ml-1.5 opacity-70" />
                                            </label>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                                        <textarea
                                            {...register('description')}
                                            rows={3}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                                            placeholder="Détails supplémentaires..."
                                        />
                                    </div>

                                    <div className="mt-6 flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="px-4 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? 'Création...' : 'Créer Événement'}
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};
