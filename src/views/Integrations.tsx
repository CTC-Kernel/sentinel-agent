import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { hasPermission } from '../utils/permissions';
import { motion } from 'framer-motion';
import { integrationService, IntegrationProvider } from '../services/integrationService';
import { IntegrationCard } from '../components/integrations/IntegrationCard';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Search, ShieldCheck, Cloud, Code, LayoutGrid, Key } from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { toast } from '@/lib/toast';

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
    const { t } = useTranslation();
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
    const [disconnectTarget, setDisconnectTarget] = useState<IntegrationProvider | null>(null);

    const loadProviders = React.useCallback(async () => {
        if (!user?.organizationId) return;
        try {
            const data = await integrationService.getProviders(user.organizationId);
            setProviders(data);
        } catch {
            toast.error(t('common.errors.loading'));
        } finally {
            setLoading(false);
        }
    }, [user?.organizationId, t]);

    useEffect(() => {
        if (user?.organizationId) {
            loadProviders();
        }
    }, [user?.organizationId, loadProviders]);

    const handleConnect = async (provider: IntegrationProvider) => {
        if (!user?.organizationId) {
            toast.error(t('common.errors.missingOrgId'));
            return;
        }

        if (demoMode) {
            setConnectingId(provider.id);
            try {
                // hasPermission check
                if (!hasPermission(user, 'Integration', 'manage')) throw new Error('Unauthorized');
                await integrationService.connectProvider(provider.id, { credential: 'mock-cred' }, user.organizationId, true);
                setProviders(prev => prev.map(p =>
                    p.id === provider.id ? { ...p, status: 'connected' } : p
                ));
                toast.success(t('integrations.success.demoConnected', { defaultValue: `Connecté à ${provider.name} (Démo)`, provider: provider.name }));
            } catch {
                toast.error(t('common.errors.connecting'));
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
        if (!hasPermission(user, 'Integration', 'manage')) {
            toast.error(t('integrations.errors.noPermission'));
            return;
        }
        if (!apiKey.trim()) {
            toast.error(t('integrations.errors.invalidApiKey'));
            return;
        }

        setIsSubmittingKey(true);
        try {
            await integrationService.connectProvider(selectedProvider.id, { apiKey }, user.organizationId, false);

            setProviders(prev => prev.map(p =>
                p.id === selectedProvider.id ? { ...p, status: 'connected' } : p
            ));
            toast.success(t('integrations.success.connected', { provider: selectedProvider.name }));
            setApiKeyModalOpen(false);
        } catch (error) {
            ErrorLogger.error(error as Error, 'Integrations.confirmConnect');
            toast.error(t('integrations.errors.connectFailed', { provider: selectedProvider.name }));
        } finally {
            setIsSubmittingKey(false);
        }
    };

    const handleDisconnect = async (provider: IntegrationProvider) => {
        if (!user?.organizationId) return;

        setConnectingId(provider.id);
        try {
            await integrationService.disconnectProvider(provider.id, user.organizationId, demoMode);

            // Optimistic update
            setProviders(prev => prev.map(p =>
                p.id === provider.id ? { ...p, status: 'disconnected' } : p
            ));
            toast.success(t('integrations.success.disconnected', { provider: provider.name }));
        } catch {
            toast.error(t('integrations.errors.disconnectFailed'));
        } finally {
            setConnectingId(null);
            setDisconnectTarget(null);
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
            className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24 min-w-0"
        >
            <MasterpieceBackground />
            <SEO title={t('integrations.title')} description={t('integrations.subtitle')} />

            <PageHeader
                title={t('integrations.title')}
                subtitle={t('integrations.subtitle')}
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
                    <Button
                        variant="ghost"
                        aria-label={t('integrations.tabs.providers')}
                        onClick={() => setActiveTab('providers')}
                        className={`relative z-10 px-8 py-2.5 h-auto text-sm font-bold rounded-xl transition-colors duration-300 hover:bg-transparent ${activeTab === 'providers'
                            ? 'text-slate-900 dark:text-white'
                            : 'text-muted-foreground hover:text-slate-900 dark:hover:text-white'
                            }`}
                    >
                        {t('integrations.tabs.providers')}
                    </Button>
                    <Button
                        variant="ghost"
                        aria-label={t('integrations.tabs.jobs')}
                        onClick={() => setActiveTab('jobs')}
                        className={`relative z-10 px-8 py-2.5 h-auto text-sm font-bold rounded-xl transition-colors duration-300 hover:bg-transparent ${activeTab === 'jobs'
                            ? 'text-slate-900 dark:text-white'
                            : 'text-muted-foreground hover:text-slate-900 dark:hover:text-white'
                            }`}
                    >
                        {t('integrations.tabs.jobs')}
                    </Button>
                </div>
            </div>

            {activeTab === 'providers' ? (
                <>
                    {/* Filters & Search - Premium Glass Design */}
                    <div className="flex flex-col md:flex-row gap-4 p-1.5 bg-white/60 dark:bg-slate-950/60 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl backdrop-blur-xl mb-8">
                        <div className="relative flex-1 min-w-0 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-brand-500 transition-colors" />
                            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label={t('integrations.searchPlaceholder')}
                                type="text"
                                placeholder={t('integrations.searchPlaceholder')}
                                className="w-full pl-11 pr-4 py-2.5 bg-transparent rounded-xl border-none focus:ring-0 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
                            />
                        </div>
                        <div className="flex gap-1 overflow-x-auto no-scrollbar items-center pr-1.5 pl-1.5 border-l border-slate-200/50 dark:border-white/5">
                            {[
                                { id: 'all', label: t('integrations.categories.all'), icon: LayoutGrid },
                                { id: 'cloud', label: t('integrations.categories.cloud'), icon: Cloud },
                                { id: 'code', label: t('integrations.categories.code'), icon: Code },
                                { id: 'security', label: t('integrations.categories.security'), icon: ShieldCheck },
                            ].map((cat) => (
                                <Button
                                    key={cat.id || 'unknown'}
                                    variant="ghost"
                                    aria-label={cat.label}
                                    onClick={() => setCategoryFilter(cat.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 ${categoryFilter === cat.id
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg shadow-slate-900/20 dark:shadow-white/20'
                                        : 'text-muted-foreground dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    <cat.icon className="h-3.5 w-3.5 mr-2" />
                                    {cat.label}
                                </Button>
                            ))}
                            {/* N8N Trigger Test Button */}
                            <Button
                                variant="ghost"
                                aria-label="Test N8N"
                                onClick={() => {
                                    toast.promise(integrationService.triggerN8nWorkflow('test-connection', { test: true }, demoMode), {
                                        loading: t('integrations.n8n.testing'),
                                        success: t('integrations.n8n.success'),
                                        error: t('integrations.n8n.error')
                                    });
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/30"
                            >
                                <Cloud className="h-3.5 w-3.5 mr-2" />
                                {t('integrations.testN8n') || 'Test N8N'}
                            </Button>
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
                                    key={provider.id || 'unknown'}
                                    provider={provider}
                                    onConnect={handleConnect}
                                    onDisconnect={(p) => setDisconnectTarget(p)}
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
                            <p className="text-slate-600 dark:text-muted-foreground">
                                {t('integrations.apiKeyModal.description', { provider: selectedProvider?.name })}
                            </p>

                            <div className="space-y-2">
                                <FloatingLabelInput
                                    label={t('integrations.apiKeyModal.label')}
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => {
                                        if (typeof e === 'string') setApiKey(e);
                                        else if (e && e.target) setApiKey(e.target.value);
                                    }}
                                    icon={Key}
                                    placeholder="sk_live_..."
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t('integrations.apiKeyModal.hint')}
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    aria-label={t('integrations.apiKeyModal.cancel') || t('common.cancel')}
                                    onClick={() => setApiKeyModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-white transition-colors"
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    aria-label={t('integrations.apiKeyModal.connectButton')}
                                    onClick={confirmConnect}
                                    disabled={isSubmittingKey || !apiKey.trim()}
                                    isLoading={isSubmittingKey}
                                    className="px-4 py-2 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-lg shadow-lg shadow-brand-500/25 transition-all disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:disabled:border-slate-600 flex items-center gap-2"
                                >
                                    {!isSubmittingKey && t('integrations.apiKeyModal.connectButton')}
                                    {isSubmittingKey && t('integrations.apiKeyModal.connecting')}
                                </Button>
                            </div>
                        </div>
                    </Modal>
                </>
            ) : (
                <ScannerJobs />
            )}

            <ConfirmModal
                isOpen={disconnectTarget !== null}
                onClose={() => setDisconnectTarget(null)}
                onConfirm={() => disconnectTarget && handleDisconnect(disconnectTarget)}
                title={t('integrations.confirm.disconnectTitle')}
                message={t('integrations.confirm.disconnectMessage', { provider: disconnectTarget?.name })}
                type="warning"
                confirmText={t('integrations.confirm.disconnect')}
                cancelText={t('common.cancel')}
            />
        </motion.div>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
