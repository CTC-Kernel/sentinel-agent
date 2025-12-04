import React, { useState, useEffect } from 'react';
import { integrationService, IntegrationProvider } from '../services/integrationService';
import { IntegrationCard } from '../components/integrations/IntegrationCard';
import { Search, ShieldCheck, Cloud, Code, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';

import { useStore } from '../store';

export const Integrations: React.FC = () => {
    const { user, demoMode } = useStore();
    const [providers, setProviders] = useState<IntegrationProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [connectingId, setConnectingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    useEffect(() => {
        loadProviders();
    }, []);

    const loadProviders = async () => {
        try {
            const data = await integrationService.getProviders();
            setProviders(data);
        } catch (error) {
            console.error('Failed to load providers', error);
            toast.error('Erreur lors du chargement des intégrations');
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async (provider: IntegrationProvider) => {
        if (!user?.organizationId) {
            toast.error("Impossible de connecter : ID d'organisation manquant.");
            return;
        }
        setConnectingId(provider.id);
        try {
            // In a real app, this would open a modal for API Key input or OAuth flow
            // For now, we simulate connecting with dummy credentials.
            await integrationService.connectProvider(provider.id, { apiKey: 'mock-key' }, user.organizationId, demoMode);

            // Optimistic update
            setProviders(prev => prev.map(p =>
                p.id === provider.id ? { ...p, status: 'connected' } : p
            ));
            toast.success(`Connecté à ${provider.name} avec succès`);
        } catch (error) {
            toast.error(`Échec de la connexion à ${provider.name}`);
        } finally {
            setConnectingId(null);
        }
    };

    const handleDisconnect = async (provider: IntegrationProvider) => {
        if (!confirm(`Voulez-vous vraiment déconnecter ${provider.name} ?`)) return;

        setConnectingId(provider.id);
        try {
            await integrationService.disconnectProvider(provider.id, demoMode);

            // Optimistic update
            setProviders(prev => prev.map(p =>
                p.id === provider.id ? { ...p, status: 'disconnected' } : p
            ));
            toast.success(`Déconnecté de ${provider.name}`);
        } catch (error) {
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
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white font-display tracking-tight">
                        Intégrations
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
                        Connectez vos outils pour automatiser la collecte de preuves.
                    </p>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/5">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher une intégration..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar px-2 md:px-0 items-center">
                    {[
                        { id: 'all', label: 'Tout', icon: LayoutGrid },
                        { id: 'cloud', label: 'Cloud', icon: Cloud },
                        { id: 'code', label: 'Code', icon: Code },
                        { id: 'security', label: 'Sécurité', icon: ShieldCheck },
                    ].map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setCategoryFilter(cat.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${categoryFilter === cat.id
                                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                        >
                            <cat.icon className="h-4 w-4" />
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        </div>
    );
};
