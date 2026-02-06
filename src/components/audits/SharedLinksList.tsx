import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { Loader2, Trash2, ExternalLink, ShieldAlert, Clock } from '../ui/Icons';
import { toast } from '@/lib/toast';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { formatDistanceToNow } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';
import { ConfirmModal } from '../ui/ConfirmModal';

interface SharedLink {
 id: string; // The token itself is the ID
 auditorEmail: string;
 organizationId: string;
 createdAt: string;
 expiresAt: string;
 revoked: boolean;
 permissions: string[];
}

interface SharedLinksListProps {
 auditId: string;
}

export const SharedLinksList: React.FC<SharedLinksListProps> = ({ auditId }) => {
 const { t } = useStore();
 const { dateFnsLocale } = useLocale();
 const [links, setLinks] = useState<SharedLink[]>([]);
 const [loading, setLoading] = useState(true);
 const [revokingId, setRevokingId] = useState<string | null>(null);
 const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

 const { user } = useStore();

 useEffect(() => {
 const fetchLinks = async () => {
 if (!user?.organizationId) return;
 try {
 const q = query(
  collection(db, 'audit_shares'),
  where('auditId', '==', auditId),
  where('organizationId', '==', user.organizationId),
  // orderBy('createdAt', 'desc') // Requires composite index, doing client sort for MVP safety
 );
 const snapshot = await getDocs(q);
 const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SharedLink));

 // Client-side sort by date desc
 items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

 setLinks(items);
 } catch (error) {
 ErrorLogger.error(error, 'SharedLinksList.fetch');
 } finally {
 setLoading(false);
 }
 };

 fetchLinks();
 }, [auditId, user?.organizationId]);

 const handleRevoke = async (token: string) => {
 setRevokingId(token);
 setConfirmRevokeId(null);
 try {
 const revokeFn = httpsCallable(functions, 'revokeAuditShare');
 await revokeFn({ token });
 toast.success(t('audits.toast.accessRevoked', { defaultValue: 'Accès révoqué avec succès' }));
 // Optimistic update
 setLinks(prev => prev.map(l => l.id === token ? { ...l, revoked: true } : l));
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'SharedLinksList.revoke', 'UPDATE_FAILED');
 } finally {
 setRevokingId(null);
 }
 };

 if (loading) return <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

 if (links.length === 0) return null; // Handled by parent EmptyState normally, but here we render nothing inside the container if empty to avoid double empty states

 return (
 <div className="space-y-3">
 {links.map(link => {
 const isExpired = new Date(link.expiresAt) < new Date();
 const isActive = !link.revoked && !isExpired;

 return (
  <div key={link.id || 'unknown'} className={`flex items-center justify-between p-3 rounded-lg border ${isActive ? 'bg-card border-border/40' : 'bg-muted border-border/40 dark:border-white/5 opacity-75'}`}>
  <div className="flex items-center gap-3">
  <div className={`p-2 rounded-full ${isActive ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
  {link.revoked ? <ShieldAlert className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
  </div>
  <div>
  <p className="text-sm font-medium text-foreground flex items-center gap-2">
   {link.auditorEmail}
   {!isActive && <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">{t('audits.sharedLinks.inactive', { defaultValue: 'Inactif' })}</span>}
  </p>
  <div className="flex items-center gap-3 text-xs text-muted-foreground">
   <span className="flex items-center gap-1">
   <Clock className="w-3 h-3" />
   Expire {formatDistanceToNow(new Date(link.expiresAt), { addSuffix: true, locale: dateFnsLocale })}
   </span>
   {isActive && <span className="text-primary font-mono text-xs select-all">...{link.id.substring(0, 8)}</span>}
  </div>
  </div>
  </div>

  {isActive && (
  <button
  onClick={() => setConfirmRevokeId(link.id)}
  disabled={!!revokingId}
  className="p-2 text-muted-foreground hover:text-red-600 transition-colors"
  title={t('audits.sharedLinks.revokeAccess', { defaultValue: "Révoquer l'accès" })}
  >
  {revokingId === link.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
  </button>
  )}
  </div>
 );
 })}

 <ConfirmModal
 isOpen={confirmRevokeId !== null}
 onClose={() => setConfirmRevokeId(null)}
 onConfirm={() => confirmRevokeId && handleRevoke(confirmRevokeId)}
 title={t('audits.sharedLinks.revokeTitle', { defaultValue: "Révoquer l'accès" })}
 message={t('audits.sharedLinks.revokeMessage', { defaultValue: "Êtes-vous sûr de vouloir révoquer cet accès ? Le lien ne fonctionnera plus immédiatement." })}
 type="warning"
 confirmText={t('audits.sharedLinks.revoke', { defaultValue: 'Révoquer' })}
 cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
 />
 </div>
 );
};
