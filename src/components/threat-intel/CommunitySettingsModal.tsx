
import React, { useState, useCallback } from 'react';
import { Shield, Globe, Lock, Users, X, Save, AlertTriangle, Check, UserMinus } from '../ui/Icons';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { SharingPreferences, TrustRelationship } from '../../types';
import { Dialog, Transition } from '@headlessui/react';
import { useSettingsActions } from '../../hooks/settings/useSettingsActions';

// Export mock data for parent use

interface CommunitySettingsModalProps {
 isOpen: boolean;
 onClose: () => void;
 partners: TrustRelationship[];
 onTrustAction: (id: string, action: 'trust' | 'block' | 'remove') => void;
}

export const CommunitySettingsModal: React.FC<CommunitySettingsModalProps> = ({ isOpen, onClose, partners, onTrustAction }) => {
 const { user, addToast, t } = useStore();
 const { saveCommunitySettings } = useSettingsActions();
 const [activeTab, setActiveTab] = useState<'general' | 'network'>('general');

 const [isSubmitting, setIsSubmitting] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');

 // Settings State
 const [settings, setSettings] = useState<SharingPreferences>({
 organizationId: user?.organizationId || '',
 defaultScope: 'community',
 anonymizeIdentity: true,
 autoShareHighSeverity: false
 });

 // Network State is now managed by parent

 // Load settings from Firestore on mount
 React.useEffect(() => {
 if (!user) return;
 const loadSettings = async () => {
 // Implementation of loading settings would go here in a full implementation,
 // for now we'll stick to saving to demonstrate the action.
 // In a real scenario, useFirestoreDocument would be better.
 };
 loadSettings();
 }, [user]);

 const handleScopeChange = useCallback((scope: SharingPreferences['defaultScope']) => {
 setSettings(prev => ({ ...prev, defaultScope: scope }));
 }, []);

 const handleToggleAnonymize = useCallback((e: React.MouseEvent) => {
 e.stopPropagation();
 setSettings(prev => ({ ...prev, anonymizeIdentity: !prev.anonymizeIdentity }));
 }, []);

 const handleToggleAutoShare = useCallback((e: React.MouseEvent) => {
 e.stopPropagation();
 setSettings(prev => ({ ...prev, autoShareHighSeverity: !prev.autoShareHighSeverity }));
 }, []);

 const handleSaveSettings = async () => {
 if (!user) return;
 setIsSubmitting(true);
 try {
 await saveCommunitySettings(settings as unknown as Record<string, unknown>);
 addToast(t('threatIntel.toast.privacySettingsUpdated', { defaultValue: "Paramètres de confidentialité mis à jour" }), "success");
 onClose();
 } catch {
 addToast(t('threatIntel.toast.saveError', { defaultValue: "Erreur lors de la sauvegarde" }), "error");
 } finally {
 setIsSubmitting(false);
 }
 };

  // Keyboard support: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);


 return (
 <Transition.Root show={isOpen} as={React.Fragment}>
 <Dialog as="div" className="relative z-modal" onClose={onClose}>
 <Transition.Child
  as={React.Fragment}
  enter="ease-out duration-300"
  enterFrom="opacity-0"
  enterTo="opacity-100"
  leave="ease-in duration-200"
  leaveFrom="opacity-100"
  leaveTo="opacity-0"
 >
  <div className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] transition-opacity" />
 </Transition.Child>

 <div className="fixed inset-0 z-decorator overflow-y-auto">
  <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
  <Transition.Child
  as={React.Fragment}
  enter="ease-out duration-300"
  enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
  enterTo="opacity-100 translate-y-0 sm:scale-100"
  leave="ease-in duration-200"
  leaveFrom="opacity-100 translate-y-0 sm:scale-100"
  leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
  >
  <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-card border border-white/20 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl flex flex-col max-h-[85vh]">
  {/* Header */}
  <div className="p-6 border-b border-border/40 flex justify-between items-center bg-muted/50">
   <div>
   <Dialog.Title as="h2" className="text-xl font-bold text-foreground flex items-center gap-2">
   <Users className="h-5 w-5 text-primary" />
   {t('threatIntel.communitySettings.title', { defaultValue: 'Gestion de la Communauté' })}
   </Dialog.Title>
   <p className="text-sm text-muted-foreground">{t('threatIntel.communitySettings.subtitle', { defaultValue: 'Confidentialité et Réseau de Confiance' })}</p>
   </div>
   <button type="button" aria-label={t('threatIntel.communitySettings.closeWindow', { defaultValue: 'Fermer la fenêtre' })} onClick={onClose} className="p-2.5 hover:bg-muted/50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
   <X className="h-5 w-5 text-muted-foreground" />
   </button>
  </div>

  {/* Tabs */}
  <div className="flex border-b border-border/40 px-6">
   <button
   type="button"
   role="tab"
   aria-selected={activeTab === 'general'}
   aria-label={t('threatIntel.communitySettings.generalSettingsTab', { defaultValue: 'Onglet Paramètres Généraux' })}
   onClick={() => setActiveTab('general')}
   className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
   >
   {t('threatIntel.communitySettings.generalSettings', { defaultValue: 'Paramètres Généraux' })}
   </button>
   <button
   type="button"
   role="tab"
   aria-selected={activeTab === 'network'}
   aria-label={t('threatIntel.communitySettings.myNetworkTab', { defaultValue: `Onglet Mon Réseau, ${partners.filter(p => p.status === 'trusted').length} partenaires de confiance` })}
   onClick={() => setActiveTab('network')}
   className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'network' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
   >
   {t('threatIntel.communitySettings.myNetwork', { defaultValue: 'Mon Réseau' })} ({partners.filter(p => p.status === 'trusted').length})
   </button>
  </div>

  {/* Content */}
  <div className="flex-1 overflow-y-auto p-6">
   {activeTab === 'general' ? (
   <div className="space-y-6 sm:space-y-8">
   <div className="bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900 p-4 rounded-3xl border border-blue-200 dark:border-blue-800 dark:border-blue-800 flex items-start gap-3">
   <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
   <div className="text-sm text-blue-800 dark:text-blue-300">
    <p className="font-bold mb-1">{t('threatIntel.communitySettings.privacyByDefault', { defaultValue: 'Confidentialité par défaut' })}</p>
    {t('threatIntel.communitySettings.privacyDescription', { defaultValue: 'Sentinel anonymise automatiquement vos soumissions publiques. Seuls vos partenaires de confiance voient votre identité complète.' })}
   </div>
   </div>

   <div className="space-y-6">
   <div>
    <h4 id="sharing-scope-label" className="text-sm font-bold text-foreground mb-2 block">{t('threatIntel.communitySettings.defaultSharingScope', { defaultValue: 'Portée de partage par défaut' })}</h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-labelledby="sharing-scope-label">
    {[
    { id: 'public', label: t('threatIntel.communitySettings.scope.public', { defaultValue: 'Publique (Tout le monde)' }), icon: Globe },
    { id: 'community', label: t('threatIntel.communitySettings.scope.community', { defaultValue: 'Communauté Sentinel (Auth)' }), icon: Users },
    { id: 'trusted_only', label: t('threatIntel.communitySettings.scope.trustedOnly', { defaultValue: 'Partenaires de Confiance' }), icon: Shield },
    { id: 'private', label: t('threatIntel.communitySettings.scope.private', { defaultValue: 'Privé (Interne seulement)' }), icon: Lock },
    ].map((option) => (
    <button
    type="button"
    key={option.id || 'unknown'}
    aria-label={t('threatIntel.communitySettings.setScopeTo', { defaultValue: `Définir la portée sur ${option.label}` })}
    onClick={() => handleScopeChange(option.id as SharingPreferences['defaultScope'])}
    className={`flex items-center gap-3 p-3 rounded-3xl border text-left transition-all ${settings.defaultScope === option.id
     ? 'border-primary bg-primary/10 text-primary dark:text-primary/50 ring-1 ring-primary'
     : 'border-border/40 hover:bg-muted text-foreground'}`}
    >
    <option.icon className="h-5 w-5" />
    <span className="text-sm font-medium">{option.label}</span>
    </button>
    ))}
    </div>
   </div>

   <div className="space-y-3">
    <div className="flex items-center justify-between p-4 rounded-3xl border border-border/40 bg-card">
    <div className="flex items-center gap-3">
    <div className={`p-2 rounded-lg ${settings.anonymizeIdentity ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
    <UserMinus className="h-5 w-5" />
    </div>
    <div>
    <div className="font-medium text-foreground">{t('threatIntel.communitySettings.anonymizeIdentity', { defaultValue: 'Anonymiser mon identité' })}</div>
    <div className="text-xs text-muted-foreground">{t('threatIntel.communitySettings.anonymizeDescription', { defaultValue: 'Votre organisation apparaîtra comme "Anonyme" pour la communauté.' })}</div>
    </div>
    </div>
    <button
    id="toggle-anonymize"
    type="button"
    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${settings.anonymizeIdentity ? 'bg-primary' : 'bg-muted'}`}
    onClick={handleToggleAnonymize}
    aria-pressed={settings.anonymizeIdentity}
    aria-label={t('threatIntel.communitySettings.anonymizeIdentity', { defaultValue: 'Anonymiser mon identité' })}
    >
    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.anonymizeIdentity ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
    </div>

    <div className="flex items-center justify-between p-4 rounded-3xl border border-border/40 bg-card">
    <div className="flex items-center gap-3">
    <div className={`p-2 rounded-lg ${settings.autoShareHighSeverity ? 'bg-red-100 text-red-600' : 'bg-muted text-muted-foreground'}`}>
    <AlertTriangle className="h-5 w-5" />
    </div>
    <div>
    <div className="font-medium text-foreground">{t('threatIntel.communitySettings.autoShareCritical', { defaultValue: 'Partage auto. (Critique)' })}</div>
    <div className="text-xs text-muted-foreground">{t('threatIntel.communitySettings.autoShareDescription', { defaultValue: 'Partager automatiquement les menaces critiques détectées.' })}</div>
    </div>
    </div>
    <button
    id="toggle-autoshare"
    type="button"
    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${settings.autoShareHighSeverity ? 'bg-primary' : 'bg-muted'}`}
    onClick={handleToggleAutoShare}
    aria-pressed={settings.autoShareHighSeverity}
    aria-label={t('threatIntel.communitySettings.autoShareCriticalLabel', { defaultValue: 'Partage automatique pour sévérité critique' })}
    >
    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.autoShareHighSeverity ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
    </div>
   </div>
   </div>
   </div>
   ) : (
   <div className="space-y-4">
   <div className="relative">
   <label htmlFor="search-orgs" className="sr-only">{t('threatIntel.communitySettings.searchOrganization', { defaultValue: 'Rechercher une organisation' })}</label>
   <input
    id="search-orgs"
    type="text"
    placeholder={t('threatIntel.communitySettings.searchPlaceholder', { defaultValue: 'Rechercher une organisation...' })}
    className="w-full px-4 py-2 rounded-3xl border border-border/40 bg-muted text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none"
    aria-label={t('threatIntel.communitySettings.searchOrganization', { defaultValue: 'Rechercher une organisation' })}
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
   />
   </div>

   <div className="space-y-2">
   {partners.filter(p =>
    p.targetOrgName.toLowerCase().includes(searchQuery.toLowerCase())
   ).map(partner => (
    <div key={partner.id || 'unknown'} className="flex items-center justify-between p-4 rounded-3xl border border-border/40 bg-card">
    <div className="flex items-center gap-3">
    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white
    ${partner.status === 'trusted' ? 'bg-green-500' : partner.status === 'blocked' ? 'bg-red-500' : 'bg-muted-foreground'}
    `}>
    {partner.targetOrgName.substring(0, 2).toUpperCase()}
    </div>
    <div>
    <div className="font-bold text-foreground">{partner.targetOrgName}</div>
    <div className="text-xs text-muted-foreground capitalize flex items-center gap-1">
     {partner.status === 'trusted' && <Shield className="h-3 w-3 text-green-500" />}
     Status: {partner.status === 'pending' ? t('threatIntel.communitySettings.status.pending', { defaultValue: 'En attente' }) : partner.status === 'trusted' ? t('threatIntel.communitySettings.status.approved', { defaultValue: 'Approuvé' }) : t('threatIntel.communitySettings.status.blocked', { defaultValue: 'Bloqué' })}
    </div>
    </div>
    </div>
    <div className="flex items-center gap-2">
    {partner.status === 'pending' && (
    <>
     <button type="button" aria-label={t('threatIntel.communitySettings.approvePartner', { defaultValue: 'Approuver le partenaire' })} onClick={() => onTrustAction(partner.id, 'trust')} className="p-2 bg-green-50 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100" title={t('threatIntel.communitySettings.approve', { defaultValue: 'Approuver' })}>
     <Check className="h-4 w-4" />
     </button>
     <button type="button" aria-label={t('threatIntel.communitySettings.blockPartner', { defaultValue: 'Bloquer le partenaire' })} onClick={() => onTrustAction(partner.id, 'block')} className="p-2 bg-red-50 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100" title={t('threatIntel.communitySettings.block', { defaultValue: 'Bloquer' })}>
     <X className="h-4 w-4" />
     </button>
    </>
    )}
    {partner.status === 'trusted' && (
    <button type="button" aria-label={t('threatIntel.communitySettings.revokeTrustStatus', { defaultValue: 'Révoquer le statut de confiance' })} onClick={() => onTrustAction(partner.id, 'remove')} className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30">
     {t('threatIntel.communitySettings.revoke', { defaultValue: 'Révoquer' })}
    </button>
    )}
    {partner.status === 'blocked' && (
    <button type="button" aria-label={t('threatIntel.communitySettings.unblockPartner', { defaultValue: 'Débloquer le partenaire' })} onClick={() => onTrustAction(partner.id, 'trust')} className="px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30">
     {t('threatIntel.communitySettings.unblock', { defaultValue: 'Débloquer' })}
    </button>
    )}
    </div>
    </div>
   ))}
   </div>
   </div>
   )}
  </div>

  {/* Footer */}
  <div className="p-4 border-t border-border/40 bg-muted/50 flex justify-end">
   <Button type="button" onClick={handleSaveSettings} isLoading={isSubmitting} className="bg-primary hover:bg-primary text-primary-foreground">
   <Save className="h-4 w-4 mr-2" />
   {t('threatIntel.communitySettings.save', { defaultValue: 'Enregistrer' })}
   </Button>
  </div>
  </Dialog.Panel>
  </Transition.Child>
  </div>
 </div>
 </Dialog>
 </Transition.Root>
 );
};
