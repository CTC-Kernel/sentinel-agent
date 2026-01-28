/**
 * PolicyEditor Component
 *
 * Visual editor for agent policies with rule configuration,
 * inheritance preview, and validation.
 *
 * Sprint 9 - Groups & Policies
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AgentPolicy,
    PolicyRule,
    RuleCategory,
    PolicyScope,
    PolicyPriority,
    EnforcementMode,
    RULE_CATEGORIES,
    POLICY_SCOPES,
    POLICY_PRIORITIES,
    ENFORCEMENT_MODES,
    DEFAULT_RULE_TEMPLATES,
    getScopeLabel,
    getScopeColor,
    getEnforcementLabel,
    getEnforcementColor,
    getCategoryLabel,
    getDeploymentStatusLabel,
    getDeploymentStatusColor,
} from '../../types/agentPolicy';
import {
    subscribeToPolicies,
    createPolicy,
    updatePolicy,
    deletePolicy,
    togglePolicy,
    deployPolicy,
    validatePolicyRules,
} from '../../services/AgentPolicyService';
import type { AgentGroup } from '../../types/agentPolicy';
import { useStore } from '../../store';
import {
    Activity,
    AlertTriangle,
    ArrowLeft,
    Check,
    CheckCircle,
    ChevronRight,
    Download,
    Edit,
    FileCode,
    FileText,
    HardDrive,
    Layers,
    MoreHorizontal,
    Network,
    Play,
    Plus,
    RefreshCw,
    Save,
    Settings,
    Shield,
    Trash2,
    X,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/input';
import { Switch } from '../ui/Switch';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../utils/cn';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';
import { ErrorLogger } from '../../services/errorLogger';

interface PolicyEditorProps {
    groups?: AgentGroup[];
    selectedPolicyId?: string;
    onSelectPolicy?: (policyId: string | null) => void;
    onBack?: () => void;
    className?: string;
}

// Category Icons Mapping
const CategoryIcons: Record<RuleCategory, React.FC<{ className?: string }>> = {
    monitoring: Activity,
    security: Shield,
    compliance: CheckCircle,
    reporting: FileText,
    updates: Download,
    network: Network,
    storage: HardDrive,
    logging: FileCode,
};

// Rule Editor Row
const RuleEditorRow: React.FC<{
    rule: PolicyRule;
    onChange: (updates: Partial<PolicyRule>) => void;
    disabled?: boolean;
}> = ({ rule, onChange, disabled }) => {
    const renderValueInput = () => {
        switch (rule.valueType) {
            case 'boolean':
                return (
                    <Switch
                        checked={rule.value as boolean}
                        onChange={(checked: boolean) => onChange({ value: checked })}
                        disabled={disabled}
                    />
                );

            case 'number':
                return (
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            value={rule.value as number}
                            min={rule.minValue}
                            max={rule.maxValue}
                            onChange={(e) => onChange({ value: parseInt(e.target.value) || 0 })}
                            disabled={disabled}
                            className="w-24"
                        />
                        {rule.unit && (
                            <span className="text-sm text-muted-foreground">{rule.unit}</span>
                        )}
                    </div>
                );

            case 'string':
                if (rule.allowedValues && rule.allowedValues.length > 0) {
                    return (
                        <select
                            value={rule.value as string}
                            onChange={(e) => onChange({ value: e.target.value })}
                            disabled={disabled}
                            className="bg-background border border-input rounded-md px-3 py-2"
                        >
                            {rule.allowedValues.map(opt => (
                                <option key={String(opt.value)} value={String(opt.value)}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    );
                }
                return (
                    <Input
                        value={rule.value as string}
                        onChange={(e) => onChange({ value: e.target.value })}
                        disabled={disabled}
                        className="w-48"
                    />
                );

            case 'string_array':
                return (
                    <Input
                        value={(rule.value as string[]).join(', ')}
                        onChange={(e) => onChange({
                            value: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        })}
                        disabled={disabled}
                        placeholder="valeur1, valeur2, ..."
                        className="w-64"
                    />
                );

            default:
                return (
                    <Input
                        value={String(rule.value)}
                        onChange={(e) => onChange({ value: e.target.value })}
                        disabled={disabled}
                    />
                );
        }
    };

    return (
        <div className={cn(
            'flex items-center gap-4 py-3 px-4 rounded-lg',
            rule.isInherited ? 'bg-accent/30' : 'bg-accent/50'
        )}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium">{rule.name}</span>
                    {rule.isInherited && rule.inheritedFrom && (
                        <Badge variant="outline" className="text-xs">
                            Hérité de {rule.inheritedFrom.policyName}
                        </Badge>
                    )}
                    {rule.requiresRestart && (
                        <Badge variant="soft" className="text-xs bg-warning/10 text-warning">
                            Restart
                        </Badge>
                    )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{rule.description}</p>
            </div>
            <div className="flex-shrink-0">
                {renderValueInput()}
            </div>
        </div>
    );
};

// Rules by Category
const RulesCategorySection: React.FC<{
    category: RuleCategory;
    rules: PolicyRule[];
    onChange: (ruleId: string, updates: Partial<PolicyRule>) => void;
    disabled?: boolean;
}> = ({ category, rules, onChange, disabled }) => {
    const [expanded, setExpanded] = useState(true);
    const Icon = CategoryIcons[category];

    if (rules.length === 0) return null;

    return (
        <div className="mb-4">
            <button
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                className="flex items-center gap-2 w-full p-2 hover:bg-accent/50 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
                <motion.div
                    animate={{ rotate: expanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronRight className="h-4 w-4" />
                </motion.div>
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{getCategoryLabel(category)}</span>
                <Badge variant="soft" className="ml-auto">{rules.length}</Badge>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2 mt-2 ml-6"
                    >
                        {rules.map(rule => (
                            <RuleEditorRow
                                key={rule.id}
                                rule={rule}
                                onChange={(updates) => onChange(rule.id, updates)}
                                disabled={disabled}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Policy Form
const PolicyForm: React.FC<{
    policy?: AgentPolicy | null;
    groups: AgentGroup[];
    onSave: (data: Partial<AgentPolicy>) => Promise<void>;
    onCancel: () => void;
}> = ({ policy, groups, onSave, onCancel }) => {
    const [name, setName] = useState(policy?.name || '');
    const [description, setDescription] = useState(policy?.description || '');
    const [scope, setScope] = useState<PolicyScope>(policy?.scope || 'group');
    const [priority, setPriority] = useState<PolicyPriority>(policy?.priority || 'medium');
    const [enforcement, setEnforcement] = useState<EnforcementMode>(policy?.enforcement || 'enforce');
    const [targetGroupIds, setTargetGroupIds] = useState<string[]>(policy?.targetGroupIds || []);
    const [rules, setRules] = useState<PolicyRule[]>(policy?.rules || []);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    // Initialize rules from templates if new policy
    useEffect(() => {
        if (!policy && rules.length === 0) {
            const initialRules = DEFAULT_RULE_TEMPLATES.map(template => ({
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
            }));
            setRules(initialRules);
        }
    }, [policy, rules.length]);

    // Group rules by category
    const rulesByCategory = useMemo(() => {
        const grouped = new Map<RuleCategory, PolicyRule[]>();
        for (const category of RULE_CATEGORIES) {
            grouped.set(category, rules.filter(r => r.category === category));
        }
        return grouped;
    }, [rules]);

    const handleRuleChange = (ruleId: string, updates: Partial<PolicyRule>) => {
        setRules(rules.map(r =>
            r.id === ruleId ? { ...r, ...updates, isInherited: false } : r
        ));
    };

    const handleSave = async () => {
        // Validate
        const validationErrors = validatePolicyRules(rules);
        if (!name.trim()) {
            validationErrors.push('Le nom est requis');
        }
        if (scope === 'group' && targetGroupIds.length === 0) {
            validationErrors.push('Sélectionnez au moins un groupe cible');
        }

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        setSaving(true);
        setErrors([]);

        try {
            await onSave({
                name: name.trim(),
                description: description.trim(),
                scope,
                priority,
                enforcement,
                targetGroupIds: scope === 'group' ? targetGroupIds : [],
                targetAgentIds: [],
                rules,
                deploymentStatus: 'draft',
            });
        } catch (error) {
            ErrorLogger.error(error, 'PolicyEditor.savePolicy');
            setErrors(['Erreur lors de la sauvegarde']);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Errors */}
            {errors.length > 0 && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4">
                    <div className="flex items-center gap-2 font-medium mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        Erreurs de validation
                    </div>
                    <ul className="list-disc list-inside text-sm">
                        {errors.map((error, idx) => (
                            <li key={idx}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Basic Info */}
            <div className="glass-premium rounded-xl p-4 space-y-4 border border-border/40">
                <h4 className="font-medium">Informations générales</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="policyName" className="text-sm font-medium mb-1 block">Nom</label>
                        <Input
                            id="policyName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Nom de la politique"
                        />
                    </div>
                    <div>
                        <label htmlFor="policyDescription" className="text-sm font-medium mb-1 block">Description</label>
                        <Input
                            id="policyDescription"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Description optionnelle"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="policyScope" className="text-sm font-medium mb-1 block">Portée</label>
                        <select
                            id="policyScope"
                            value={scope}
                            onChange={(e) => setScope(e.target.value as PolicyScope)}
                            className="w-full bg-background border border-input rounded-md px-3 py-2"
                            disabled={!!policy}
                        >
                            {POLICY_SCOPES.map(s => (
                                <option key={s} value={s}>{getScopeLabel(s)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="policyPriority" className="text-sm font-medium mb-1 block">Priorité</label>
                        <select
                            id="policyPriority"
                            value={priority}
                            onChange={(e) => setPriority(e.target.value as PolicyPriority)}
                            className="w-full bg-background border border-input rounded-md px-3 py-2"
                        >
                            {POLICY_PRIORITIES.map(p => (
                                <option key={p} value={p}>
                                    {p === 'critical' ? 'Critique' :
                                        p === 'high' ? 'Haute' :
                                            p === 'medium' ? 'Moyenne' : 'Basse'}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="policyEnforcement" className="text-sm font-medium mb-1 block">Mode</label>
                        <select
                            id="policyEnforcement"
                            value={enforcement}
                            onChange={(e) => setEnforcement(e.target.value as EnforcementMode)}
                            className="w-full bg-background border border-input rounded-md px-3 py-2"
                        >
                            {ENFORCEMENT_MODES.map(m => (
                                <option key={m} value={m}>{getEnforcementLabel(m)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Target Groups */}
                {scope === 'group' && (
                    <div>
                        <span className="text-sm font-medium mb-2 block">Groupes cibles</span>
                        <div className="flex flex-wrap gap-2">
                            {groups.map(group => (
                                <Badge
                                    key={group.id}
                                    variant={targetGroupIds.includes(group.id) ? 'default' : 'outline'}
                                    className="cursor-pointer"
                                    onClick={() => {
                                        if (targetGroupIds.includes(group.id)) {
                                            setTargetGroupIds(targetGroupIds.filter(id => id !== group.id));
                                        } else {
                                            setTargetGroupIds([...targetGroupIds, group.id]);
                                        }
                                    }}
                                >
                                    {group.name}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Rules */}
            <div className="glass-premium rounded-xl p-4 border border-border/40">
                <h4 className="font-medium mb-4">Règles</h4>

                {RULE_CATEGORIES.map(category => (
                    <RulesCategorySection
                        key={category}
                        category={category}
                        rules={rulesByCategory.get(category) || []}
                        onChange={handleRuleChange}
                    />
                ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onCancel}>
                    Annuler
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4 mr-1" />
                    )}
                    {policy ? 'Enregistrer' : 'Créer'}
                </Button>
            </div>
        </div>
    );
};

// Policy Card
const PolicyCard: React.FC<{
    policy: AgentPolicy;
    isSelected: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onToggle: () => void;
    onDeploy: () => void;
    onDelete: () => void;
}> = ({ policy, isSelected, onSelect, onEdit, onToggle, onDeploy, onDelete }) => {
    return (
        <motion.div
            variants={slideUpVariants}
            className={cn(
                'glass-premium rounded-xl p-4 cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none border border-border/40',
                isSelected && 'ring-2 ring-primary'
            )}
            onClick={onSelect}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect();
                }
            }}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        'p-2 rounded-lg',
                        policy.scope === 'global' ? 'bg-primary/10' :
                            policy.scope === 'group' ? 'bg-warning/10' :
                                'bg-success/10'
                    )}>
                        <Layers className={cn(
                            'h-4 w-4',
                            getScopeColor(policy.scope)
                        )} />
                    </div>
                    <div>
                        <h4 className="font-medium">{policy.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{getScopeLabel(policy.scope)}</span>
                            <span>•</span>
                            <span className={getEnforcementColor(policy.enforcement)}>
                                {getEnforcementLabel(policy.enforcement)}
                            </span>
                        </div>
                    </div>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onEdit}>
                            <Edit className="h-4 w-4 mr-2" />
                            Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onToggle}>
                            {policy.isEnabled ? (
                                <>
                                    <X className="h-4 w-4 mr-2" />
                                    Désactiver
                                </>
                            ) : (
                                <>
                                    <Check className="h-4 w-4 mr-2" />
                                    Activer
                                </>
                            )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onDeploy}>
                            <Play className="h-4 w-4 mr-2" />
                            Déployer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={onDelete}
                            className="text-destructive"
                            disabled={policy.isDefault}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap gap-2">
                <Badge
                    variant={policy.isEnabled ? 'soft' : 'outline'}
                    className={policy.isEnabled ? 'bg-success/10 text-success' : ''}
                >
                    {policy.isEnabled ? 'Actif' : 'Inactif'}
                </Badge>
                <Badge
                    variant="soft"
                    className={cn(
                        getDeploymentStatusColor(policy.deploymentStatus),
                        'bg-opacity-30'
                    )}
                >
                    {getDeploymentStatusLabel(policy.deploymentStatus)}
                </Badge>
                {policy.isDefault && (
                    <Badge variant="soft" className="bg-primary/10 text-primary">
                        Défaut
                    </Badge>
                )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span>{policy.rules.length} règles</span>
                <span>•</span>
                <span>v{policy.version}</span>
                {policy.targetGroupIds.length > 0 && (
                    <>
                        <span>•</span>
                        <span>{policy.targetGroupIds.length} groupe(s)</span>
                    </>
                )}
            </div>
        </motion.div>
    );
};

// Main Component
export const PolicyEditor: React.FC<PolicyEditorProps> = ({
    groups = [],
    selectedPolicyId,
    onSelectPolicy,
    onBack,
    className,
}) => {
    const { user } = useStore();
    const organizationId = user?.organizationId;
    const [policies, setPolicies] = useState<AgentPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPolicy, setEditingPolicy] = useState<AgentPolicy | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [scopeFilter, setScopeFilter] = useState<PolicyScope | 'all'>('all');

    // Subscribe to policies
    useEffect(() => {
        if (!organizationId) return;

        // Note: loading is initialized to true, no need to set it here

        const unsubscribe = subscribeToPolicies(
            organizationId,
            (data) => {
                setPolicies(data);
                setLoading(false);
            },
            (error) => {
                ErrorLogger.error(error, 'PolicyEditor.subscribeToPolicies');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [organizationId]);

    // Selected policy
    const selectedPolicy = useMemo(() =>
        policies.find(p => p.id === selectedPolicyId),
        [policies, selectedPolicyId]
    );

    // Filtered policies
    const filteredPolicies = useMemo(() => {
        if (scopeFilter === 'all') return policies;
        return policies.filter(p => p.scope === scopeFilter);
    }, [policies, scopeFilter]);

    // Handlers
    const handleSavePolicy = async (data: Partial<AgentPolicy>) => {
        if (!organizationId || !user?.uid) return;

        if (editingPolicy) {
            await updatePolicy(organizationId, editingPolicy.id, data, user.uid);
        } else {
            await createPolicy(organizationId, {
                ...data,
                organizationId,
                isEnabled: true,
                isDefault: false,
                parentPolicyId: undefined,
                pendingAgentCount: 0,
                appliedAgentCount: 0,
            } as Omit<AgentPolicy, 'id' | 'createdAt' | 'updatedAt' | 'version'>, user.uid);
        }

        setEditingPolicy(null);
        setIsCreating(false);
    };

    const handleTogglePolicy = async (policyId: string) => {
        if (!organizationId || !user?.uid) return;
        const policy = policies.find(p => p.id === policyId);
        if (policy) {
            await togglePolicy(organizationId, policyId, !policy.isEnabled, user.uid);
        }
    };

    const handleDeployPolicy = async (policyId: string) => {
        if (!organizationId || !user?.uid) return;
        await deployPolicy(organizationId, policyId, user.uid);
    };

    const handleDeletePolicy = async (policyId: string) => {
        if (!organizationId || !user?.uid) return;
        if (!confirm('Supprimer cette politique ?')) return;
        await deletePolicy(organizationId, policyId, user.uid);
        if (selectedPolicyId === policyId) {
            onSelectPolicy?.(null);
        }
    };

    // Show form if editing or creating
    if (editingPolicy || isCreating) {
        return (
            <div className={cn('space-y-4', className)}>
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setEditingPolicy(null);
                            setIsCreating(false);
                        }}
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Retour
                    </Button>
                    <h2 className="text-xl font-semibold">
                        {editingPolicy ? 'Modifier la politique' : 'Nouvelle politique'}
                    </h2>
                </div>

                <PolicyForm
                    policy={editingPolicy}
                    groups={groups}
                    onSave={handleSavePolicy}
                    onCancel={() => {
                        setEditingPolicy(null);
                        setIsCreating(false);
                    }}
                />
            </div>
        );
    }

    if (loading) {
        return (
            <div className={cn('glass-premium rounded-2xl p-8 flex items-center justify-center border border-border/40', className)}>
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainerVariants}
            className={cn('space-y-4', className)}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <Button variant="ghost" size="sm" onClick={onBack}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <h2 className="text-xl font-semibold">Politiques</h2>
                </div>

                <div className="flex items-center gap-3">
                    {/* Scope Filter */}
                    <div className="flex gap-1 bg-accent rounded-lg p-1">
                        <Button
                            variant={scopeFilter === 'all' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setScopeFilter('all')}
                        >
                            Toutes
                        </Button>
                        {POLICY_SCOPES.map(scope => (
                            <Button
                                key={scope}
                                variant={scopeFilter === scope ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setScopeFilter(scope)}
                            >
                                {getScopeLabel(scope)}
                            </Button>
                        ))}
                    </div>

                    <Button onClick={() => setIsCreating(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Politique
                    </Button>
                </div>
            </div>

            {/* Policies Grid */}
            {filteredPolicies.length === 0 ? (
                <motion.div
                    variants={slideUpVariants}
                    className="glass-premium rounded-2xl p-8 text-center border border-border/40"
                >
                    <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">Aucune politique</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Créez une politique pour configurer vos agents
                    </p>
                    <Button onClick={() => setIsCreating(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Créer une politique
                    </Button>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPolicies.map(policy => (
                        <PolicyCard
                            key={policy.id}
                            policy={policy}
                            isSelected={selectedPolicyId === policy.id}
                            onSelect={() => onSelectPolicy?.(
                                selectedPolicyId === policy.id ? null : policy.id
                            )}
                            onEdit={() => setEditingPolicy(policy)}
                            onToggle={() => handleTogglePolicy(policy.id)}
                            onDeploy={() => handleDeployPolicy(policy.id)}
                            onDelete={() => handleDeletePolicy(policy.id)}
                        />
                    ))}
                </div>
            )}

            {/* Selected Policy Details */}
            {selectedPolicy && (
                <motion.div
                    variants={slideUpVariants}
                    className="glass-premium rounded-2xl p-6 border border-border/40"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Détails de la politique</h3>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPolicy(selectedPolicy)}
                        >
                            <Edit className="h-4 w-4 mr-1" />
                            Modifier
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {/* Rules Summary by Category */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {RULE_CATEGORIES.map(category => {
                                const count = selectedPolicy.rules.filter(r => r.category === category).length;
                                if (count === 0) return null;
                                const Icon = CategoryIcons[category];
                                return (
                                    <div key={category} className="bg-accent/30 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon className="h-4 w-4 text-primary" />
                                            <span className="text-sm font-medium">
                                                {getCategoryLabel(category)}
                                            </span>
                                        </div>
                                        <div className="text-2xl font-bold">{count}</div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Deployment Info */}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {selectedPolicy.lastDeployedAt && (
                                <span>
                                    Dernier déploiement:{' '}
                                    {new Date(selectedPolicy.lastDeployedAt).toLocaleDateString('fr-FR')}
                                </span>
                            )}
                            <span>
                                {selectedPolicy.appliedAgentCount} agents configurés
                            </span>
                            {selectedPolicy.pendingAgentCount > 0 && (
                                <Badge variant="soft" className="bg-warning/10 text-warning">
                                    {selectedPolicy.pendingAgentCount} en attente
                                </Badge>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
};

export default PolicyEditor;
