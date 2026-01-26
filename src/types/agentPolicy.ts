/**
 * Agent Policy Types
 *
 * Types for agent groups, policies, rules, and inheritance model.
 * Supports hierarchical policy inheritance: Global → Group → Agent
 *
 * Sprint 9 - Groups & Policies
 */

import type { AgentOS, AgentConfig } from './agent';

// ============================================================================
// Policy Scope & Inheritance
// ============================================================================

/**
 * Policy scope levels (inheritance order)
 */
export const POLICY_SCOPES = ['global', 'group', 'agent'] as const;
export type PolicyScope = typeof POLICY_SCOPES[number];

/**
 * Policy enforcement mode
 */
export const ENFORCEMENT_MODES = ['enforce', 'audit', 'disabled'] as const;
export type EnforcementMode = typeof ENFORCEMENT_MODES[number];

/**
 * Policy priority (higher = takes precedence)
 */
export const POLICY_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type PolicyPriority = typeof POLICY_PRIORITIES[number];

/**
 * Get priority weight for sorting
 */
export function getPriorityWeight(priority: PolicyPriority): number {
    switch (priority) {
        case 'critical': return 100;
        case 'high': return 75;
        case 'medium': return 50;
        case 'low': return 25;
    }
}

// ============================================================================
// Agent Groups
// ============================================================================

/**
 * Group membership criteria types
 */
export const MEMBERSHIP_CRITERIA_TYPES = [
    'manual',           // Manually assigned
    'os',               // By operating system
    'hostname_pattern', // By hostname regex
    'ip_range',         // By IP address range
    'tag',              // By agent tags
    'department',       // By department
    'location',         // By location
] as const;
export type MembershipCriteriaType = typeof MEMBERSHIP_CRITERIA_TYPES[number];

/**
 * Membership criteria for automatic group assignment
 */
export interface MembershipCriteria {
    /** Criteria type */
    type: MembershipCriteriaType;

    /** Operator for comparison */
    operator: 'equals' | 'contains' | 'matches' | 'in' | 'range';

    /** Value(s) to match */
    value: string | string[];

    /** Is negated (NOT match) */
    negate: boolean;
}

/**
 * Agent group for organizing agents
 */
export interface AgentGroup {
    /** Group ID */
    id: string;

    /** Organization ID */
    organizationId: string;

    /** Group name */
    name: string;

    /** Description */
    description: string;

    /** Parent group ID (for hierarchy) */
    parentGroupId?: string;

    /** Icon name */
    icon: string;

    /** Color (hex) */
    color: string;

    /** Is default group for new agents */
    isDefault: boolean;

    /** Is system group (cannot be deleted) */
    isSystem: boolean;

    /** Membership is dynamic (auto-assigned) */
    isDynamic: boolean;

    /** Membership criteria (if dynamic) */
    membershipCriteria: MembershipCriteria[];

    /** Criteria logic (AND/OR) */
    criteriaLogic: 'and' | 'or';

    /** Agent IDs in this group (if manual) */
    agentIds: string[];

    /** Agent count (cached) */
    agentCount: number;

    /** Policy IDs assigned to this group */
    policyIds: string[];

    /** Sort order */
    sortOrder: number;

    /** Created at */
    createdAt: string;

    /** Updated at */
    updatedAt: string;

    /** Created by */
    createdBy: string;
}

/**
 * Group hierarchy node for tree visualization
 */
export interface GroupHierarchyNode {
    /** Group data */
    group: AgentGroup;

    /** Child groups */
    children: GroupHierarchyNode[];

    /** Depth in hierarchy */
    depth: number;

    /** Path from root */
    path: string[];

    /** Effective policies (inherited + own) */
    effectivePolicyIds: string[];
}

// ============================================================================
// Policy Rules
// ============================================================================

/**
 * Rule categories
 */
export const RULE_CATEGORIES = [
    'monitoring',       // Check intervals, heartbeat
    'security',         // Security checks, firewall
    'compliance',       // Compliance checks
    'reporting',        // Report generation
    'updates',          // Update/patch settings
    'network',          // Network restrictions
    'storage',          // Disk/storage settings
    'logging',          // Log levels, retention
] as const;
export type RuleCategory = typeof RULE_CATEGORIES[number];

/**
 * Rule value types
 */
export const RULE_VALUE_TYPES = [
    'boolean',
    'number',
    'string',
    'string_array',
    'number_range',
    'cron',
    'duration',
] as const;
export type RuleValueType = typeof RULE_VALUE_TYPES[number];

