import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import { toast } from '@/lib/toast';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/button';
import { Mail, Link, ShieldCheck, Loader2, Copy, Building, CheckCircle } from '../ui/Icons';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { useStore } from '../../store';

interface ShareAuditDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    auditId: string;
    auditName?: string;
}

const shareSchema = z.object({
    email: z.string().email('Email invalide'),
    organization: z.string().min(2, 'Nom requis'),
    expiryDays: z.number().min(1).max(90)
});

type ShareFormData = z.infer<typeof shareSchema>;

export const ShareAuditDrawer: React.FC<ShareAuditDrawerProps> = ({ isOpen, onClose, auditId, auditName }) => {
    const { t } = useStore();
    const [isLoading, setIsLoading] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<ShareFormData>({
        resolver: zodResolver(shareSchema),
        defaultValues: { expiryDays: 30 }
    });

    const onSubmit = async (data: ShareFormData) => {
        setIsLoading(true);
        try {
            const generateLinkFn = httpsCallable(functions, 'generateAuditShareLink');
            const result = await generateLinkFn({
                auditId,
                auditorEmail: data.email,
                expiryDays: data.expiryDays
            });

            const response = result.data as { success: boolean, link: string, token: string };
            if (response.success) {
                const baseUrl = window.location.origin + '/#';
                setGeneratedLink(`${baseUrl}${response.link}`);
                toast.success(t('audits.share.linkGenerated', { defaultValue: 'Lien généré avec succès' }));
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ShareAuditDrawer.generate', 'LINK_GEN_FAILED');
        } finally {
            setIsLoading(false);
        }
    };

    const copyLink = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success(t('common.linkCopied', { defaultValue: 'Lien copié !' }));
        }
    };

    const handleClose = () => {
        setGeneratedLink(null);
        reset();
        onClose();
    };

    const expiryOptions = [
        { value: '7', label: '7 jours' },
        { value: '15', label: '15 jours' },
        { value: '30', label: '30 jours' },
        { value: '60', label: '60 jours' },
    ];

    return (
        <Drawer
            isOpen={isOpen}
            onClose={handleClose}
            title={t('audits.share.title', { defaultValue: "Partager l'audit" })}
            subtitle={auditName}
            width="max-w-md"
        >
            <div className="p-6 space-y-6">
                {!generatedLink ? (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="bg-brand-50 dark:bg-brand-800 p-4 rounded-3xl border border-brand-100 dark:border-brand-800 flex items-start gap-4">
                            <div className="bg-brand-100 dark:bg-brand-800 p-2 rounded-lg text-brand-600 dark:text-brand-300">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-brand-900 dark:text-brand-100 mb-1">{t('audits.share.externalAccess', { defaultValue: 'Accès Auditeur Externe' })}</h4>
                                <p className="text-sm text-brand-700 dark:text-brand-400 leading-relaxed">
                                    {t('audits.share.externalAccessDesc', { defaultValue: 'Invitez un auditeur externe ou un organisme de certification à accéder à cet audit via un portail sécurisé.' })}
                                </p>
                            </div>
                        </div>

                        <div>
                            <FloatingLabelInput
                                label={t('audits.share.auditorEmail', { defaultValue: "Email de l'auditeur" })}
                                {...register('email')}
                                error={errors.email?.message}
                                icon={Mail}
                                placeholder="auditeur@certif.com"
                            />
                            {errors.email && <span className="text-red-500 text-xs mt-1">{errors.email.message}</span>}
                        </div>

                        <div>
                            <FloatingLabelInput
                                label={t('audits.share.organization', { defaultValue: 'Organisation' })}
                                {...register('organization')}
                                error={errors.organization?.message}
                                icon={Building}
                                placeholder="Ex: Bureau Veritas"
                            />
                            {errors.organization && <span className="text-red-500 text-xs mt-1">{errors.organization.message}</span>}
                        </div>

                        <div className="space-y-2">
                            <CustomSelect
                                options={expiryOptions}
                                value={String(watch('expiryDays'))}
                                onChange={(val) => setValue('expiryDays', Number(val))}
                                label={t('audits.share.accessDuration', { defaultValue: "Durée d'accès" })}
                            />
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <Button type="button" variant="outline" onClick={handleClose}>
                                {t('common.cancel', { defaultValue: 'Annuler' })}
                            </Button>
                            <Button type="submit" disabled={isLoading} className="bg-brand-600 hover:bg-brand-700 text-white">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link className="w-4 h-4 mr-2" />}
                                {t('audits.share.generateLink', { defaultValue: 'Générer le lien' })}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 dark:bg-emerald-800 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-300 shadow-sm">
                                <ShieldCheck className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('audits.share.accessGenerated', { defaultValue: 'Accès sécurisé généré !' })}</h3>
                            <p className="text-sm text-emerald-700 dark:text-emerald-400">
                                {t('audits.share.accessGeneratedDesc', { defaultValue: `Un lien unique a été créé. Partagez-le avec votre auditeur. Ce lien expirera automatiquement dans ${watch('expiryDays')} jours.`, days: watch('expiryDays') })}
                            </p>
                        </div>

                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-brand-500 to-purple-600 rounded-3xl opacity-20 group-hover:opacity-40 blur transition duration-200"></div>
                            <div className="relative flex items-center bg-white dark:bg-slate-900 border border-border/40 dark:border-border/40 rounded-3xl p-1 pr-1.5 shadow-sm">
                                <div className="pl-4 py-3 flex-1 overflow-hidden">
                                    <p className="text-sm font-mono text-slate-600 dark:text-slate-300 truncate select-all">
                                        {generatedLink}
                                    </p>
                                </div>
                                <Button size="sm" onClick={copyLink} className="shrink-0 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 gap-2">
                                    {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                    {copied ? t('common.copied', { defaultValue: 'Copié !' }) : t('common.copy', { defaultValue: 'Copier' })}
                                </Button>
                            </div>
                        </div>

                        <Button onClick={handleClose} variant="outline" className="w-full">
                            {t('common.close', { defaultValue: 'Fermer' })}
                        </Button>
                    </div>
                )}
            </div>
        </Drawer>
    );
};
