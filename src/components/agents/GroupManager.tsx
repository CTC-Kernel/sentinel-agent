/**
 * GroupManager Component
 *
 * Manages agent groups with hierarchy visualization,
 * drag-and-drop assignment, and bulk operations.
 *
 * Sprint 9 - Groups & Policies
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AgentGroup,
    GroupHierarchyNode,
    MembershipCriteria,
    MembershipCriteriaType,
} from '../../types/agentPolicy';
import {
    subscribeToGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    addAgentsToGroup,
    removeAgentsFromGroup,
    buildGroupHierarchy,
} from '../../services/AgentPolicyService';
import { useStore } from '../../store';
import type { SentinelAgent } from '../../types/agent';
import {
    ChevronDown,
    ChevronRight,
    Edit,
    FolderPlus,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    X,
    Check,
    Monitor,
    Folder,
    FolderOpen,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../utils/cn';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';

interface GroupManagerProps {
    agents?: SentinelAgent[];
    selectedGroupId?: string;
    onSelectGroup?: (groupId: string | null) => void;
    onAssignAgents?: (groupId: string, agentIds: string[]) => void;
    className?: string;
    compact?: boolean;
}

// Group Form Modal
const GroupFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    group?: AgentGroup | null;
    parentGroupId?: string;
    onSave: (data: Partial<AgentGroup>) => Promise<void>;
}> = ({ isOpen, onClose, group, parentGroupId, onSave }) => {
    const [name, setName] = useState(group?.name || '');
    const [description, setDescription] = useState(group?.description || '');
    const [color, setColor] = useState(group?.color || '#4a7fc7');
    const [isDynamic, setIsDynamic] = useState(group?.isDynamic || false);
    const [criteria, setCriteria] = useState<MembershipCriteria[]>(group?.membershipCriteria || []);
    const [criteriaLogic, setCriteriaLogic] = useState<'and' | 'or'>(group?.criteriaLogic || 'or');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return;

        setSaving(true);
        try {
            await onSave({
                name: name.trim(),
                description: description.trim(),
                color,
                isDynamic,
                membershipCriteria: isDynamic ? criteria : [],
                criteriaLogic,
                parentGroupId,
            });
            onClose();
        } catch (error) {
            console.error('Error saving group:', error);
        } finally {
            setSaving(false);
        }
    };

    const addCriteria = () => {
        setCriteria([
            ...criteria,
            { type: 'os', operator: 'equals', value: '', negate: false },
        ]);
    };

    const updateCriteria = (index: number, updates: Partial<MembershipCriteria>) => {
        const updated = [...criteria];
        updated[index] = { ...updated[index], ...updates };
        setCriteria(updated);
    };

    const removeCriteria = (index: number) => {
        setCriteria(criteria.filter((_, i) => i !== index));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-panel rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            >
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold">
                            {group ? 'Modifier le groupe' : 'Nouveau groupe'}
                        </h2>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {/* Name */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">Nom</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Nom du groupe"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">Description</label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Description optionnelle"
                            />
                        </div>

                        {/* Color */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">Couleur</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="h-10 w-16 rounded cursor-pointer"
                                />
                                <Input
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="flex-1"
                                />
                            </div>
                        </div>

                        {/* Dynamic Membership */}
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="isDynamic"
                                checked={isDynamic}
                                onChange={(e) => setIsDynamic(e.target.checked)}
                                className="h-4 w-4 rounded"
                            />
                            <label htmlFor="isDynamic" className="text-sm font-medium">
                                Appartenance dynamique (basée sur des critères)
                            </label>
                        </div>

                        {/* Criteria */}
                        {isDynamic && (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Critères</label>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant={criteriaLogic === 'and' ? 'default' : 'outline'}
                                            className="cursor-pointer"
                                            onClick={() => setCriteriaLogic('and')}
                                        >
                                            ET
                                        </Badge>
                                        <Badge
                                            variant={criteriaLogic === 'or' ? 'default' : 'outline'}
                                            className="cursor-pointer"
                                            onClick={() => setCriteriaLogic('or')}
                                        >
                                            OU
                                        </Badge>
                                    </div>
                                </div>

                                {criteria.map((c, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-accent/50 rounded-lg p-2">
                                        <select
                                            value={c.type}
                                            onChange={(e) => updateCriteria(idx, { type: e.target.value as MembershipCriteriaType })}
                                            className="bg-background rounded px-2 py-1 text-sm"
                                        >
                                            <option value="os">OS</option>
                                            <option value="hostname_pattern">Hostname</option>
                                            <option value="ip_range">IP Range</option>
                                            <option value="tag">Tag</option>
                                            <option value="department">Département</option>
                                        </select>
                                        <select
                                            value={c.operator}
                                            onChange={(e) => updateCriteria(idx, { operator: e.target.value as MembershipCriteria['operator'] })}
                                            className="bg-background rounded px-2 py-1 text-sm"
                                        >
                                            <option value="equals">égal à</option>
                                            <option value="contains">contient</option>
                                            <option value="matches">regex</option>
                                        </select>
                                        <Input
                                            value={typeof c.value === 'string' ? c.value : ''}
                                            onChange={(e) => updateCriteria(idx, { value: e.target.value })}
                                            placeholder="Valeur"
                                            className="flex-1"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeCriteria(idx)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addCriteria}
                                    className="w-full"
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Ajouter un critère
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                        <Button variant="outline" onClick={onClose}>
                            Annuler
                        </Button>
                        <Button onClick={handleSave} disabled={saving || !name.trim()}>
                            {saving ? (
                                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                                <Check className="h-4 w-4 mr-1" />
                            )}
                            {group ? 'Enregistrer' : 'Créer'}
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// Group Tree Node
const GroupTreeNode: React.FC<{
    node: GroupHierarchyNode;
    selectedId?: string;
    expandedIds: Set<string>;
    onToggleExpand: (id: string) => void;
    onSelect: (id: string) => void;
    onEdit: (group: AgentGroup) => void;
    onDelete: (groupId: string) => void;
    onAddChild: (parentId: string) => void;
    draggedAgentIds?: string[];
    onDropAgents?: (groupId: string) => void;
}> = ({
    node,
    selectedId,
    expandedIds,
    onToggleExpand,
    onSelect,
    onEdit,
    onDelete,
    onAddChild,
    draggedAgentIds,
    onDropAgents,
}) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const isExpanded = expandedIds.has(node.group.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedId === node.group.id;

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (draggedAgentIds && draggedAgentIds.length > 0) {
            setIsDragOver(true);
        }
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (onDropAgents) {
            onDropAgents(node.group.id);
        }
    };

    return (
        <div>
            <div
                className={cn(
                    'flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors',
                    isSelected ? 'bg-primary/10' : 'hover:bg-accent',
                    isDragOver && 'ring-2 ring-primary bg-primary/5'
                )}
                style={{ paddingLeft: `${node.depth * 20 + 12}px` }}
                onClick={() => onSelect(node.group.id)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Expand/Collapse */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) onToggleExpand(node.group.id);
                    }}
                    className={cn(
                        'p-0.5 rounded hover:bg-accent',
                        !hasChildren && 'invisible'
                    )}
                >
                    {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                    ) : (
                        <ChevronRight className="h-4 w-4" />
                    )}
                </button>

                {/* Icon */}
                <div
                    className="p-1.5 rounded"
                    style={{ backgroundColor: `${node.group.color}20` }}
                >
                    {isExpanded ? (
                        <FolderOpen className="h-4 w-4" style={{ color: node.group.color }} />
                    ) : (
                        <Folder className="h-4 w-4" style={{ color: node.group.color }} />
                    )}
                </div>

                {/* Name */}
                <span className="flex-1 font-medium truncate">{node.group.name}</span>

                {/* Agent Count */}
                <Badge variant="soft" className="text-xs">
                    {node.group.agentCount}
                </Badge>

                {/* Badges */}
                {node.group.isDynamic && (
                    <Badge variant="outline" className="text-xs">Auto</Badge>
                )}
                {node.group.isDefault && (
                    <Badge variant="soft" className="text-xs bg-primary/10 text-primary">Défaut</Badge>
                )}

                {/* Actions */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(node.group)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAddChild(node.group.id)}>
                            <FolderPlus className="h-4 w-4 mr-2" />
                            Sous-groupe
                        </DropdownMenuItem>
                        {!node.group.isSystem && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => onDelete(node.group.id)}
                                    className="text-destructive"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Supprimer
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Children */}
            <AnimatePresence>
                {isExpanded && hasChildren && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {node.children.map(child => (
                            <GroupTreeNode
                                key={child.group.id}
                                node={child}
                                selectedId={selectedId}
                                expandedIds={expandedIds}
                                onToggleExpand={onToggleExpand}
                                onSelect={onSelect}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onAddChild={onAddChild}
                                draggedAgentIds={draggedAgentIds}
                                onDropAgents={onDropAgents}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Agent List for Group
const GroupAgentList: React.FC<{
    group: AgentGroup;
    agents: SentinelAgent[];
    onRemoveAgent: (agentId: string) => void;
}> = ({ group, agents, onRemoveAgent }) => {
    const groupAgents = useMemo(() =>
        agents.filter(a => group.agentIds.includes(a.id)),
        [agents, group.agentIds]
    );

    if (groupAgents.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <Monitor className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucun agent dans ce groupe</p>
                <p className="text-sm">Glissez des agents ici pour les ajouter</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {groupAgents.map(agent => (
                <div
                    key={agent.id}
                    className="flex items-center gap-3 p-3 bg-accent/30 rounded-lg"
                >
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{agent.hostname || agent.name}</div>
                        <div className="text-xs text-muted-foreground">
                            {agent.os} • {agent.status}
                        </div>
                    </div>
                    {!group.isDynamic && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onRemoveAgent(agent.id)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            ))}
        </div>
    );
};

// Main Component
export const GroupManager: React.FC<GroupManagerProps> = ({
    agents = [],
    selectedGroupId,
    onSelectGroup,
    onAssignAgents,
    className,
    compact = false,
}) => {
    const { user } = useStore();
    const organizationId = user?.organizationId;
    const [groups, setGroups] = useState<AgentGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [editingGroup, setEditingGroup] = useState<AgentGroup | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [parentForNewGroup, setParentForNewGroup] = useState<string | undefined>();
    const [draggedAgentIds, setDraggedAgentIds] = useState<string[]>([]);

    // Subscribe to groups
    useEffect(() => {
        if (!organizationId) return;

        // Note: loading is initialized to true, no need to set it here

        const unsubscribe = subscribeToGroups(
            organizationId,
            (data) => {
                setGroups(data);
                setLoading(false);
                // Expand all by default
                setExpandedIds(new Set(data.map(g => g.id)));
            },
            (error) => {
                console.error('Error loading groups:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [organizationId]);

    // Build hierarchy
    const hierarchy = useMemo(() => buildGroupHierarchy(groups), [groups]);

    // Filter hierarchy
    const filteredHierarchy = useMemo(() => {
        if (!searchTerm) return hierarchy;

        const term = searchTerm.toLowerCase();
        const matchingIds = new Set(
            groups
                .filter(g => g.name.toLowerCase().includes(term))
                .map(g => g.id)
        );

        // Include parents of matching groups
        function addParents(groupId: string) {
            const group = groups.find(g => g.id === groupId);
            if (group?.parentGroupId) {
                matchingIds.add(group.parentGroupId);
                addParents(group.parentGroupId);
            }
        }

        matchingIds.forEach(id => addParents(id));

        function filterNode(node: GroupHierarchyNode): GroupHierarchyNode | null {
            if (!matchingIds.has(node.group.id) && node.children.length === 0) {
                return null;
            }

            const filteredChildren = node.children
                .map(filterNode)
                .filter((n): n is GroupHierarchyNode => n !== null);

            if (!matchingIds.has(node.group.id) && filteredChildren.length === 0) {
                return null;
            }

            return { ...node, children: filteredChildren };
        }

        return hierarchy
            .map(filterNode)
            .filter((n): n is GroupHierarchyNode => n !== null);
    }, [hierarchy, searchTerm, groups]);

    // Selected group
    const selectedGroup = useMemo(() =>
        groups.find(g => g.id === selectedGroupId),
        [groups, selectedGroupId]
    );

    // Handlers
    const handleToggleExpand = useCallback((id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleSelect = useCallback((id: string) => {
        onSelectGroup?.(selectedGroupId === id ? null : id);
    }, [selectedGroupId, onSelectGroup]);

    const handleSaveGroup = async (data: Partial<AgentGroup>) => {
        if (!organizationId || !user?.uid) return;

        if (editingGroup) {
            await updateGroup(organizationId, editingGroup.id, data);
        } else {
            await createGroup(organizationId, {
                ...data,
                organizationId,
                icon: 'Folder',
                isDefault: false,
                isSystem: false,
                agentIds: [],
                policyIds: [],
                sortOrder: groups.length,
            } as Omit<AgentGroup, 'id' | 'createdAt' | 'updatedAt' | 'agentCount'>, user.uid);
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (!organizationId) return;
        if (!confirm('Supprimer ce groupe ? Les agents ne seront pas supprimés.')) return;

        await deleteGroup(organizationId, groupId);
        if (selectedGroupId === groupId) {
            onSelectGroup?.(null);
        }
    };

    const handleDropAgents = async (groupId: string) => {
        if (!organizationId || draggedAgentIds.length === 0) return;

        await addAgentsToGroup(organizationId, groupId, draggedAgentIds);
        onAssignAgents?.(groupId, draggedAgentIds);
        setDraggedAgentIds([]);
    };

    const handleRemoveAgent = async (agentId: string) => {
        if (!organizationId || !selectedGroupId) return;

        await removeAgentsFromGroup(organizationId, selectedGroupId, [agentId]);
    };

    if (loading) {
        return (
            <div className={cn('glass-panel rounded-2xl p-8 flex items-center justify-center', className)}>
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className={cn('flex gap-4', compact ? 'flex-col' : 'flex-row', className)}>
            {/* Groups Tree */}
            <motion.div
                initial="hidden"
                animate="visible"
                variants={staggerContainerVariants}
                className={cn(
                    'glass-panel rounded-2xl overflow-hidden',
                    compact ? 'w-full' : 'w-80 flex-shrink-0'
                )}
            >
                {/* Header */}
                <div className="p-4 border-b border-border/50">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">Groupes</h3>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setParentForNewGroup(undefined);
                                setEditingGroup(null);
                                setShowCreateModal(true);
                            }}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Groupe
                        </Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Rechercher..."
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Tree */}
                <div className="p-2 max-h-[500px] overflow-y-auto">
                    {filteredHierarchy.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Folder className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>Aucun groupe</p>
                        </div>
                    ) : (
                        filteredHierarchy.map(node => (
                            <GroupTreeNode
                                key={node.group.id}
                                node={node}
                                selectedId={selectedGroupId}
                                expandedIds={expandedIds}
                                onToggleExpand={handleToggleExpand}
                                onSelect={handleSelect}
                                onEdit={(g) => {
                                    setEditingGroup(g);
                                    setShowCreateModal(true);
                                }}
                                onDelete={handleDeleteGroup}
                                onAddChild={(parentId) => {
                                    setParentForNewGroup(parentId);
                                    setEditingGroup(null);
                                    setShowCreateModal(true);
                                }}
                                draggedAgentIds={draggedAgentIds}
                                onDropAgents={handleDropAgents}
                            />
                        ))
                    )}
                </div>
            </motion.div>

            {/* Selected Group Details */}
            {selectedGroup && !compact && (
                <motion.div
                    variants={slideUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="glass-panel rounded-2xl flex-1 overflow-hidden"
                >
                    <div className="p-4 border-b border-border/50">
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: `${selectedGroup.color}20` }}
                            >
                                <Folder className="h-5 w-5" style={{ color: selectedGroup.color }} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold">{selectedGroup.name}</h3>
                                {selectedGroup.description && (
                                    <p className="text-sm text-muted-foreground">
                                        {selectedGroup.description}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="soft">{selectedGroup.agentCount} agents</Badge>
                                {selectedGroup.isDynamic && (
                                    <Badge variant="outline">Dynamique</Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-4">
                        <h4 className="font-medium mb-3">Agents dans ce groupe</h4>
                        <GroupAgentList
                            group={selectedGroup}
                            agents={agents}
                            onRemoveAgent={handleRemoveAgent}
                        />
                    </div>
                </motion.div>
            )}

            {/* Create/Edit Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <GroupFormModal
                        isOpen={showCreateModal}
                        onClose={() => {
                            setShowCreateModal(false);
                            setEditingGroup(null);
                            setParentForNewGroup(undefined);
                        }}
                        group={editingGroup}
                        parentGroupId={parentForNewGroup}
                        onSave={handleSaveGroup}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default GroupManager;