/**
 * Policy rule definition
 */
export interface PolicyRule {
    /** Rule ID */
    id: string;

    /** Rule key (used in config) */
    key: string;

    /** Display name */
    name: string;

    /** Description */
    description: string;

    /** Category */
    category: RuleCategory;

    /** Value type */
    valueType: RuleValueType;

    /** Current value */
    value: unknown;

    /** Default value */
    defaultValue: unknown;

    /** Minimum value (for numbers) */
    minValue?: number;

    /** Maximum value (for numbers) */
    maxValue?: number;

    /** Allowed values (for select) */
    allowedValues?: Array<{ value: unknown; label: string }>;

    /** Unit label (e.g., "seconds", "MB") */
    unit?: string;

    /** Is required */
    isRequired: boolean;

    /** Is inherited (not overridden) */
    isInherited: boolean;

    /** Inherited from (scope + id) */
    inheritedFrom?: {
        scope: PolicyScope;
        policyId: string;
        policyName: string;
    };

    /** Applicable OS (empty = all) */
    applicableOS: AgentOS[];

    /** Requires agent restart */
    requiresRestart: boolean;

    /** Validation regex (for strings) */
    validationPattern?: string;

    /** Validation error message */
    validationMessage?: string;
}

/**
 * Rule template for predefined rules
 */
export interface RuleTemplate {
    /** Template ID */
    id: string;

    /** Rule key */
    key: string;

    /** Display name */
    name: string;

    /** Description */
    description: string;

    /** Category */
    category: RuleCategory;

    /** Value type */
    valueType: RuleValueType;

    /** Default value */
    defaultValue: unknown;

    /** Constraints */
    minValue?: number;
    maxValue?: number;
    allowedValues?: Array<{ value: unknown; label: string }>;
    unit?: string;

    /** Applicable OS */
    applicableOS: AgentOS[];

    /** Requires restart */
    requiresRestart: boolean;
}

// ============================================================================
// Agent Policies
// ============================================================================

/**
 * Agent policy
 */
export interface AgentPolicy {
    /** Policy ID */
    id: string;

    /** Organization ID */
    organizationId: string;

    /** Policy name */
    name: string;

    /** Description */
    description: string;

    /** Scope */
    scope: PolicyScope;

    /** Priority */
    priority: PolicyPriority;

    /** Enforcement mode */
    enforcement: EnforcementMode;

    /** Is enabled */
    isEnabled: boolean;

    /** Is default policy for scope */
    isDefault: boolean;

    /** Target group IDs (if scope = group) */
    targetGroupIds: string[];

    /** Target agent IDs (if scope = agent) */
    targetAgentIds: string[];

    /** Parent policy ID (for inheritance) */
    parentPolicyId?: string;

    /** Rules */
    rules: PolicyRule[];

    /** Schedule for policy application */
    schedule?: PolicySchedule;

    /** Version number */
    version: number;

    /** Last deployed at */
    lastDeployedAt?: string;

    /** Deployment status */
    deploymentStatus: DeploymentStatus;

    /** Agents with pending update */
    pendingAgentCount: number;

    /** Agents successfully updated */
    appliedAgentCount: number;

    /** Created at */
    createdAt: string;

    /** Updated at */
    updatedAt: string;

    /** Created by */
    createdBy: string;

    /** Updated by */
    updatedBy?: string;
}

/**
 * Policy schedule
 */
export interface PolicySchedule {
    /** Schedule type */
    type: 'immediate' | 'scheduled' | 'maintenance_window';

    /** Scheduled time (if scheduled) */
    scheduledAt?: string;

    /** Maintenance window ID (if maintenance_window) */
    maintenanceWindowId?: string;

    /** Timezone */
    timezone: string;
}

/**
 * Deployment status
 */
export const DEPLOYMENT_STATUSES = ['draft', 'pending', 'deploying', 'deployed', 'failed', 'rollback'] as const;
export type DeploymentStatus = typeof DEPLOYMENT_STATUSES[number];

// ============================================================================
// Effective Policy (Resolved Inheritance)
// ============================================================================

/**
 * Effective policy for an agent (after inheritance resolution)
 */
export interface EffectivePolicy {
    /** Agent ID */
    agentId: string;

    /** Agent hostname */
    agentHostname: string;

