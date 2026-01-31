import React, { useState, useEffect } from 'react';
import { Handshake, Loader2, Search, Building2 } from '../ui/Icons';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useStore } from '../../store';
import { toast } from '@/lib/toast';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/button';

interface AssignPartnerDrawerProps {
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

export const AssignPartnerDrawer: React.FC<AssignPartnerDrawerProps> = ({ isOpen, onClose, auditId, auditName, onAssigned }) => {
    const { user, t } = useStore();
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
                toast.error(t('audits.toast.partnersLoadError', { defaultValue: 'Erreur chargement partenaires' }));
            } finally {
                setLoading(false);
            }
        };

        loadPartners();
    }, [isOpen, user?.organizationId, t]);

    const handleAssign = async (partner: Partner) => {
        if (!partner.certifierId) {
            toast.error(t('audits.toast.partnerNotFinalized', { defaultValue: "Ce partenaire n'a pas encore finalisé son compte Certifieur." }));
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

            toast.success(t('audits.toast.auditAssigned', { defaultValue: `Audit assigné à ${partner.contactEmail}`, email: partner.contactEmail }));
            onAssigned();
            onClose();
        } catch {
            toast.error(t('audits.toast.assignmentFailed', { defaultValue: "Échec de l'assignation" }));
        } finally {
            setAssigning(null);
        }
    };

    const filteredPartners = partners.filter(p =>
        p.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.tenantName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title="Assigner à un partenaire"
            subtitle={`Sélectionnez un partenaire certifié pour lui donner accès à l'audit "${auditName}".`}
            width="max-w-md"
        >
            <div className="flex flex-col h-full pt-6 px-1">
                <div className="mb-6 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Rechercher un partenaire..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-border/40 dark:border-border/40 rounded-3xl text-sm focus:ring-2 focus-visible:ring-brand-500 outline-none transition-all"
                    />
                </div>

                {loading ? (
                    <div className="flex-1 flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                    </div>
                ) : filteredPartners.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-border/40 dark:border-border/40">
                        <Building2 className="w-10 h-10 text-slate-300 mb-3" />
                        <p className="text-slate-600 dark:text-muted-foreground font-medium">Aucun partenaire trouvé</p>
                        {partners.length === 0 && (
                            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                                Invitez des partenaires depuis les réglages pour les voir apparaître ici.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-6">
                        {filteredPartners.map(partner => (
                            <button
                                key={partner.id || 'unknown'}
                                onClick={() => handleAssign(partner)}
                                disabled={!!assigning}
                                className="w-full flex items-center justify-between p-4 rounded-3xl border border-border/40 dark:border-white/5 hover:border-brand-400 dark:hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-left group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-500/20 shrink-0">
                                        <Handshake className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                                            {partner.tenantName || partner.contactEmail}
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-300 truncate">
                                            {partner.contactEmail}
                                        </p>
                                    </div>
                                </div>
                                {assigning === partner.id ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-brand-600 ml-3 shrink-0" />
                                ) : (
                                    <span className="ml-3 shrink-0 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg group-hover:bg-brand-50 group-hover:text-brand-600 dark:group-hover:bg-brand-900 dark:group-hover:text-brand-400 transition-colors">
                                        Assigner
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                <div className="pt-6 border-t border-border/40 dark:border-border/40 shrink-0">
                    <Button variant="ghost" onClick={onClose} className="w-full">
                        Annuler
                    </Button>
                </div>
            </div>
        </Drawer>
    );
};
