import React, { useState, useEffect } from 'react';
import { X, Calendar, Link as LinkIcon } from 'lucide-react';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { DatePicker } from '../ui/DatePicker';
import { useForm, Controller, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useStore } from '../../store';
import { CalendarService } from '../../services/calendarService';
import { GoogleCalendarService } from '../../services/googleCalendarService';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { toast } from 'sonner';
import { useCalendarData } from '../../hooks/calendar/useCalendarData';
import { ErrorLogger } from '../../services/errorLogger';

const createEventSchema = z.object({
    title: z.string().min(3, "Le titre doit contenir au moins 3 caractères"),
    description: z.string().optional(),
    start: z.string(), // ISO Date string
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format d'heure invalide"),
    end: z.string(), // ISO Date string
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format d'heure invalide"),
    subType: z.string().optional(),
    manager: z.string().optional(),
    auditor: z.string().optional(),
    technician: z.string().optional(),
    linkedAssetIds: z.array(z.string()).default([]),
    linkedRiskIds: z.array(z.string()).default([]),
    allDay: z.boolean().default(false)
}).refine((data) => {
    const start = new Date(`${data.start}T${data.startTime}`);
    const end = new Date(`${data.end}T${data.endTime}`);
    return end >= start;
}, {
    message: "La date de fin doit être postérieure à la date de début",
    path: ["end"], // Focus error on end date
});

type CreateEventFormData = z.infer<typeof createEventSchema>;

interface CreateEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEventCreated: () => void;
    initialDate?: Date;
}