    /** Resolved rules (merged from all applicable policies) */
    rules: PolicyRule[];

    /** Source policies (in order of application) */
    sourcePolicies: Array<{
        policyId: string;
        policyName: string;
        scope: PolicyScope;
        priority: PolicyPriority;
    }>;

    /** Resulting agent config */
    agentConfig: AgentConfig;

    /** Computed at */
    computedAt: string;

    /** Config hash (for change detection) */
    configHash: string;
}

/**
 * Policy conflict (when rules conflict)
 */
export interface PolicyConflict {
    /** Rule key */
    ruleKey: string;

    /** Rule name */
    ruleName: string;

    /** Conflicting values */
    values: Array<{
        policyId: string;
        policyName: string;
        scope: PolicyScope;
        value: unknown;
    }>;

    /** Resolution (which value wins) */
    resolution: {
        policyId: string;
        value: unknown;
        reason: string;
    };
}

// ============================================================================
// Policy History & Audit
// ============================================================================

/**
 * Policy change types
 */
export const POLICY_CHANGE_TYPES = [
    'created',
    'updated',
    'enabled',
    'disabled',
    'deployed',
    'rollback',
    'deleted',
] as const;
export type PolicyChangeType = typeof POLICY_CHANGE_TYPES[number];

/**
 * Policy history entry
 */
export interface PolicyHistoryEntry {
    /** Entry ID */
    id: string;

    /** Policy ID */
    policyId: string;

    /** Change type */
    changeType: PolicyChangeType;

    /** Version before change */
    previousVersion: number;

    /** Version after change */
    newVersion: number;

    /** Changed rules */
    changedRules: Array<{
        ruleKey: string;
        previousValue: unknown;
        newValue: unknown;
    }>;

    /** Changed by */
    changedBy: string;

    /** Changed at */
    changedAt: string;

    /** Change reason/notes */
    reason?: string;
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Policy statistics
 */
export interface PolicyStats {
    /** Total policies */
    totalPolicies: number;

    /** By scope */
    byScope: Record<PolicyScope, number>;

    /** By status */
    byStatus: Record<DeploymentStatus, number>;

    /** Total groups */
    totalGroups: number;

    /** Agents with custom policies */
    agentsWithCustomPolicies: number;

    /** Pending deployments */
    pendingDeployments: number;

    /** Failed deployments (last 24h) */
    failedDeployments: number;

