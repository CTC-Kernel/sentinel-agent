import React, { useState, useEffect } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useStore } from '../../store';
import { Handshake, Plus, Mail, Loader2, Building2, Clock, Trash2, AlertTriangle, ShieldCheck } from '../ui/Icons';
import { toast } from '@/lib/toast';
import { ErrorLogger } from '../../services/errorLogger';
import { ConfirmModal } from '../ui/ConfirmModal';
import { AnimatePresence, motion } from 'framer-motion';
import { hasPermission } from '../../utils/permissions';

interface Partner {
 id: string;
 contactEmail: string;
 status: 'PENDING' | 'ACTIVE';
 certifierId?: string;
 invitedAt: string;
 tenantId: string;
 tenantName?: string;
}

export const PartnerManagement: React.FC = () => {
 const { t } = useLocale();
 const { user } = useStore();
 const [partners, setPartners] = useState<Partner[]>([]);
 const [loading, setLoading] = useState(true);
 const [isInviteOpen, setIsInviteOpen] = useState(false);
 const [inviting, setInviting] = useState(false);
 const [permissionError, setPermissionError] = useState(false);

 // Revoke/Delete state
 const [partnerToDelete, setPartnerToDelete] = useState<Partner | null>(null);

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
 setPermissionError(false);
 },
 (error) => {
 if (error.code === 'permission-denied') {
  setPermissionError(true);
 } else {
  ErrorLogger.handleErrorWithToast(error, 'PartnerManagement.fetch');
 }
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
 toast.success(t('certifier.partners.inviteSent') || 'Invitation envoyée avec succès !');
 setIsInviteOpen(false);
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'PartnerManagement.invite');
 } finally {
 setInviting(false);
 }
 };

 const confirmDelete = async () => {
 if (!partnerToDelete) return;

 // SECURITY: Check authorization - only admin/rssi can manage partners
 if (!hasPermission(user, 'Partner', 'delete')) {
 ErrorLogger.warn('Unauthorized partner deletion attempt', 'PartnerManagement.delete', {
 metadata: { attemptedBy: user?.uid, targetPartnerId: partnerToDelete.id }
 });
 toast.error(t('certifier.partners.deletePermissionError') || "Vous n'avez pas les droits pour retirer ce partenaire");
 setPartnerToDelete(null);
 return;
 }

 // SECURITY: Verify partner belongs to user's organization (IDOR protection)
 if (partnerToDelete.tenantId !== user?.organizationId) {
 ErrorLogger.warn('IDOR attempt: partner deletion across organizations', 'PartnerManagement.delete', {
 metadata: { attemptedBy: user?.uid, targetPartnerId: partnerToDelete.id, targetOrg: partnerToDelete.tenantId, callerOrg: user?.organizationId }
 });
 toast.error(t('certifier.partners.notFound') || "Partenaire non trouvé");
 setPartnerToDelete(null);
 return;
 }

 try {
 // If it's just a doc within the partnerships collection, we can delete it directly if rules allow.
 // Otherwise, we might need a cloud function 'revokePartner'.
 // Assuming direct delete per rules for 'manage' permissions.
 await deleteDoc(doc(db, 'partnerships', partnerToDelete.id));
 toast.success(t('certifier.partners.removed') || 'Partenaire retiré avec succès');
 setPartnerToDelete(null);
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'PartnerManagement.delete');
 }
 };

 if (permissionError) {
 return (
 <div className="flex flex-col items-center justify-center p-12 text-center bg-red-50 dark:bg-red-50 dark:bg-red-900 rounded-2xl border border-red-100 dark:border-red-900/30">
 <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
  <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
 </div>
 <h3 className="text-xl font-bold text-red-900 dark:text-red-300 mb-2">{t('settings.partners.accessRestricted', { defaultValue: 'Accès restreint' })}</h3>
 <p className="text-red-700 dark:text-red-400 max-w-md">
  {t('settings.partners.accessRestrictedDesc', { defaultValue: "Vous n'avez pas les permissions nécessaires pour gérer les partenaires. Veuillez contacter votre administrateur ou le support pour vérifier votre plan et vos accès." })}
 </p>
 </div>
 );
 }

 if (loading) {
 return (
 <div className="p-12 flex justify-center">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 </div>
 );
 }

 return (
 <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
 {/* Header Section */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-premium rounded-2xl border border-border/40 shadow-sm">
 <div>
  <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 dark:from-foreground dark:to-muted-foreground bg-clip-text text-transparent flex items-center gap-3">
  <Handshake className="w-8 h-8 text-primary" />
  {t('certifier.partners.title') || "Partenaires Certifiés"}
  </h2>
  <p className="text-muted-foreground mt-2 max-w-2xl">
  {t('certifier.partners.description') || "Connectez votre organisation avec des auditeurs certifiés pour faciliter vos audits externes et certifications."}
  </p>
 </div>
 <button
  onClick={() => setIsInviteOpen(true)}
  className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95"
 >
  <Plus className="w-5 h-5" />
  {t('certifier.partners.inviteButton') || "Inviter un partenaire"}
 </button>
 </div>

 {/* Partners List */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
 <AnimatePresence>
  {partners.length === 0 ? (
  <motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  className="col-span-full"
  >
  <div className="text-center py-16 bg-card rounded-3xl border border-dashed border-border/40 flex flex-col items-center">
  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6 shadow-inner">
   <Building2 className="w-10 h-10 text-muted-foreground" />
  </div>
  <h3 className="text-xl font-bold text-foreground mb-2">
   {t('certifier.partners.noPartners') || "Aucun partenaire connectée"}
  </h3>
  <p className="text-muted-foreground max-w-sm mx-auto mb-8">
   {t('certifier.partners.noPartnersDesc') || "Invitez votre premier auditeur ou cabinet de conseil pour commencer la collaboration."}
  </p>
  <button
   onClick={() => setIsInviteOpen(true)}
   className="px-6 py-2 bg-muted hover:bg-muted text-foreground rounded-3xl font-medium transition-colors"
  >
   {t('settings.partners.inviteNow', { defaultValue: 'Inviter maintenant' })}
  </button>
  </div>
  </motion.div>
  ) : (
  partners.map((partner, index) => (
  <motion.div
  key={partner.id || 'unknown'}
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.1 }}
  className="group bg-card p-6 rounded-2xl border border-border/40 dark:border-white/5 hover:border-primary/40 dark:hover:border-primary/40 shadow-sm hover:shadow-xl hover:shadow-primary/25 transition-all duration-300 relative overflow-hidden"
  >
  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-70 transition-opacity z-10">
   <button
   onClick={() => setPartnerToDelete(partner)}
   className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-lg transition-colors"
   title={t('settings.partners.removePartner', { defaultValue: 'Retirer ce partenaire' })}
   >
   <Trash2 className="w-4 h-4" />
   </button>
  </div>

  <div className="flex items-start gap-4 mb-4">
   <div className={`w-12 h-12 rounded-3xl flex items-center justify-center flex-shrink-0 ${partner.status === 'ACTIVE'
   ? 'bg-gradient-to-br from-success-500 to-success-600 text-white shadow-lg shadow-success-500/20'
   : 'bg-gradient-to-br from-warning-400 to-warning-500 text-white shadow-lg shadow-warning-500/20'
   }`}>
   {partner.status === 'ACTIVE' ? <ShieldCheck className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
   </div>
   <div className="flex-1 min-w-0">
   <h4 className="font-bold text-foreground truncate" title={partner.contactEmail}>
   {partner.tenantName || partner.contactEmail}
   </h4>
   <div className="flex items-center gap-2 mt-1">
   <span className={`text-[11px] uppercase font-bold px-2 py-0.5 rounded-full ${partner.status === 'ACTIVE'
   ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
   : 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400'
   }`}>
   {partner.status === 'ACTIVE' ? t('settings.partners.statusActive', { defaultValue: 'Partenaire Actif' }) : t('settings.partners.statusPending', { defaultValue: 'Invitation envoyée' })}
   </span>
   </div>
   </div>
  </div>

  <div className="space-y-3">
   <div className="flex items-center gap-2 text-sm text-muted-foreground">
   <Mail className="w-4 h-4 text-muted-foreground" />
   <span className="truncate">{partner.contactEmail}</span>
   </div>

   {partner.status === 'ACTIVE' && (
   <div className="p-3 bg-muted/50 rounded-3xl text-xs text-muted-foreground border border-border/40 dark:border-white/5">
   <span className="font-medium text-foreground text-muted-foreground">{t('settings.partners.certifierId', { defaultValue: 'ID Certifieur' })}:</span>
   <code className="ml-2 px-1 py-0.5 bg-white dark:bg-black/20 rounded border border-border/40 font-mono">
   {partner.certifierId?.substring(0, 12)}...
   </code>
   </div>
   )}

   {partner.status === 'PENDING' && (
   <button className="w-full mt-2 py-2 text-sm text-primary hover:text-primary hover:bg-primary/10 dark:hover:bg-primary rounded-lg transition-colors border border-dashed border-primary/30 dark:border-primary">
   {t('certifier.partners.resendInvite') || "Renvoyer l'invitation"}
   </button>
   )}
  </div>
  </motion.div>
  ))
  )}
 </AnimatePresence>
 </div>

 {/* Invite Modal */}
 <AnimatePresence>
 {isInviteOpen && (
  <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
  <motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="absolute inset-0 bg-black/40 backdrop-blur-sm"
  onClick={() => setIsInviteOpen(false)}
  />
  <motion.div
  initial={{ scale: 0.95, opacity: 0, y: 20 }}
  animate={{ scale: 1, opacity: 1, y: 0 }}
  exit={{ scale: 0.95, opacity: 0, y: 20 }}
  className="bg-card rounded-2xl w-full max-w-md p-6 shadow-2xl border border-border/40 relative z-10"
  >
  <h3 className="text-xl font-bold mb-2 text-foreground">
  {t('certifier.partners.modalTitle') || "Inviter un partenaire"}
  </h3>
  <p className="text-sm text-muted-foreground mb-6">
  {t('settings.partners.modalDescription', { defaultValue: 'Le partenaire recevra un email pour rejoindre votre espace. Il devra posséder un compte Sentinel GRC "Certifieur".' })}
  </p>

  <form onSubmit={handleInvite} className="space-y-4">
  <div>
   <label className="block text-sm font-medium mb-1.5 text-foreground text-muted-foreground">
   {t('certifier.partners.emailLabel') || "Email du contact principal"}
   </label>
   <div className="relative group">
   <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
   <input
   name="email"
   type="email"
   required
   placeholder="contact@cabinet-audit.com"
   className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border/40 rounded-3xl focus:ring-2 focus-visible:ring-primary focus:border-transparent outline-none transition-all"
   />
   </div>
  </div>

  <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border/40 dark:border-white/5">
   <button
   type="button"
   onClick={() => setIsInviteOpen(false)}
   className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-3xl transition-colors text-sm font-medium"
   >
   {t('certifier.partners.cancel') || "Annuler"}
   </button>
   <button
   type="submit"
   disabled={inviting}
   className="btn-primary flex items-center gap-2"
   >
   {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
   {t('certifier.partners.send') || "Envoyer l'invitation"}
   </button>
  </div>
  </form>
  </motion.div>
  </div>
 )}
 </AnimatePresence>

 <ConfirmModal
 isOpen={!!partnerToDelete}
 onClose={() => setPartnerToDelete(null)}
 onConfirm={confirmDelete}
 title={t('settings.partners.confirmRemoveTitle', { defaultValue: 'Retirer ce partenaire ?' })}
 message={t('settings.partners.confirmRemoveMessage', { defaultValue: `Êtes-vous sûr de vouloir retirer l'accès à ${partnerToDelete?.contactEmail} ? Cette action révoquera immédiatement tous les accès aux audits partagés.` })}
 confirmText={t('settings.partners.confirmRemoveButton', { defaultValue: "Retirer l'accès" })}
 type="danger"
 />
 </div>
 );
};