type EventType = 'audit' | 'project' | 'maintenance' | 'drill';

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ isOpen, onClose, onEventCreated, initialDate }) => {
    const { user } = useStore();
    const { assets, risks } = useCalendarData();
    const [eventType, setEventType] = useState<EventType>('audit');
    const [syncToGoogle, setSyncToGoogle] = useState(false);
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);

    useEffect(() => {
        setIsGoogleConnected(!!sessionStorage.getItem('google_access_token'));
    }, [isOpen]);

    const {
        register,
        handleSubmit,
        control,
        reset,
        setValue,
        formState: { errors, isSubmitting }
    } = useForm<CreateEventFormData>({
        resolver: zodResolver(createEventSchema) as Resolver<CreateEventFormData>,
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
            linkedAssetIds: [],
            linkedRiskIds: [],
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

    // Accessibility: Handle Escape key to close modal
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isSubmitting) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, isSubmitting, onClose]);

    const onSubmit = async (data: CreateEventFormData) => {
        if (!user?.organizationId || !user?.uid) return;

        try {
            // Combine date and time
            const startDateTime = new Date(`${data.start}T${data.startTime}`);
            const endDateTime = new Date(`${data.end}T${data.endTime}`);

            await CalendarService.createEvent({
                type: eventType,
                title: data.title,
                description: data.description || '',
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
                        description: data.description || '',
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
                                    <button type="button" aria-label="Fermer la fenêtre" onClick={onClose} className="text-slate-500 hover:text-slate-600 transition-colors">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="mb-6 flex space-x-2 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
                                    {(['audit', 'project', 'maintenance', 'drill'] as EventType[]).map((type) => (
                                        <button
                                            type="button"
                                            key={type}
                                            aria-label={`Sélectionner le type ${type}`}
                                            aria-pressed={eventType === type}
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
                                        <Controller
                                            name="title"
                                            control={control}
                                            render={({ field }) => (
                                                <FloatingLabelInput
                                                    label="Titre"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Ex: Audit ISO 27001, Maintenance Serveur..."
                                                    error={errors.title?.message}
                                                />
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date de début</label>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <Controller
                                                        name="start"
                                                        control={control}
                                                        render={({ field }) => (
                                                            <DatePicker
                                                                label=""
                                                                value={field.value}
                                                                onChange={(date) => field.onChange(date)}
                                                            />
                                                        )}
                                                    />
                                                </div>
                                                <div className="w-32">
                                                    <Controller
                                                        name="startTime"
                                                        control={control}
                                                        render={({ field }) => (
                                                            <FloatingLabelInput
                                                                label=""
                                                                type="time"
                                                                value={field.value}
                                                                onChange={field.onChange}
                                                                error={errors.startTime?.message}
                                                            />
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date de fin / Échéance</label>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <Controller
                                                        name="end"
                                                        control={control}
                                                        render={({ field }) => (
                                                            <DatePicker
                                                                label=""
                                                                value={field.value}
                                                                onChange={(date) => field.onChange(date)}
                                                            />
                                                        )}
                                                    />
                                                </div>
                                                <div className="w-32">
                                                    <Controller
                                                        name="endTime"
                                                        control={control}
                                                        render={({ field }) => (
                                                            <FloatingLabelInput
                                                                label=""
                                                                type="time"
                                                                value={field.value}
                                                                onChange={field.onChange}
                                                                error={errors.endTime?.message}
                                                            />
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                            {errors.end && <p className="text-xs text-red-500 mt-1">{errors.end.message}</p>}
                                        </div>
                                    </div>

                                    {/* Type Specific Fields */}
                                    {eventType === 'audit' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Controller
                                                    name="subType"
                                                    control={control}
                                                    render={({ field }) => (
                                                        <CustomSelect
                                                            label="Type d'audit"
                                                            options={[
                                                                { value: "Interne", label: "Interne" },
                                                                { value: "Externe", label: "Externe" },
                                                                { value: "Certification", label: "Certification" }
                                                            ]}
                                                            value={field.value || ''}
                                                            onChange={field.onChange}
                                                        />
                                                    )}
                                                />
                                            </div>
                                            <div>
                                                <Controller
                                                    name="auditor"
                                                    control={control}
                                                    render={({ field }) => (
                                                        <FloatingLabelInput
                                                            label="Auditeur"
                                                            value={field.value || ''}
                                                            onChange={field.onChange}
                                                        />
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {eventType === 'maintenance' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Controller
                                                    name="subType"
                                                    control={control}
                                                    render={({ field }) => (
                                                        <CustomSelect
                                                            label="Type de maintenance"
                                                            options={[
                                                                { value: "Préventive", label: "Préventive" },
                                                                { value: "Corrective", label: "Corrective" },
                                                                { value: "Mise à jour", label: "Mise à jour" }
                                                            ]}
                                                            value={field.value || ''}
                                                            onChange={field.onChange}
                                                        />
                                                    )}
                                                />
                                            </div>
                                            <div>
                                                <Controller
                                                    name="technician"
                                                    control={control}
                                                    render={({ field }) => (
                                                        <FloatingLabelInput
                                                            label="Technicien"
                                                            value={field.value || ''}
                                                            onChange={field.onChange}
                                                        />
                                                    )}
                                                />
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
                                                <Controller
                                                    control={control}
                                                    name="linkedAssetIds"
                                                    render={({ field }) => (
                                                        <CustomSelect
                                                            label="Actifs concernés"
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            options={assets.map(a => ({ value: a.id, label: a.name }))}
                                                            multiple
                                                            placeholder="Sélectionner des actifs..."
                                                        />
                                                    )}
                                                />
                                            </div>

                                            {/* Risk Linking */}
                                            <div>
                                                <Controller
                                                    control={control}
                                                    name="linkedRiskIds"
                                                    render={({ field }) => (
                                                        <CustomSelect
                                                            label="Risques associés"
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            options={risks.map(r => ({ value: r.id, label: r.threat }))}
                                                            multiple
                                                            placeholder="Sélectionner des risques..."
                                                        />
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
                                        <Controller
                                            name="description"
                                            control={control}
                                            render={({ field }) => (
                                                <FloatingLabelInput
                                                    label="Description details"
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                    textarea
                                                    placeholder="Détails supplémentaires..."
                                                    error={errors.description?.message}
                                                />
                                            )}
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
                                            aria-label={isSubmitting ? 'Création en cours...' : 'Créer Événement'}
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
