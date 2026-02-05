import React, { useState, useEffect } from 'react';
import { Link as LinkIcon } from '../ui/Icons';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { DatePicker } from '../ui/DatePicker';
import { useForm, Controller, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useStore } from '../../store';
import { CalendarService } from '../../services/calendarService';
import { GoogleCalendarService } from '../../services/googleCalendarService';
import { toast } from '@/lib/toast';
import { useCalendarData } from '../../hooks/calendar/useCalendarData';
import { ErrorLogger } from '../../services/errorLogger';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Button } from '../ui/button';

const createEventSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().optional(),
    start: z.string(), // ISO Date string
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    end: z.string(), // ISO Date string
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
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
    message: "End date must be after start date",
    path: ["end"], // Focus error on end date
});

type CreateEventFormData = z.infer<typeof createEventSchema>;

interface CreateEventDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onEventCreated: () => void;
    initialDate?: Date;
}

type EventType = 'audit' | 'project' | 'maintenance' | 'drill';

export const CreateEventDrawer: React.FC<CreateEventDrawerProps> = ({ isOpen, onClose, onEventCreated, initialDate }) => {
    const { user, t } = useStore();
    const { assets, risks } = useCalendarData();
    const [eventType, setEventType] = useState<EventType>('audit');
    const [syncToGoogle, setSyncToGoogle] = useState(false);
    const [isGoogleConnected, setIsGoogleConnected] = useState(() => !!sessionStorage.getItem('google_access_token'));

    useEffect(() => {
        if (isOpen) {
            const connected = !!sessionStorage.getItem('google_access_token');
            if (connected !== isGoogleConnected) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setIsGoogleConnected(connected);
            }
        }
    }, [isOpen, isGoogleConnected]);

    const {
        register,
        handleSubmit,
        control,
        reset,
        setValue,
        formState: { errors, isSubmitting, isDirty }
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

    useEffect(() => {
        if (isOpen && initialDate) {
            setValue('start', initialDate.toISOString().split('T')[0]);
            setValue('end', initialDate.toISOString().split('T')[0]);
        }
    }, [isOpen, initialDate, setValue]);

    const onSubmit = async (data: CreateEventFormData) => {
        if (!user?.organizationId || !user?.uid) return;

        try {
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

            if (syncToGoogle && isGoogleConnected) {
                const token = sessionStorage.getItem('google_access_token');
                if (token) {
                    await GoogleCalendarService.createEvent(token, {
                        title: data.title,
                        description: data.description || '',
                        start: startDateTime,
                        end: endDateTime,
                    });
                    toast.success(t('calendar.toast.googleSynced', { defaultValue: "Événement synchronisé avec Google Calendar" }));
                }
            }

            toast.success(t('calendar.toast.eventCreated', { defaultValue: 'Événement créé avec succès' }));
            onEventCreated();
            onClose();
            reset();
        } catch (error) {
            ErrorLogger.error(error, "CreateEventDrawer.onSubmit");
            toast.error(t('calendar.toast.eventCreateError', { defaultValue: "Erreur lors de la création de l'événement" }));
        }
    };

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={t('events.create.title', { defaultValue: 'Nouvel Événement' })}
            subtitle={t('events.create.subtitle', { defaultValue: 'Planifiez une nouvelle activité ou échéance' })}
            width="max-w-6xl"
            icon={LinkIcon}
            hasUnsavedChanges={isDirty}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
                <div className="space-y-6 max-w-5xl mx-auto w-full">

                    {/* Event Type Toggle */}
                    <div className="flex space-x-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-3xl">
                        {(['audit', 'project', 'maintenance', 'drill'] as EventType[]).map((type) => (
                            <button
                                type="button"
                                key={type || 'unknown'}
                                aria-label={t('events.create.selectType', { defaultValue: `Sélectionner le type ${type}`, type })}
                                aria-pressed={eventType === type}
                                onClick={() => setEventType(type)}
                                className={`flex-1 py-2.5 px-4 rounded-2xl text-sm font-medium transition-all capitalize ${eventType === type
                                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                                    : 'text-slate-600 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                    }`}
                            >
                                {type === 'drill' ? t('events.types.drill', { defaultValue: 'Exercice BCP' }) : type}
                            </button>
                        ))}
                    </div>

                    {/* Common Fields */}
                    <div>
                        <Controller
                            name="title"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label={t('events.fields.title', { defaultValue: 'Titre' })}
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder={t('events.fields.titlePlaceholder', { defaultValue: 'Ex: Audit ISO 27001, Maintenance Serveur...' })}
                                    error={errors.title?.message}
                                />
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div>
                            <div className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('events.fields.startDate', { defaultValue: 'Date de début' })}</div>
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
                            <div className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('events.fields.endDate', { defaultValue: 'Date de fin / Échéance' })}</div>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div>
                                <Controller
                                    name="subType"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            label={t('events.fields.auditType', { defaultValue: "Type d'audit" })}
                                            options={[
                                                { value: "Interne", label: t('events.options.internal', { defaultValue: 'Interne' }) },
                                                { value: "Externe", label: t('events.options.external', { defaultValue: 'Externe' }) },
                                                { value: "Certification", label: t('events.options.certification', { defaultValue: 'Certification' }) }
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
                                            label={t('events.fields.auditor', { defaultValue: 'Auditeur' })}
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    )}

                    {eventType === 'maintenance' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div>
                                <Controller
                                    name="subType"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            label={t('events.fields.maintenanceType', { defaultValue: 'Type de maintenance' })}
                                            options={[
                                                { value: "Préventive", label: t('events.options.preventive', { defaultValue: 'Préventive' }) },
                                                { value: "Corrective", label: t('events.options.corrective', { defaultValue: 'Corrective' }) },
                                                { value: "Mise à jour", label: t('events.options.update', { defaultValue: 'Mise à jour' }) }
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
                                            label={t('events.fields.technician', { defaultValue: 'Technicien' })}
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    )}

                    {/* Linking Section */}
                    <div className="border-t border-border/40 dark:border-border/40 pt-6">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                            <LinkIcon className="h-4 w-4 mr-2 text-brand-500" />
                            {t('events.fields.linkElements', { defaultValue: 'Lier des éléments' })}
                        </h4>

                        <div className="space-y-6">
                            {/* Asset Linking */}
                            <div>
                                <Controller
                                    control={control}
                                    name="linkedAssetIds"
                                    render={({ field }) => (
                                        <CustomSelect
                                            label={t('events.fields.relatedAssets', { defaultValue: 'Actifs concernés' })}
                                            value={field.value}
                                            onChange={field.onChange}
                                            options={assets.map(a => ({ value: a.id, label: a.name }))}
                                            multiple
                                            placeholder={t('events.fields.selectAssets', { defaultValue: 'Sélectionner des actifs...' })}
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
                                            label={t('events.fields.relatedRisks', { defaultValue: 'Risques associés' })}
                                            value={field.value}
                                            onChange={field.onChange}
                                            options={risks.map(r => ({ value: r.id, label: r.threat }))}
                                            multiple
                                            placeholder={t('events.fields.selectRisks', { defaultValue: 'Sélectionner des risques...' })}
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="allDay"
                                className="rounded border-border/40 text-brand-600 focus-visible:ring-primary w-5 h-5"
                                {...register('allDay')}
                            />
                            <label htmlFor="allDay" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">{t('events.fields.allDay', { defaultValue: 'Toute la journée' })}</label>
                        </div>
                        {isGoogleConnected && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="syncGoogle"
                                    checked={syncToGoogle}
                                    onChange={(e) => setSyncToGoogle(e.target.checked)}
                                    className="rounded border-border/40 text-brand-600 focus-visible:ring-primary w-5 h-5"
                                />
                                <label htmlFor="syncGoogle" className="text-sm text-slate-700 dark:text-slate-300 flex items-center cursor-pointer select-none">
                                    {t('events.fields.syncGoogle', { defaultValue: 'Sync Google' })}
                                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-3 h-3 ml-1.5 opacity-70" />
                                </label>
                            </div>
                        )}
                    </div>

                    <div>
                        <Controller
                            name="description"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label={t('events.fields.detailedDescription', { defaultValue: 'Description détaillée' })}
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    textarea
                                    placeholder={t('events.fields.descriptionPlaceholder', { defaultValue: 'Détails supplémentaires...' })}
                                    error={errors.description?.message}
                                />
                            )}
                        />
                    </div>
                </div>

                <div className="pt-6 border-t border-border/40 dark:border-border/40 shrink-0 flex justify-end gap-3 mt-8">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        {t('common.cancel', { defaultValue: 'Annuler' })}
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isSubmitting}
                    >
                        {t('events.create.submit', { defaultValue: 'Créer Événement' })}
                    </Button>
                </div>
            </form>
        </InspectorLayout>
    );
};

export default CreateEventDrawer;
