import React, { useState, useEffect } from 'react';

import { motion } from 'framer-motion';
import { integrationService, IntegrationProvider } from '../services/integrationService';
import { IntegrationCard } from '../components/integrations/IntegrationCard';
import { Modal } from '../components/ui/Modal';
import { Search, ShieldCheck, Cloud, Code, LayoutGrid, Key } from 'lucide-react';
import { toast } from 'sonner';

import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { PageHeader } from '../components/ui/PageHeader';
import { SEO } from '../components/SEO';
import { staggerContainerVariants } from '../components/ui/animationVariants';
import { usePersistedState } from '../hooks/usePersistedState';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';

import { ScannerJobs } from '../components/integrations/ScannerJobs';

export const Integrations: React.FC = () => {
    const { user, demoMode } = useStore();
    const [providers, setProviders] = useState<IntegrationProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [connectingId, setConnectingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [activeTab, setActiveTab] = usePersistedState<'providers' | 'jobs'>('integrations_active_tab', 'providers');

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
                // hasPermission check
                if (user.role !== 'admin' && user.role !== 'project_manager') throw new Error('Unauthorized');
                await integrationService.connectProvider(provider.id, { credential: 'mock-cred' }, user.organizationId, true);
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
        // hasPermission check
        if (!selectedProvider || !user?.organizationId) return;
        if (user.role !== 'admin') {
            toast.error("Seuls les administrateurs peuvent connecter des services.");
            return;
        }
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
            ErrorLogger.error(error as Error, 'Integrations.confirmConnect');
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
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8 min-w-0"
        >
            <MasterpieceBackground />
            <SEO title="Intégrations" description="Connectez vos outils pour automatiser la collecte de preuves" />

            <PageHeader
                title="Intégrations"
                subtitle="Connectez vos outils pour automatiser la collecte de preuves."
                breadcrumbs={[{ label: 'Intégrations' }]}
            />

            {/* Tabs - Premium Segmented Control */}
            <div className="flex justify-center mb-8">
                <div className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl inline-flex relative">
                    <div
                        className="absolute inset-y-1 bg-white dark:bg-slate-700/80 rounded-xl shadow-lg transition-all duration-300 ease-spring"
                        style={{
                            left: activeTab === 'providers' ? '4px' : '50%',
                            width: 'calc(50% - 4px)',
                            transform: activeTab === 'jobs' ? 'translateX(0)' : 'translateX(0)'
                        }}
                    />
                    <button
                        aria-label="Connecteurs"
                        onClick={() => setActiveTab('providers')}
                        className={`relative z-10 px-8 py-2.5 text-sm font-bold rounded-xl transition-colors duration-300 ${activeTab === 'providers'
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        Connecteurs
                    </button>
                    <button
                        aria-label="Tâches & Scans"
                        onClick={() => setActiveTab('jobs')}
                        className={`relative z-10 px-8 py-2.5 text-sm font-bold rounded-xl transition-colors duration-300 ${activeTab === 'jobs'
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        Tâches & Scans
                    </button>
                </div>
            </div>

            {activeTab === 'providers' ? (
                <>
                    {/* Filters & Search - Premium Glass Design */}
                    <div className="flex flex-col md:flex-row gap-4 p-1.5 bg-white/60 dark:bg-slate-950/60 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl backdrop-blur-xl mb-8">
                        <div className="relative flex-1 min-w-0 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label="Rechercher une intégration"
                                type="text"
                                placeholder="Rechercher une intégration..."
                                className="w-full pl-11 pr-4 py-2.5 bg-transparent rounded-xl border-none focus:ring-0 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400"
                            />
                        </div>
                        <div className="flex gap-1 overflow-x-auto no-scrollbar items-center pr-1.5 pl-1.5 border-l border-slate-200/50 dark:border-white/5">
                            {[
                                { id: 'all', label: 'Tout', icon: LayoutGrid },
                                { id: 'cloud', label: 'Cloud', icon: Cloud },
                                { id: 'code', label: 'Code', icon: Code },
                                { id: 'security', label: 'Sécurité', icon: ShieldCheck },
                            ].map((cat) => (
                                <button
                                    key={cat.id}
                                    aria-label={cat.label}
                                    onClick={() => setCategoryFilter(cat.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 ${categoryFilter === cat.id
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg shadow-slate-900/20 dark:shadow-white/20'
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
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
                                <FloatingLabelInput
                                    label="Clé API / Token"
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => {
                                        if (typeof e === 'string') setApiKey(e);
                                        else if (e && e.target) setApiKey(e.target.value);
                                    }}
                                    icon={Key}
                                    placeholder="sk_live_..."
                                />
                                <p className="text-xs text-slate-500">
                                    Cette clé sera stockée de manière sécurisée et utilisée uniquement pour la synchronisation.
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    aria-label="Annuler la connexion"
                                    onClick={() => setApiKeyModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    aria-label="Connecter l'intégration"
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
                </>
            ) : (
                <ScannerJobs />
            )}
        </motion.div>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