    /** Calculated at */
    calculatedAt: string;
}

// ============================================================================
// Default Rule Templates
// ============================================================================

/**
 * Default rule templates
 */
export const DEFAULT_RULE_TEMPLATES: RuleTemplate[] = [
    // Monitoring
    {
        id: 'check_interval',
        key: 'check_interval_secs',
        name: 'Intervalle de vérification',
        description: 'Intervalle entre les vérifications de conformité',
        category: 'monitoring',
        valueType: 'number',
        defaultValue: 3600,
        minValue: 60,
        maxValue: 86400,
        unit: 'secondes',
        applicableOS: [],
        requiresRestart: false,
    },
    {
        id: 'heartbeat_interval',
        key: 'heartbeat_interval_secs',
        name: 'Intervalle heartbeat',
        description: 'Intervalle entre les battements de coeur',
        category: 'monitoring',
        valueType: 'number',
        defaultValue: 60,
        minValue: 10,
        maxValue: 300,
        unit: 'secondes',
        applicableOS: [],
        requiresRestart: false,
    },
    // Logging
    {
        id: 'log_level',
        key: 'log_level',
        name: 'Niveau de log',
        description: 'Niveau de verbosité des logs',
        category: 'logging',
        valueType: 'string',
        defaultValue: 'info',
        allowedValues: [
            { value: 'debug', label: 'Debug' },
            { value: 'info', label: 'Info' },
            { value: 'warn', label: 'Warning' },
            { value: 'error', label: 'Error' },
        ],
        applicableOS: [],
        requiresRestart: true,
    },
    // Compliance
    {
        id: 'enabled_checks',
        key: 'enabled_checks',
        name: 'Vérifications activées',
        description: 'Liste des vérifications de conformité à exécuter',
        category: 'compliance',
        valueType: 'string_array',
        defaultValue: ['all'],
        applicableOS: [],
        requiresRestart: false,
    },
    // Storage
    {
        id: 'offline_mode_days',
        key: 'offline_mode_days',
        name: 'Jours en mode hors-ligne',
        description: 'Nombre de jours de rétention des données en mode hors-ligne',
        category: 'storage',
        valueType: 'number',
        defaultValue: 7,
        minValue: 1,
        maxValue: 30,
        unit: 'jours',
        applicableOS: [],
        requiresRestart: false,
    },
    // Security
    {
        id: 'auto_remediation',
        key: 'auto_remediation_enabled',
        name: 'Remédiation automatique',
        description: 'Activer la remédiation automatique des problèmes détectés',
        category: 'security',
        valueType: 'boolean',
        defaultValue: false,
        applicableOS: [],
        requiresRestart: false,
    },
    {
        id: 'realtime_monitoring',
        key: 'realtime_monitoring_enabled',
        name: 'Monitoring temps réel',
        description: 'Activer le monitoring des processus et connexions en temps réel',
        category: 'monitoring',
        valueType: 'boolean',
        defaultValue: true,
        applicableOS: [],
        requiresRestart: true,
    },
    // Updates
    {
        id: 'auto_update',
        key: 'auto_update_enabled',
        name: 'Mise à jour automatique',
        description: 'Activer la mise à jour automatique de l\'agent',
        category: 'updates',
        valueType: 'boolean',
        defaultValue: true,
        applicableOS: [],
        requiresRestart: true,
    },
    {
        id: 'update_channel',
        key: 'update_channel',
        name: 'Canal de mise à jour',
        description: 'Canal pour les mises à jour de l\'agent',
        category: 'updates',
        valueType: 'string',
        defaultValue: 'stable',
        allowedValues: [
            { value: 'stable', label: 'Stable' },
            { value: 'beta', label: 'Beta' },
            { value: 'canary', label: 'Canary' },
        ],
        applicableOS: [],
        requiresRestart: false,
    },
    // Network
    {
        id: 'proxy_enabled',
        key: 'proxy_enabled',
        name: 'Utiliser un proxy',
        description: 'Activer la connexion via proxy',
        category: 'network',
        valueType: 'boolean',
        defaultValue: false,
        applicableOS: [],
        requiresRestart: true,
    },
    {
        id: 'proxy_url',
        key: 'proxy_url',
        name: 'URL du proxy',
        description: 'URL du serveur proxy',
        category: 'network',
        valueType: 'string',
        defaultValue: '',
        applicableOS: [],
        requiresRestart: true,
    },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get scope label
 */
export function getScopeLabel(scope: PolicyScope): string {
    switch (scope) {
        case 'global': return 'Global';
        case 'group': return 'Groupe';
        case 'agent': return 'Agent';
    }
}

/**
 * Get scope color
 */
export function getScopeColor(scope: PolicyScope): string {
    switch (scope) {
        case 'global': return 'text-primary';
        case 'group': return 'text-warning';
        case 'agent': return 'text-success';
    }
}

/**
 * Get enforcement label
 */
export function getEnforcementLabel(mode: EnforcementMode): string {
    switch (mode) {
        case 'enforce': return 'Appliqué';
        case 'audit': return 'Audit';
        case 'disabled': return 'Désactivé';
    }
}

/**
 * Get enforcement color
 */
export function getEnforcementColor(mode: EnforcementMode): string {
    switch (mode) {
        case 'enforce': return 'text-success';
        case 'audit': return 'text-warning';
        case 'disabled': return 'text-muted-foreground';
    }
}

/**
 * Get deployment status label
 */
export function getDeploymentStatusLabel(status: DeploymentStatus): string {
    switch (status) {
        case 'draft': return 'Brouillon';
        case 'pending': return 'En attente';
        case 'deploying': return 'Déploiement';
        case 'deployed': return 'Déployé';
        case 'failed': return 'Échoué';
        case 'rollback': return 'Rollback';
    }
}

/**
 * Get deployment status color
 */
export function getDeploymentStatusColor(status: DeploymentStatus): string {
    switch (status) {
        case 'draft': return 'text-muted-foreground';
        case 'pending': return 'text-warning';
        case 'deploying': return 'text-primary';
        case 'deployed': return 'text-success';
        case 'failed': return 'text-destructive';
        case 'rollback': return 'text-orange-500';
    }
}

/**
 * Get category label
 */
export function getCategoryLabel(category: RuleCategory): string {
    switch (category) {
        case 'monitoring': return 'Monitoring';
        case 'security': return 'Sécurité';
        case 'compliance': return 'Conformité';
        case 'reporting': return 'Rapports';
        case 'updates': return 'Mises à jour';
        case 'network': return 'Réseau';
        case 'storage': return 'Stockage';
        case 'logging': return 'Logs';
    }
}

/**
 * Get category icon name
 */
export function getCategoryIcon(category: RuleCategory): string {
    switch (category) {
        case 'monitoring': return 'Activity';
        case 'security': return 'Shield';
        case 'compliance': return 'CheckCircle';
        case 'reporting': return 'FileText';
        case 'updates': return 'Download';
        case 'network': return 'Network';
        case 'storage': return 'HardDrive';
        case 'logging': return 'FileCode';
    }
}

/**
 * Create default group
 */
export function createDefaultGroup(
    organizationId: string,
    userId: string
): Omit<AgentGroup, 'id' | 'createdAt' | 'updatedAt'> {
    return {
        organizationId,
        name: 'Tous les agents',
        description: 'Groupe par défaut contenant tous les agents',
        icon: 'Users',
        color: '#4a7fc7',
        isDefault: true,
        isSystem: true,
        isDynamic: true,
        membershipCriteria: [],
        criteriaLogic: 'or',
        agentIds: [],
        agentCount: 0,
        policyIds: [],
        sortOrder: 0,
        createdBy: userId,
    };
}

/**
 * Create default global policy
 */
export function createDefaultGlobalPolicy(
    organizationId: string,
    userId: string
): Omit<AgentPolicy, 'id' | 'createdAt' | 'updatedAt'> {
    return {
        organizationId,
        name: 'Politique globale par défaut',
        description: 'Politique de base appliquée à tous les agents',
        scope: 'global',
        priority: 'medium',
        enforcement: 'enforce',
        isEnabled: true,
        isDefault: true,
        targetGroupIds: [],
        targetAgentIds: [],
        rules: DEFAULT_RULE_TEMPLATES.map(template => ({
            id: template.id,
            key: template.key,
            name: template.name,
            description: template.description,
            category: template.category,
            valueType: template.valueType,
            value: template.defaultValue,
            defaultValue: template.defaultValue,
            minValue: template.minValue,
            maxValue: template.maxValue,
            allowedValues: template.allowedValues,
            unit: template.unit,
            isRequired: false,
            isInherited: false,
            applicableOS: template.applicableOS,
            requiresRestart: template.requiresRestart,
        })),
        version: 1,
        deploymentStatus: 'draft',
        pendingAgentCount: 0,
        appliedAgentCount: 0,
        createdBy: userId,
    };
}

/**
 * Merge rules with inheritance
 */
export function mergeRulesWithInheritance(
    baseRules: PolicyRule[],
    overrideRules: PolicyRule[],
    overridePolicy: { id: string; name: string; scope: PolicyScope }
): PolicyRule[] {
    const merged = [...baseRules];

    for (const override of overrideRules) {
        const existingIndex = merged.findIndex(r => r.key === override.key);

        if (existingIndex >= 0) {
            // Override the rule
            merged[existingIndex] = {
                ...override,
                isInherited: false,
            };
        } else {
            // Add new rule
            merged.push({
                ...override,
                isInherited: false,
            });
        }
    }

    // Mark remaining rules as inherited
    return merged.map(rule => {
        if (!overrideRules.find(r => r.key === rule.key)) {
            return {
                ...rule,
                isInherited: true,
                inheritedFrom: {
                    scope: overridePolicy.scope,
                    policyId: overridePolicy.id,
                    policyName: overridePolicy.name,
                },
            };
        }
        return rule;
    });
}

/**
 * Convert policy rules to agent config
 */
export function rulesToAgentConfig(rules: PolicyRule[]): AgentConfig {
    const config: AgentConfig = {
        check_interval_secs: 3600,
        heartbeat_interval_secs: 60,
        log_level: 'info',
        enabled_checks: ['all'],
        offline_mode_days: 7,
    };

    for (const rule of rules) {
        switch (rule.key) {
            case 'check_interval_secs':
                config.check_interval_secs = rule.value as number;
                break;
            case 'heartbeat_interval_secs':
                config.heartbeat_interval_secs = rule.value as number;
                break;
            case 'log_level':
                config.log_level = rule.value as string;
                break;
            case 'enabled_checks':
                config.enabled_checks = rule.value as string[];
                break;
            case 'offline_mode_days':
                config.offline_mode_days = rule.value as number;
                break;
        }
    }

    return config;
}
