
import React, { useState } from 'react';
import { doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Shield, Globe, Lock, Users, X, Save, AlertTriangle, Check, UserMinus } from 'lucide-react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { SharingPreferences, TrustRelationship } from '../../types';
import { Dialog, Transition } from '@headlessui/react';

// Export mock data for parent use

interface CommunitySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    partners: TrustRelationship[];
    onTrustAction: (id: string, action: 'trust' | 'block' | 'remove') => void;
}

export const CommunitySettingsModal: React.FC<CommunitySettingsModalProps> = ({ isOpen, onClose, partners, onTrustAction }) => {
    const { user, addToast } = useStore();
    const [activeTab, setActiveTab] = useState<'general' | 'network'>('general');

    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleSaveSettings = async () => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            // Save to user's profile or a specific settings collection
            // Assuming a structure like users/{uid}/settings/community
            // For this specific codebase, we'll save it to a 'user_settings' collection for simplicity/isolation
            // or update the user document itself if that's the pattern.
            // Let's use a subcollection for cleanliness.

            const settingsRef = doc(db, 'users', user.uid, 'settings', 'community');
            const { setDoc } = await import('firebase/firestore'); // Dynamic import to avoid top-level if needed, or just add to imports

            await setDoc(settingsRef, {
                ...settings,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            addToast("Paramètres de confidentialité mis à jour", "success");
            onClose();
        } catch (error) {
            console.error("Error saving settings:", error);
            addToast("Erreur lors de la sauvegarde", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

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
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
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
                            <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-white/20 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl flex flex-col max-h-[85vh]">
                                {/* Header */}
                                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                    <div>
                                        <Dialog.Title as="h2" className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <Users className="h-5 w-5 text-brand-500" />
                                            Gestion de la Communauté
                                        </Dialog.Title>
                                        <p className="text-sm text-slate-500">Confidentialité et Réseau de Confiance</p>
                                    </div>
                                    <button type="button" aria-label="Fermer la fenêtre" onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500">
                                        <X className="h-5 w-5 text-slate-400" />
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b border-slate-200 dark:border-slate-800 px-6">
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === 'general'}
                                        aria-label="Onglet Paramètres Généraux"
                                        onClick={() => setActiveTab('general')}
                                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        Paramètres Généraux
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === 'network'}
                                        aria-label={`Onglet Mon Réseau, ${partners.filter(p => p.status === 'trusted').length} partenaires de confiance`}
                                        onClick={() => setActiveTab('network')}
                                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'network' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        Mon Réseau ({partners.filter(p => p.status === 'trusted').length})
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    {activeTab === 'general' ? (
                                        <div className="space-y-8">
                                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-200 dark:border-blue-800 flex items-start gap-3">
                                                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                                <div className="text-sm text-blue-800 dark:text-blue-300">
                                                    <p className="font-bold mb-1">Confidentialité par défaut</p>
                                                    Sentinel anonymise automatiquement vos soumissions publiques. Seuls vos partenaires de confiance voient votre identité complète.
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div>
                                                    <label className="text-sm font-bold text-slate-900 dark:text-white mb-2 block">Portée de partage par défaut</label>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {[
                                                            { id: 'public', label: 'Publique (Tout le monde)', icon: Globe },
                                                            { id: 'community', label: 'Communauté Sentinel (Auth)', icon: Users },
                                                            { id: 'trusted_only', label: 'Partenaires de Confiance', icon: Shield },
                                                            { id: 'private', label: 'Privé (Interne seulement)', icon: Lock },
                                                        ].map((option) => (
                                                            <button
                                                                type="button"
                                                                key={option.id}
                                                                aria-label={`Définir la portée sur ${option.label}`}
                                                                onClick={() => setSettings({ ...settings, defaultScope: option.id as SharingPreferences['defaultScope'] })}
                                                                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${settings.defaultScope === option.id
                                                                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500'
                                                                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                                            >
                                                                <option.icon className="h-5 w-5" />
                                                                <span className="text-sm font-medium">{option.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-lg ${settings.anonymizeIdentity ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                                                <UserMinus className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-slate-900 dark:text-white">Anonymiser mon identité</div>
                                                                <div className="text-xs text-slate-500">Votre organisation apparaîtra comme "Anonyme" pour la communauté.</div>
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${settings.anonymizeIdentity ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                            onClick={(e) => { e.stopPropagation(); setSettings({ ...settings, anonymizeIdentity: !settings.anonymizeIdentity }); }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault();
                                                                    setSettings({ ...settings, anonymizeIdentity: !settings.anonymizeIdentity });
                                                                }
                                                            }}
                                                            role="button"
                                                            tabIndex={0}
                                                            aria-pressed={settings.anonymizeIdentity}
                                                        >
                                                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.anonymizeIdentity ? 'translate-x-6' : 'translate-x-0'}`} />
                                                        </div>
                                                    </label>

                                                    <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-lg ${settings.autoShareHighSeverity ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                                                                <AlertTriangle className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-slate-900 dark:text-white">Partage auto. (Critique)</div>
                                                                <div className="text-xs text-slate-500">Partager automatiquement les menaces critiques détectées.</div>
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${settings.autoShareHighSeverity ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                            onClick={(e) => { e.stopPropagation(); setSettings({ ...settings, autoShareHighSeverity: !settings.autoShareHighSeverity }); }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault();
                                                                    setSettings({ ...settings, autoShareHighSeverity: !settings.autoShareHighSeverity });
                                                                }
                                                            }}
                                                            role="button"
                                                            tabIndex={0}
                                                            aria-pressed={settings.autoShareHighSeverity}
                                                        >
                                                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.autoShareHighSeverity ? 'translate-x-6' : 'translate-x-0'}`} />
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="relative">
                                                <label htmlFor="search-orgs" className="sr-only">Rechercher une organisation</label>
                                                <input
                                                    id="search-orgs"
                                                    type="text"
                                                    placeholder="Rechercher une organisation..."
                                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                                    aria-label="Rechercher une organisation"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                {partners.map(partner => (
                                                    <div key={partner.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white
                                                            ${partner.status === 'trusted' ? 'bg-green-500' : partner.status === 'blocked' ? 'bg-red-500' : 'bg-slate-400'}
                                                        `}>
                                                                {partner.targetOrgName.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 dark:text-white">{partner.targetOrgName}</div>
                                                                <div className="text-xs text-slate-500 capitalize flex items-center gap-1">
                                                                    {partner.status === 'trusted' && <Shield className="h-3 w-3 text-green-500" />}
                                                                    Status: {partner.status === 'pending' ? 'En attente' : partner.status === 'trusted' ? 'Approuvé' : 'Bloqué'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {partner.status === 'pending' && (
                                                                <>
                                                                    <button type="button" aria-label="Approuver le partenaire" onClick={() => onTrustAction(partner.id, 'trust')} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="Approuver">
                                                                        <Check className="h-4 w-4" />
                                                                    </button>
                                                                    <button type="button" aria-label="Bloquer le partenaire" onClick={() => onTrustAction(partner.id, 'block')} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="Bloquer">
                                                                        <X className="h-4 w-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {partner.status === 'trusted' && (
                                                                <button type="button" aria-label="Révoquer le statut de confiance" onClick={() => onTrustAction(partner.id, 'remove')} className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                                                                    Révoquer
                                                                </button>
                                                            )}
                                                            {partner.status === 'blocked' && (
                                                                <button type="button" aria-label="Débloquer le partenaire" onClick={() => onTrustAction(partner.id, 'trust')} className="px-3 py-1.5 text-xs font-medium text-green-600 border border-green-200 rounded-lg hover:bg-green-50">
                                                                    Débloquer
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
                                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                                    <Button type="button" onClick={handleSaveSettings} isLoading={isSubmitting} className="bg-brand-600 hover:bg-brand-500 text-white">
                                        <Save className="h-4 w-4 mr-2" />
                                        Enregistrer
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
