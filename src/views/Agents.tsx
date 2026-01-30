import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingService } from '../services/onboardingService';
import { SEO } from '../components/SEO';
import { useStore } from '../store';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { subscribeToAgents, getAgentComplianceResults } from '../services/AgentService';
import { SentinelAgent, AgentCheckResult } from '../types/agent';
import {
    Download, Settings, Search, LayoutGrid, List, Shield, Package, Layers
} from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Drawer } from '../components/ui/Drawer';
import { AgentFleetDashboard } from '../components/agents/AgentFleetDashboard';
import { AgentHealthGrid } from '../components/agents/AgentHealthGrid';
import { PageHeader } from '../components/ui/PageHeader';
import { AgentComplianceHeatmap } from '../components/agents/AgentComplianceHeatmap';
import { AgentLiveView } from '../components/agents/AgentLiveView';
import AgentPolicies from './AgentPolicies';
import SoftwareInventory from './SoftwareInventory';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { ErrorLogger } from '../services/errorLogger';

// Skeleton for loading state
const AgentsSkeleton: React.FC = () => (
    <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-20 bg-muted/50 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-muted/50 rounded-2xl" />
            ))}
        </div>
        <div className="h-96 bg-muted/50 rounded-2xl" />
    </div>
);


// Main Agents View Component
export const Agents: React.FC = () => {
    const { user } = useStore();
    const navigate = useNavigate();
    const [agents, setAgents] = useState<SentinelAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'offline'>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
    const [selectedAgent, setSelectedAgent] = useState<SentinelAgent | null>(null);
    const [isLiveViewOpen, setIsLiveViewOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [complianceResults, setComplianceResults] = useState<Map<string, AgentCheckResult[]>>(new Map());

    // Handle agent click to open live view
    const handleAgentClick = useCallback((agent: SentinelAgent) => {
        setSelectedAgent(agent);
        setIsLiveViewOpen(true);
    }, []);

    // Handle closing live view
    const handleCloseLiveView = useCallback(() => {
        setIsLiveViewOpen(false);
        setSelectedAgent(null);
    }, []);

    // Subscribe to agents
    useEffect(() => {
        if (!user?.organizationId) return;

        const unsubscribe = subscribeToAgents(
            user.organizationId,
            (agentList) => {
                setAgents(agentList);
                setLoading(false);
            },
            (error) => {
                ErrorLogger.error(error, 'Agents.subscribeToAgents');
                setLoading(false);
            }
        );

        return unsubscribe;
    }, [user?.organizationId]);

    // Load compliance results for heatmap
    useEffect(() => {
        if (!user?.organizationId || agents.length === 0) return;
        getAgentComplianceResults(user.organizationId).then(setComplianceResults).catch(() => {
            // Non-critical, heatmap will show "unknown" states
        });
    }, [user?.organizationId, agents.length]);

    // Start tour
    useEffect(() => {
        const timer = setTimeout(() => {
            OnboardingService.startAgentsTour();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    // Filtered agents
    const filteredAgents = useMemo(() => {
        return agents.filter(agent => {
            const matchesSearch = !searchQuery ||
                agent.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                agent.hostname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                agent.ipAddress?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [agents, searchQuery, statusFilter]);

    if (loading) {
        return (
            <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 p-6">
                <AgentsSkeleton />
            </div>
        );
    }

    return (
        <>
            <MasterpieceBackground />
            <SEO
                title="Agents - Sentinel GRC"
                description="Gestion de la flotte d'agents Sentinel"
                keywords="agents, endpoints, monitoring, compliance"
            />

            <motion.div
                variants={staggerContainerVariants}
                initial="initial"
                animate="visible"
                className="flex flex-col gap-6 sm:gap-8"
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex justify-center mb-6">
                        <TabsList className="bg-muted/50 p-1 rounded-xl" data-tour="agents-tabs">
                            <TabsTrigger value="overview" className="flex items-center gap-2" isLoading={loading}>
                                <Layers className="h-4 w-4" />
                                <span>Supervision</span>
                            </TabsTrigger>
                            <TabsTrigger value="policies" className="flex items-center gap-2" isLoading={loading}>
                                <Shield className="h-4 w-4" />
                                <span>Politiques</span>
                            </TabsTrigger>
                            <TabsTrigger value="software" className="flex items-center gap-2" isLoading={loading}>
                                <Package className="h-4 w-4" />
                                <span>Inventaire Logiciels</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="overview">
                        <motion.div
                            variants={slideUpVariants}
                            className="flex flex-col gap-6 sm:gap-8"
                        >
                            <PageHeader
                                title="Sentinel Agents"
                                subtitle="Gestion et déploiement de la flotte d'agents Sentinel"
                                icon={
                                    <img
                                        src="/images/IA.png"
                                        alt="IA"
                                        className="w-full h-full object-contain"
                                    />
                                }
                                actions={
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            onClick={() => navigate('/settings?tab=agents')}
                                            data-tour="agents-download"
                                        >
                                            <Download className="h-4 w-4" />
                                            <span className="hidden sm:inline">Télécharger Agent</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            onClick={() => setActiveTab('policies')}
                                        >
                                            <Settings className="h-4 w-4" />
                                            <span className="hidden sm:inline">Configuration</span>
                                        </Button>
                                    </div>
                                }
                            />

                            {/* Fleet Dashboard with KPIs, OS Distribution, and Trends */}
                            <div data-tour="agents-stats">
                                <AgentFleetDashboard agents={agents} loading={loading} />
                            </div>

                            {/* Search, Filters, and View Mode */}
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between" data-tour="agents-filters">
                                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                                    <div className="relative flex-1 max-w-md">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Rechercher un agent..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant={statusFilter === 'all' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setStatusFilter('all')}
                                        >
                                            Tous
                                        </Button>
                                        <Button
                                            variant={statusFilter === 'active' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setStatusFilter('active')}
                                            className="gap-1"
                                        >
                                            <span className="w-2 h-2 rounded-full bg-success" />
                                            Actifs
                                        </Button>
                                        <Button
                                            variant={statusFilter === 'offline' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setStatusFilter('offline')}
                                            className="gap-1"
                                        >
                                            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                                            Hors ligne
                                        </Button>
                                    </div>
                                </div>
                                {/* View Mode Toggle */}
                                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                                    <Button
                                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                                        size="sm"
                                        onClick={() => setViewMode('grid')}
                                        className="h-8 w-8 p-0"
                                        title="Vue grille"
                                    >
                                        <LayoutGrid className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant={viewMode === 'compact' ? 'default' : 'ghost'}
                                        size="sm"
                                        onClick={() => setViewMode('compact')}
                                        className="h-8 w-8 p-0"
                                        title="Vue liste"
                                    >
                                        <List className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Agents Health Grid */}
                            <div data-tour="agents-grid">
                                <AgentHealthGrid
                                    agents={filteredAgents}
                                    viewMode={viewMode}
                                    onAgentClick={handleAgentClick}
                                    onAgentAction={(agent, action) => {
                                        if (action === 'view') {
                                            handleAgentClick(agent);
                                        }
                                        // TODO: Handle other agent actions (configure, refresh, delete)
                                        ErrorLogger.debug(`Agent action: ${agent.id} ${action}`, 'Agents');
                                    }}
                                />
                            </div>

                            {/* Compliance Heatmap - Only show when we have agents */}
                            {agents.length > 0 && (
                                <motion.div variants={slideUpVariants}>
                                    <AgentComplianceHeatmap
                                        agents={filteredAgents}
                                        results={complianceResults}
                                        onAgentClick={handleAgentClick}
                                        onCellClick={(agentId, checkId) => {
                                            // Find the agent and open live view
                                            const agent = agents.find(a => a.id === agentId);
                                            if (agent) {
                                                handleAgentClick(agent);
                                            }
                                            ErrorLogger.debug(`Cell clicked: ${agentId} ${checkId}`, 'Agents');
                                        }}
                                    />
                                </motion.div>
                            )}
                        </motion.div>
                    </TabsContent>

                    <TabsContent value="policies" className="mt-0">
                        <AgentPolicies />
                    </TabsContent>

                    <TabsContent value="software" className="mt-0">
                        <SoftwareInventory />
                    </TabsContent>
                </Tabs>
            </motion.div>

            {/* Agent Live View Drawer */}
            <Drawer
                isOpen={isLiveViewOpen}
                onClose={handleCloseLiveView}
                width="max-w-4xl"
                title={selectedAgent ? (selectedAgent.name || selectedAgent.hostname || 'Agent') : 'Agent'}
                subtitle="Monitoring en temps réel"
            >
                {selectedAgent && (
                    <AgentLiveView
                        agent={selectedAgent}
                        onClose={handleCloseLiveView}
                        className="h-full"
                    />
                )}
            </Drawer>
        </>
    );
};

export default Agents;
