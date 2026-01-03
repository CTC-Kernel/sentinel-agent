import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Handshake, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useStore } from '../../store';
import { toast } from 'sonner';

interface AssignPartnerModalProps {
    isOpen: boolean;
    onClose: () => void;
    auditId: string;
    auditName: string;
    onAssigned: () => void;
}

interface Partner {
    id: string;
    contactEmail: string;
    certifierId?: string;
    tenantName?: string;
}

export const AssignPartnerModal: React.FC<AssignPartnerModalProps> = ({ isOpen, onClose, auditId, auditName, onAssigned }) => {
    const { user } = useStore();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !user?.organizationId) return;

        const loadPartners = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'partnerships'),
                    where('tenantId', '==', user.organizationId),
                    where('status', '==', 'ACTIVE')
                );
                const snap = await getDocs(q);
                setPartners(snap.docs.map(d => ({ id: d.id, ...d.data() } as Partner)));
            } catch (error) {
                console.error('Load partners error', error);
                toast.error('Erreur chargement partenaires');
            } finally {
                setLoading(false);
            }
        };

        loadPartners();
    }, [isOpen, user?.organizationId]);

    const handleAssign = async (partner: { id: string; contactEmail: string; certifierId?: string; tenantName?: string }) => {
        if (!partner.certifierId) {
            toast.error("Ce partenaire n'a pas encore finalisé son compte Certifieur.");
            return;
        }

        setAssigning(partner.id);
        try {
            const assignFn = httpsCallable(functions, 'assignAuditToPartner');
            await assignFn({
                auditId,
                partnerId: partner.certifierId,
                partnerName: partner.tenantName // name of certifier in partnership doc
            });

            toast.success(`Audit assigné à ${partner.contactEmail}`);
            onAssigned();
            onClose();
        } catch (error) {
            console.error('Assign error', error);
            toast.error("Échec de l'assignation");
        } finally {
            setAssigning(null);
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto max-w-lg w-full rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl border border-slate-200 dark:border-white/10">
                    <div className="flex justify-between items-start mb-6">
                        <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Handshake className="w-5 h-5 text-brand-500" />
                            Assigner à un partenaire
                        </Dialog.Title>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                        Sélectionnez un partenaire certifié pour lui donner accès à l'audit <strong>{auditName}</strong> directement sur son portail.
                    </p>

                    {loading ? (
                        <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></div>
                    ) : partners.length === 0 ? (
                        <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                            <p className="text-slate-500 text-sm">Aucun partenaire actif trouvé.</p>
                            <button onClick={onClose} className="mt-2 text-brand-600 text-sm font-medium hover:underline">
                                Gérer les partenaires dans les réglages
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                            {partners.map(partner => (
                                <button
                                    key={partner.id}
                                    onClick={() => handleAssign(partner)}
                                    disabled={!!assigning}
                                    className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center font-bold text-xs">
                                            {partner.contactEmail.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white text-sm">{partner.contactEmail}</p>
                                            <p className="text-xs text-slate-500">Partenaire Certifié</p>
                                        </div>
                                    </div>
                                    {assigning === partner.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                                    ) : (
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-600 text-xs font-medium bg-brand-50 px-2 py-1 rounded">
                                            Assigner
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </Dialog.Panel>
            </div>
        </Dialog>
    );
};
