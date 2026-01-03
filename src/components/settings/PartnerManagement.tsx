import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useStore } from '../../store';
import { Handshake, Plus, Mail, Loader2, Building2, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorLogger } from '../../services/errorLogger';

interface Partner {
    id: string;
    contactEmail: string;
    status: 'PENDING' | 'ACTIVE';
    certifierId?: string;
    invitedAt: string;
    tenantId: string;
}

export const PartnerManagement: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useStore();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }

        const q = query(collection(db, 'partnerships'), where('tenantId', '==', user.organizationId));
        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const parts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Partner));
                setPartners(parts);
                setLoading(false);
            },
            (error) => {
                ErrorLogger.handleErrorWithToast(error, 'PartnerManagement.fetch');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user?.organizationId]);

    const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;

        if (!email) return;

        setInviting(true);
        try {
            const inviteFn = httpsCallable(functions, 'inviteCertifier');
            await inviteFn({ email, message: 'Nous souhaitons vous ajouter comme partenaire de certification sur Sentinel GRC.' });
            toast.success('Invitation envoyée !');
            setIsInviteOpen(false);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'PartnerManagement.invite');
        } finally {
            setInviting(false);
        }
    };

    if (loading) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></div>;

    return (
        <div className="max-w-4xl">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Handshake className="w-6 h-6 text-brand-500" />
                        {t('certifier.partners.title')}
                    </h2>
                    <p className="text-slate-500 mt-1">{t('certifier.partners.description')}</p>
                </div>
                <button
                    onClick={() => setIsInviteOpen(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> {t('certifier.partners.inviteButton')}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {partners.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-white/10">
                        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">{t('certifier.partners.noPartners')}</h3>
                        <p className="text-slate-500">{t('certifier.partners.noPartnersDesc')}</p>
                    </div>
                ) : (
                    partners.map(partner => (
                        <div key={partner.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-white/5 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${partner.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                    {partner.status === 'ACTIVE' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white">{partner.contactEmail}</h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${partner.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                                            {partner.status === 'ACTIVE' ? t('certifier.partners.activePartner') : t('certifier.partners.pendingInvite')}
                                        </span>
                                        {partner.certifierId && <span className="text-xs text-slate-400">ID: {partner.certifierId.substring(0, 8)}...</span>}
                                    </div>
                                </div>
                            </div>

                            {partner.status === 'PENDING' && (
                                <button className="text-sm text-slate-500 hover:text-brand-600 underline">
                                    {t('certifier.partners.resendInvite')}
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Invite Modal */}
            {isInviteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold mb-4">{t('certifier.partners.modalTitle')}</h3>
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('certifier.partners.emailLabel') || "Email du contact"}</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        placeholder={t('certifier.partners.emailPlaceholder')}
                                        className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    {t('certifier.partners.inviteHelp')}
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsInviteOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    {t('certifier.partners.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={inviting}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                    {t('certifier.partners.send')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
