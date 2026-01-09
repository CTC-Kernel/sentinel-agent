import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Handshake, Loader2, Search, Building2 } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useStore } from '../../store';
import { toast } from '@/lib/toast';

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
    const [searchTerm, setSearchTerm] = useState("");

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
            } catch {
                toast.error('Erreur chargement partenaires');
            } finally {
                setLoading(false);
            }
        };

        loadPartners();
    }, [isOpen, user?.organizationId]);

    const handleAssign = async (partner: Partner) => {
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
                partnerName: partner.tenantName || partner.contactEmail
            });

            toast.success(`Audit assigné à ${partner.contactEmail}`);
            onAssigned();
            onClose();
        } catch {
            toast.error("Échec de l'assignation");
        } finally {
            setAssigning(null);
        }
    };

    const filteredPartners = partners.filter(p =>
        p.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.tenantName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
                            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 text-left align-middle shadow-xl transition-all border border-slate-200 dark:border-white/10">
                                <div className="flex justify-between items-start mb-6">
                                    <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-slate-900 dark:text-white flex items-center gap-2">
                                        <Handshake className="w-5 h-5 text-brand-500" />
                                        Assigner à un partenaire
                                    </Dialog.Title>
                                    <button
                                        onClick={onClose}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="mb-6">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                        Sélectionnez un partenaire certifié pour lui donner accès à l'audit <strong className="text-slate-900 dark:text-white">{auditName}</strong>.
                                    </p>

                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Rechercher un partenaire..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="py-12 flex justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                                    </div>
                                ) : filteredPartners.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                                        <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-600 dark:text-slate-400 font-medium">Aucun partenaire trouvé</p>
                                        {partners.length === 0 && (
                                            <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">
                                                Invitez des partenaires depuis les réglages pour les voir apparaître ici.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                                        {filteredPartners.map(partner => (
                                            <button
                                                key={partner.id}
                                                onClick={() => handleAssign(partner)}
                                                disabled={!!assigning}
                                                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/5 hover:border-brand-500/50 dark:hover:border-brand-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-left group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-500/20">
                                                        {partner.tenantName?.substring(0, 1).toUpperCase() || partner.contactEmail.substring(0, 1).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                                                            {partner.tenantName || partner.contactEmail}
                                                        </h4>
                                                        <p className="text-xs text-slate-500 truncate max-w-[180px]">
                                                            {partner.contactEmail}
                                                        </p>
                                                    </div>
                                                </div>
                                                {assigning === partner.id ? (
                                                    <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
                                                ) : (
                                                    <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg group-hover:bg-brand-50 group-hover:text-brand-600 dark:group-hover:bg-brand-900/30 dark:group-hover:text-brand-400 transition-colors">
                                                        Assigner
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};
