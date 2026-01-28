import React, { useState } from 'react';
import { Audit, UserProfile } from '../../types';
import { useAuditsActions } from '../../hooks/audits/useAuditsActions';
import { useStore } from '../../store';
import { Plus, Trash2, User, Mail, Shield, ExternalLink } from '../ui/Icons';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { ErrorLogger } from '../../services/errorLogger';
import { sendEmail } from '../../services/emailService';
import { getAuditInvitationTemplate } from '../../services/emailTemplates';
import { sanitizeData } from '../../utils/dataSanitizer';

interface AuditTeamProps {
    audit: Audit;
    users: UserProfile[];
    canEdit: boolean;
}

export const AuditTeam: React.FC<AuditTeamProps> = ({ audit, users, canEdit }) => {
    const { user, addToast } = useStore();
    const { updateAudit } = useAuditsActions();
    const [isAddingInternal, setIsAddingInternal] = useState(false);
    const [isAddingExternal, setIsAddingExternal] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [externalEmail, setExternalEmail] = useState('');

    // Safe array access
    const safeUsers = users ?? [];

    const handleAddInternal = async () => {
        if (!selectedUserId) return;
        try {
            const currentCollaborators = audit.collaborators || [];
            if (currentCollaborators.includes(selectedUserId)) {
                addToast("Cet utilisateur est déjà dans l'équipe", "info");
                return;
            }

            await updateAudit(audit.id, sanitizeData({
                collaborators: [...currentCollaborators, selectedUserId]
            }));
            addToast("Collaborateur ajouté", "success");
            setIsAddingInternal(false);
            setSelectedUserId('');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'AuditTeam.handleAddInternal', 'UPDATE_FAILED');
        }
    };

    const handleAddExternal = async () => {
        if (!externalEmail) return;
        try {
            const currentExternal = audit.externalAuditors || [];
            if (currentExternal.includes(externalEmail)) {
                addToast("Cet auditeur est déjà invité", "info");
                return;
            }

            await updateAudit(audit.id, sanitizeData({
                externalAuditors: [...currentExternal, externalEmail]
            }));

            // Send invitation email
            await sendEmail(user, {
                to: externalEmail,
                subject: `Invitation à l'audit : ${audit.name}`,
                html: getAuditInvitationTemplate(
                    user?.displayName || 'Un administrateur',
                    audit.name,
                    'Auditeur Externe',
                    `${window.location.origin}/audits?id=${audit.id}` // Assuming this link works or will work
                ),
                type: 'AUDIT_INVITATION'
            });

            addToast("Auditeur externe invité", "success");
            setIsAddingExternal(false);
            setExternalEmail('');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'AuditTeam.handleAddExternal', 'UPDATE_FAILED');
        }
    };

    const handleRemoveInternal = async (userId: string) => {
        try {
            const currentCollaborators = audit.collaborators || [];
            await updateAudit(audit.id, sanitizeData({
                collaborators: currentCollaborators.filter(id => id !== userId)
            }));
            addToast("Collaborateur retiré", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'AuditTeam.handleRemoveInternal', 'UPDATE_FAILED');
        }
    };

    const handleRemoveExternal = async (email: string) => {
        try {
            const currentExternal = audit.externalAuditors || [];
            await updateAudit(audit.id, sanitizeData({
                externalAuditors: currentExternal.filter(e => e !== email)
            }));
            addToast("Auditeur externe retiré", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'AuditTeam.handleRemoveExternal', 'UPDATE_FAILED');
        }
    };

    return (
        <div className="space-y-6 sm:space-y-8">
            {/* Internal Team */}
            <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 tracking-widest flex items-center">
                        <Shield className="h-3.5 w-3.5 mr-2" /> Équipe Interne
                    </h3>
                    {canEdit && !isAddingInternal && (
                        <button onClick={() => setIsAddingInternal(true)} aria-label="Ajouter un membre interne" className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
                            <Plus className="h-3 w-3 mr-1" /> Ajouter
                        </button>
                    )}
                </div>

                {isAddingInternal && (
                    <div className="mb-4 flex gap-2 animate-fade-in">
                        <div className="flex-1">
                            <CustomSelect
                                value={selectedUserId}
                                onChange={val => setSelectedUserId(val as string)}
                                options={safeUsers.filter(u => !audit.collaborators?.includes(u.uid)).map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                                placeholder="Sélectionner un membre..."
                            />
                        </div>
                        <button onClick={handleAddInternal} aria-label="Confirmer l'ajout" className="px-3 bg-brand-600 text-white rounded-3xl font-bold text-xs hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">OK</button>
                        <button onClick={() => setIsAddingInternal(false)} aria-label="Annuler" className="px-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-3xl font-bold text-xs hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">X</button>
                    </div>
                )}

                <div className="space-y-2">
                    {audit.collaborators && audit.collaborators.length > 0 ? (
                        audit.collaborators.map(userId => {
                            const userObj = safeUsers.find(u => u.uid === userId);
                            return (
                                <div key={userId} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-white/5 rounded-3xl">
                                    <div className="flex items-center">
                                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-600 mr-3">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">{userObj?.displayName || 'Utilisateur inconnu'}</div>
                                            <div className="text-xs text-slate-600">{userObj?.email}</div>
                                        </div>
                                    </div>
                                    {canEdit && (
                                        <button onClick={() => handleRemoveInternal(userId)} aria-label={`Retirer ${userObj?.displayName || 'l\'utilisateur'}`} className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-red-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-300 italic">Aucun collaborateur interne.</p>
                    )}
                </div>
            </div>

            {/* External Auditors */}
            <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 tracking-widest flex items-center">
                        <ExternalLink className="h-3.5 w-3.5 mr-2" /> Auditeurs Externes
                    </h3>
                    {canEdit && !isAddingExternal && (
                        <button onClick={() => setIsAddingExternal(true)} aria-label="Inviter un auditeur externe" className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
                            <Plus className="h-3 w-3 mr-1" /> Inviter
                        </button>
                    )}
                </div>

                {isAddingExternal && (
                    <div className="mb-4 flex gap-2 animate-fade-in">
                        <div className="flex-1">
                            <FloatingLabelInput
                                label="Email de l'auditeur"
                                value={externalEmail}
                                onChange={e => setExternalEmail(e.target.value)}
                                type="email"
                            />
                        </div>
                        <button onClick={handleAddExternal} aria-label="Envoyer l'invitation" className="px-3 bg-brand-600 text-white rounded-3xl font-bold text-xs hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">Inviter</button>
                        <button onClick={() => setIsAddingExternal(false)} aria-label="Annuler" className="px-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-3xl font-bold text-xs hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">X</button>
                    </div>
                )}

                <div className="space-y-2">
                    {audit.externalAuditors && audit.externalAuditors.length > 0 ? (
                        audit.externalAuditors.map(email => (
                            <div key={email} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-white/5 rounded-3xl">
                                <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 mr-3">
                                        <Mail className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{email}</div>
                                        <div className="text-xs text-slate-600">Accès restreint</div>
                                    </div>
                                </div>
                                {canEdit && (
                                    <button onClick={() => handleRemoveExternal(email)} aria-label={`Retirer l'auditeur ${email}`} className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-red-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-300 italic">Aucun auditeur externe invité.</p>
                    )}
                </div>
            </div>
        </div>
    );
};
