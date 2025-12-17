import React, { useState, useEffect } from 'react';
import { integrationService, IntegrationProvider } from '../services/integrationService';
import { IntegrationCard } from '../components/integrations/IntegrationCard';
import { Modal } from '../components/ui/Modal';
import { Search, ShieldCheck, Cloud, Code, LayoutGrid, Key } from 'lucide-react';
import { toast } from 'sonner';

import { useStore } from '../store';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';

export const Integrations: React.FC = () => {
    const { user, demoMode } = useStore();
    const [providers, setProviders] = useState<IntegrationProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [connectingId, setConnectingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    // Modal State
    const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);
    const [apiKey, setApiKey] = useState('');
    const [isSubmittingKey, setIsSubmittingKey] = useState(false);

    const loadProviders = React.useCallback(async () => {
        if (!user?.organizationId) return;
        try {
            const data = await integrationService.getProviders(user.organizationId);
            setProviders(data);
        } catch {
            toast.error('Erreur lors du chargement des intégrations');
        } finally {
            setLoading(false);
        }
    }, [user?.organizationId]);

    useEffect(() => {
        if (user?.organizationId) {
            loadProviders();
        }
    }, [user?.organizationId, loadProviders]);



    const handleConnect = async (provider: IntegrationProvider) => {
        if (!user?.organizationId) {
            toast.error("Impossible de connecter : ID d'organisation manquant.");
            return;
        }

        if (demoMode) {
            setConnectingId(provider.id);
            try {
                await integrationService.connectProvider(provider.id, { apiKey: 'mock-key' }, user.organizationId, true);
                setProviders(prev => prev.map(p =>
                    p.id === provider.id ? { ...p, status: 'connected' } : p
                ));
                toast.success(`Connecté à ${provider.name} (Démo)`);
            } catch {
                toast.error("Erreur de connexion simulée");
            } finally {
                setConnectingId(null);
            }
            return;
        }

        // Open Modal for Real Connection
        setSelectedProvider(provider);
        setApiKey('');
        setApiKeyModalOpen(true);
    };

    const confirmConnect = async () => {
        if (!selectedProvider || !user?.organizationId) return;
        if (!apiKey.trim()) {
            toast.error("Veuillez saisir une clé API valide.");
            return;
        }

        setIsSubmittingKey(true);
        try {
            await integrationService.connectProvider(selectedProvider.id, { apiKey }, user.organizationId, false);

            setProviders(prev => prev.map(p =>
                p.id === selectedProvider.id ? { ...p, status: 'connected' } : p
            ));
            toast.success(`Connecté à ${selectedProvider.name} avec succès`);
            setApiKeyModalOpen(false);
        } catch (error) {
            console.error(error);
            toast.error(`Échec de la connexion à ${selectedProvider.name}`);
        } finally {
            setIsSubmittingKey(false);
        }
    };

    const handleDisconnect = async (provider: IntegrationProvider) => {
        if (!confirm(`Voulez-vous vraiment déconnecter ${provider.name} ?`)) return;
        if (!user?.organizationId) return;

        setConnectingId(provider.id);
        try {
            await integrationService.disconnectProvider(provider.id, user.organizationId, demoMode);

            // Optimistic update
            setProviders(prev => prev.map(p =>
                p.id === provider.id ? { ...p, status: 'disconnected' } : p
            ));
            toast.success(`Déconnecté de ${provider.name}`);
        } catch {
            toast.error(`Erreur lors de la déconnexion`);
        } finally {
            setConnectingId(null);
        }
    };

    const filteredProviders = providers.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="p-6 md:p-8 max-w-[1920px] mx-auto space-y-8 pb-20 relative min-h-screen animate-fade-in min-w-0">
            <MasterpieceBackground />
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0 mb-6">
                <div className="min-w-0">
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white font-display tracking-tight">
                        Intégrations
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                        Connectez vos outils pour automatiser la collecte de preuves.
                    </p>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-3 p-1 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/5 min-w-0 backdrop-blur-sm mb-6">
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Rechercher une intégration..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-transparent rounded-lg border-none focus:ring-0 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                    />
                </div>
                <div className="flex gap-1 overflow-x-auto no-scrollbar items-center pr-1">
                    {[
                        { id: 'all', label: 'Tout', icon: LayoutGrid },
                        { id: 'cloud', label: 'Cloud', icon: Cloud },
                        { id: 'code', label: 'Code', icon: Code },
                        { id: 'security', label: 'Sécurité', icon: ShieldCheck },
                    ].map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setCategoryFilter(cat.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${categoryFilter === cat.id
                                ? 'bg-white dark:bg-brand-500 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-0'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5'
                                }`}
                        >
                            <cat.icon className="h-3.5 w-3.5" />
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredProviders.map((provider) => (
                        <IntegrationCard
                            key={provider.id}
                            provider={provider}
                            onConnect={handleConnect}
                            onDisconnect={handleDisconnect}
                            isConnecting={connectingId === provider.id}
                        />
                    ))}
                </div>
            )}


            {/* API Key Modal */}
            <Modal
                isOpen={apiKeyModalOpen}
                onClose={() => setApiKeyModalOpen(false)}
                title={`Connecter ${selectedProvider?.name}`}
                maxWidth="max-w-md"
            >
                <div className="space-y-6 pt-2">
                    <p className="text-slate-600 dark:text-slate-400">
                        Veuillez saisir votre clé API (ou Token) pour permettre à Sentinel GRC d'accéder aux données de <strong>{selectedProvider?.name}</strong>.
                    </p>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Clé API / Token
                        </label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk_live_..."
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                            />
                        </div>
                        <p className="text-xs text-slate-500">
                            Cette clé sera stockée de manière sécurisée et utilisée uniquement pour la synchronisation.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={() => setApiKeyModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={confirmConnect}
                            disabled={isSubmittingKey || !apiKey.trim()}
                            className="px-4 py-2 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-lg shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmittingKey ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Connexion...
                                </>
                            ) : (
                                'Connecter l\'intégration'
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </div >
    );
};
