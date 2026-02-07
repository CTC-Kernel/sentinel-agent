import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useStore } from '../store';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import * as AgentPolicyService from '../services/AgentPolicyService';
import { AgentGroup, AgentPolicy, PolicyConflict } from '../types/agentPolicy';
import { SentinelAgent } from '../types/agent';
import {
 Users, FileCode, AlertTriangle, Shield, RefreshCw,
 CheckCircle2, XCircle, Settings2, Layers
} from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { GroupManager } from '../components/agents/GroupManager';
import { PolicyEditor } from '../components/agents/PolicyEditor';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorLogger } from '../services/errorLogger';
import { hasPermission } from '../utils/permissions';

// Stats card component
interface StatsCardProps {
 title: string;
 value: number | string;
 icon: React.ReactNode;
 variant?: 'default' | 'success' | 'warning' | 'danger';
 subtitle?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
 title,
 value,
 icon,
 variant = 'default',
 subtitle
}) => {
 const variantStyles = {
 default: 'bg-muted/50 text-foreground',
 success: 'bg-success/10 text-success',
 warning: 'bg-warning/10 text-warning',
 danger: 'bg-danger/10 text-danger'
 };

 return (
 <div className="glass-premium rounded-2xl p-4 flex items-center gap-4 border border-border/40 shadow-sm">
 <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${variantStyles[variant]}`}>
 {icon}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
  {title}
 </p>
 <p className="text-2xl font-bold font-display tracking-tight text-foreground">
  {value}
 </p>
 {subtitle && (
  <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
 )}
 </div>
 </div>
 );
};

// Conflict Alert Component
interface ConflictAlertProps {
 conflicts: PolicyConflict[];
 onResolve: (conflict: PolicyConflict) => void;
}

const ConflictAlert: React.FC<ConflictAlertProps> = ({ conflicts, onResolve }) => {
 const { t } = useStore();
 if (conflicts.length === 0) return null;

 return (
 <motion.div
 initial={{ opacity: 0, y: -10 }}
 animate={{ opacity: 1, y: 0 }}
 className="bg-warning/10 border border-warning/20 rounded-xl p-4"
 >
 <div className="flex items-start gap-3">
 <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
 <div className="flex-1 min-w-0">
  <h4 className="text-sm font-semibold text-warning">
  {conflicts.length} {t('agents.policies.conflictsDetected', { defaultValue: 'policy conflict(s) detected', count: conflicts.length })}
  </h4>
  <ul className="mt-2 space-y-1">
  {conflicts.slice(0, 3).map((conflict, index) => (
  <li key={index || 'unknown'} className="text-xs text-muted-foreground flex items-center gap-2">
  <span className="w-1.5 h-1.5 rounded-full bg-warning" />
  <span>
   <strong>{conflict.ruleKey}</strong> : {conflict.values.map(v => v.policyName).join(' vs ')}
  </span>
  <Button
   variant="ghost"
   size="sm"
   className="h-5 text-xs px-2"
   onClick={() => onResolve(conflict)}
  >
   {t('agents.policies.resolve', { defaultValue: 'Résoudre' })}
  </Button>
  </li>
  ))}
  </ul>
  {conflicts.length > 3 && (
  <p className="text-xs text-muted-foreground mt-2">
  {t('agents.policies.moreConflicts', { defaultValue: '+{{count}} more conflict(s)', count: conflicts.length - 3 })}
  </p>
  )}
 </div>
 </div>
 </motion.div>
 );
};

// Loading skeleton
const PoliciesSkeleton: React.FC = () => (
 <div className="flex flex-col gap-6 animate-pulse">
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {[1, 2, 3, 4].map((i) => (
 <div key={i || 'unknown'} className="h-24 bg-muted/50 rounded-2xl" />
 ))}
 </div>
 <div className="h-12 bg-muted/50 rounded-xl w-64" />
 <div className="h-96 bg-muted/50 rounded-2xl" />
 </div>
);

// Main Agent Policies View Component
interface AgentPoliciesProps {
 agents?: SentinelAgent[];
}

export const AgentPolicies: React.FC<AgentPoliciesProps> = ({ agents }) => {
 const { user, t } = useStore();
 const [groups, setGroups] = useState<AgentGroup[]>([]);
 const [policies, setPolicies] = useState<AgentPolicy[]>([]);
 const [conflicts, setConflicts] = useState<PolicyConflict[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [activeTab, setActiveTab] = useState<'groups' | 'policies'>('groups');
 const [isInitialized, setIsInitialized] = useState(false);
 const initInFlightRef = useRef(false);
 const [retryCount, setRetryCount] = useState(0);

 const canReadPolicy = hasPermission(user, 'AgentPolicy', 'read');
 const canUpdatePolicy = hasPermission(user, 'AgentPolicy', 'update');

 // Subscribe to groups and policies
 useEffect(() => {
 if (!user?.organizationId) return;

 const unsubscribers: Array<() => void> = [];

 // Subscribe to groups
 const unsubGroups = AgentPolicyService.subscribeToGroups(
 user.organizationId,
 (groupList: AgentGroup[]) => {
 setGroups(groupList);
 },
 (error: Error) => {
 ErrorLogger.error(error, 'AgentPolicies.subscribeToGroups');
 setError(t('agents.loadError', { defaultValue: 'Erreur de chargement des données' }));
 }
 );
 unsubscribers.push(unsubGroups);

 // Subscribe to policies
 const unsubPolicies = AgentPolicyService.subscribeToPolicies(
 user.organizationId,
 (policyList: AgentPolicy[]) => {
 setPolicies(policyList);
 setLoading(false);
 },
 (error: Error) => {
 ErrorLogger.error(error, 'AgentPolicies.subscribeToPolicies');
 setError(t('agents.loadError', { defaultValue: 'Erreur de chargement des données' }));
 setLoading(false);
 }
 );
 unsubscribers.push(unsubPolicies);

 return () => {
 unsubscribers.forEach(unsub => unsub());
 };
 }, [user?.organizationId, retryCount, t]);

 // Initialize defaults if needed
 useEffect(() => {
 if (loading || isInitialized) return;
 if (initInFlightRef.current) return;

 // Async function to handle initialization
 const initializeIfNeeded = async () => {
 // If we have data, mark as initialized
 if (groups.length > 0 || policies.length > 0) {
 setIsInitialized(true);
 return;
 }

 // Otherwise, initialize defaults
 if (!user?.organizationId) return;

 try {
 await AgentPolicyService.initializeDefaultsIfNeeded(user.organizationId, user.uid);
 setIsInitialized(true);
 } catch (error) {
 initInFlightRef.current = false; // Allow retry
 ErrorLogger.error(error, 'AgentPolicies.initializeDefaults');
 setError(t('agents.loadError', { defaultValue: 'Erreur de chargement des données' }));
 }
 };

 initInFlightRef.current = true;
 initializeIfNeeded();
 }, [user?.organizationId, user?.uid, loading, groups.length, policies.length, isInitialized, t]);

 // Detect policy conflicts
 useEffect(() => {
 const detectConflicts = () => {
 if (!user?.organizationId || policies.length < 2) {
 setConflicts([]);
 return;
 }

 try {
 const detectedConflicts = AgentPolicyService.detectPolicyConflicts(policies);
 setConflicts(detectedConflicts);
 } catch (error) {
 ErrorLogger.error(error, 'AgentPolicies.detectConflicts');
 }
 };

 detectConflicts();
 }, [user?.organizationId, policies]);

 // Handle conflict resolution
 const handleResolveConflict = useCallback((conflict: PolicyConflict) => {
 if (!canUpdatePolicy) return;
 // Navigate to the higher priority policy for editing
 setActiveTab('policies');
 // Could add scroll-to or highlight functionality here
 ErrorLogger.debug(`Resolving conflict: ${conflict.ruleKey}`, 'AgentPolicies.handleResolveConflict');
 }, [canUpdatePolicy]);

 // Compute stats
 const stats = useMemo(() => ({
 totalGroups: groups.length,
 totalPolicies: policies.length,
 activePolicies: policies.filter(p => p.isEnabled).length,
 globalPolicies: policies.filter(p => p.scope === 'global').length,
 groupPolicies: policies.filter(p => p.scope === 'group').length,
 agentPolicies: policies.filter(p => p.scope === 'agent').length,
 deployedPolicies: policies.filter(p => p.lastDeployedAt).length,
 conflictCount: conflicts.length
 }), [groups, policies, conflicts]);

 // Gate the entire view for users without read access
 if (!canReadPolicy && !loading) {
 return (
 <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
 <Shield className="h-12 w-12 text-muted-foreground" />
 <p className="text-lg font-medium">{t('common.accessDenied', { defaultValue: 'Accès refusé' })}</p>
 <p className="text-sm text-muted-foreground">
  {t('agents.policies.noPermission', { defaultValue: 'Vous n\'avez pas les permissions requises pour accéder aux politiques des agents.' })}
 </p>
 </div>
 );
 }

 if (loading) {
 return (
 <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 p-6">
 <PoliciesSkeleton />
 </div>
 );
 }

 if (error) {
 return (
 <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
 <AlertTriangle className="h-12 w-12 text-destructive" />
 <p className="text-lg font-medium">{error}</p>
 <Button onClick={() => {
  setError(null);
  setLoading(true);
  initInFlightRef.current = false;
  setIsInitialized(false);
  setRetryCount(prev => prev + 1);
 }} variant="outline">
  {t('common.retry', { defaultValue: 'Réessayer' })}
 </Button>
 </div>
 );
 }

 return (
 <>
 <motion.div
 variants={staggerContainerVariants}
 initial="initial"
 animate="visible"
 className="flex flex-col gap-6 sm:gap-8"
 >
 {/* Header */}
 <PageHeader
  title={t('agents.policies.title', { defaultValue: 'Politiques des agents' })}
  subtitle={t('agents.policies.subtitle', { defaultValue: 'Configurer les groupes et politiques pour contrôler le comportement des agents' })}
  icon={
  <img alt="IA"
  src="/images/IA.png"
  className="w-full h-full object-contain"
  />
  }
  actions={
  <Button
  variant="outline"
  size="sm"
  className="gap-2"
  onClick={() => {
  setError(null);
  setLoading(true);
  initInFlightRef.current = false;
  setIsInitialized(false);
  setRetryCount(prev => prev + 1);
  }}
  >
  <RefreshCw className="h-4 w-4" />
  <span className="hidden sm:inline">{t('common.refresh', { defaultValue: 'Actualiser' })}</span>
  </Button>
  }
 />

 {/* Stats Cards */}
 <motion.div
  variants={slideUpVariants}
  className="grid grid-cols-2 lg:grid-cols-4 gap-4"
 >
  <StatsCard
  title={t('agents.policies.groups', { defaultValue: 'Groups' })}
  value={stats.totalGroups}
  icon={<Users className="h-5 w-5" />}
  subtitle={t('agents.policies.defaultCount', { defaultValue: '{{count}} default', count: groups.filter(g => g.isDefault).length })}
  />
  <StatsCard
  title={t('agents.policies.policies', { defaultValue: 'Policies' })}
  value={stats.totalPolicies}
  icon={<FileCode className="h-5 w-5" />}
  subtitle={t('agents.policies.activeCount', { defaultValue: '{{count}} active', count: stats.activePolicies })}
  variant={stats.activePolicies > 0 ? 'success' : 'default'}
  />
  <StatsCard
  title={t('agents.policies.deployed', { defaultValue: 'Déployées' })}
  value={stats.deployedPolicies}
  icon={<CheckCircle2 className="h-5 w-5" />}
  variant={stats.deployedPolicies > 0 ? 'success' : 'default'}
  subtitle={t('agents.policies.onAgents', { defaultValue: 'on agents' })}
  />
  <StatsCard
  title={t('agents.policies.conflicts', { defaultValue: 'Conflits' })}
  value={stats.conflictCount}
  icon={stats.conflictCount > 0 ? <XCircle className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
  variant={stats.conflictCount > 0 ? 'danger' : 'success'}
  subtitle={stats.conflictCount > 0 ? t('agents.policies.toResolve', { defaultValue: 'to resolve' }) : t('agents.policies.noConflict', { defaultValue: 'no conflicts' })}
  />
 </motion.div>

 {/* Conflict Alert */}
 <ConflictAlert conflicts={conflicts} onResolve={handleResolveConflict} />

 {/* Policy Scope Distribution */}
 <motion.div
  variants={slideUpVariants}
  className="glass-premium rounded-2xl p-4 border border-border/40 shadow-sm"
 >
  <div className="flex items-center justify-between mb-4">
  <h3 className="text-sm font-semibold text-foreground">{t('agents.policies.distribution', { defaultValue: 'Distribution des politiques' })}</h3>
  <div className="flex items-center gap-4">
  <div className="flex items-center gap-2">
  <div className="w-3 h-3 rounded-full bg-primary" />
  <span className="text-xs text-muted-foreground">{t('agents.policies.global', { defaultValue: 'Globale' })} ({stats.globalPolicies})</span>
  </div>
  <div className="flex items-center gap-2">
  <div className="w-3 h-3 rounded-full bg-warning" />
  <span className="text-xs text-muted-foreground">{t('agents.policies.groups', { defaultValue: 'Groups' })} ({stats.groupPolicies})</span>
  </div>
  <div className="flex items-center gap-2">
  <div className="w-3 h-3 rounded-full bg-success" />
  <span className="text-xs text-muted-foreground">{t('agents.policies.agents', { defaultValue: 'Agents' })} ({stats.agentPolicies})</span>
  </div>
  </div>
  </div>
  <div className="h-2 bg-muted rounded-full overflow-hidden flex">
  {stats.totalPolicies > 0 ? (
  <>
  <div
   className="bg-primary transition-all duration-500"
   style={{ width: `${(stats.globalPolicies / stats.totalPolicies) * 100}%` }}
  />
  <div
   className="bg-warning transition-all duration-500"
   style={{ width: `${(stats.groupPolicies / stats.totalPolicies) * 100}%` }}
  />
  <div
   className="bg-success transition-all duration-500"
   style={{ width: `${(stats.agentPolicies / stats.totalPolicies) * 100}%` }}
  />
  </>
  ) : (
  <div className="bg-muted-foreground/20 w-full" />
  )}
  </div>
 </motion.div>

 {/* Tabs for Groups and Policies */}
 <motion.div variants={slideUpVariants}>
  <Tabs
  value={activeTab}
  onValueChange={(value) => setActiveTab(value as 'groups' | 'policies')}
  className="w-full"
  >
  <TabsList className="w-full sm:w-auto bg-muted/50 p-1 rounded-xl">
  <TabsTrigger
  value="groups"
  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-4 py-2"
  >
  <Layers className="h-4 w-4" />
  <span>{t('agents.policies.groups', { defaultValue: 'Groups' })}</span>
  <Badge variant="soft" className="ml-1">
   {stats.totalGroups}
  </Badge>
  </TabsTrigger>
  <TabsTrigger
  value="policies"
  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-4 py-2"
  >
  <Settings2 className="h-4 w-4" />
  <span>{t('agents.policies.policies', { defaultValue: 'Policies' })}</span>
  <Badge variant="soft" className="ml-1">
   {stats.totalPolicies}
  </Badge>
  </TabsTrigger>
  </TabsList>

  <TabsContent value="groups" key="groups" className="mt-6">
  <GroupManager
  agents={agents}
  onSelectGroup={(groupId: string | null) => {
   ErrorLogger.debug(`Selected group: ${groupId}`, 'AgentPolicies');
  }}
  />
  </TabsContent>

  <TabsContent value="policies" key="policies" className="mt-6">
  <PolicyEditor
  groups={groups}
  onSelectPolicy={(policyId: string | null) => {
   ErrorLogger.debug(`Selected policy: ${policyId}`, 'AgentPolicies');
  }}
  />
  </TabsContent>
  </Tabs>
 </motion.div>

 {/* Inheritance Model Info */}
 <motion.div
  variants={slideUpVariants}
  className="glass-premium rounded-2xl p-6 border border-border/40 shadow-sm"
 >
  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
  <Shield className="h-4 w-4 text-primary" />
  {t('agents.policies.inheritanceModel', { defaultValue: 'Modèle d\'héritage des politiques' })}
  </h3>
  <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
  <div className="flex items-center gap-3">
  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
  <span className="text-sm font-bold">1</span>
  </div>
  <div>
  <p className="text-sm font-medium text-foreground">{t('agents.policies.global', { defaultValue: 'Globale' })}</p>
  <p className="text-xs text-muted-foreground">{t('agents.policies.priorityLow', { defaultValue: 'Priorité basse' })}</p>
  </div>
  </div>
  <div className="hidden sm:block w-8 h-px bg-border" />
  <div className="sm:hidden h-4 w-px bg-border" />
  <div className="flex items-center gap-3">
  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
  <span className="text-sm font-bold">2</span>
  </div>
  <div>
  <p className="text-sm font-medium text-foreground">{t('agents.policies.group', { defaultValue: 'Groupe' })}</p>
  <p className="text-xs text-muted-foreground">{t('agents.policies.priorityMedium', { defaultValue: 'Priorité moyenne' })}</p>
  </div>
  </div>
  <div className="hidden sm:block w-8 h-px bg-border" />
  <div className="sm:hidden h-4 w-px bg-border" />
  <div className="flex items-center gap-3">
  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
  <span className="text-sm font-bold">3</span>
  </div>
  <div>
  <p className="text-sm font-medium text-foreground">{t('agents.policies.agent', { defaultValue: 'Agent' })}</p>
  <p className="text-xs text-muted-foreground">{t('agents.policies.priorityHigh', { defaultValue: 'Priorité haute' })}</p>
  </div>
  </div>
  </div>
  <p className="text-xs text-muted-foreground mt-4">
  {t('agents.policies.inheritanceDesc', { defaultValue: 'Les règles de politique de niveau supérieur écrasent celles de niveau inférieur. Une politique Agent peut désactiver une règle héritée d\'un Groupe.' })}
  </p>
 </motion.div>
 </motion.div>
 </>
 );
};

export default AgentPolicies;
