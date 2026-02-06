/**
 * CI Inspector Relations Tab
 *
 * Displays and manages relationships for a Configuration Item.
 * Shows upstream/downstream dependencies with visual indicators.
 *
 * @module components/cmdb/inspector/CIInspectorRelations
 */

import React, { useState, useMemo } from 'react';
import {
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Server,
  Database,
  Globe,
  Cloud,
  FileText,
  Network,
  Box,
  Loader2,
  AlertCircle,
  Link2,
  Unlink,
} from '../../ui/Icons';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/Badge';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Label } from '../../ui/label';
import { useStore } from '@/store';
import {
  ConfigurationItem,
  CMDBRelationship,
  CIClass,
  RelationshipType,
  VALID_RELATIONSHIPS,
} from '@/types/cmdb';
import { useCMDBRelationships, useCMDBRelationshipMutations } from '@/hooks/cmdb/useCMDBRelationships';
import { useCMDBCIs } from '@/hooks/cmdb/useCMDBCIs';
import { cn } from '@/lib/utils';

// =============================================================================
// PROPS
// =============================================================================

interface CIInspectorRelationsProps {
  /** Current CI */
  ci: ConfigurationItem;
  /** Can edit relationships */
  canEdit?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

const getCIClassIcon = (ciClass: CIClass | undefined): React.ElementType => {
  switch (ciClass) {
    case 'Hardware': return Server;
    case 'Software': return Database;
    case 'Service': return Globe;
    case 'Cloud': return Cloud;
    case 'Document': return FileText;
    case 'Network': return Network;
    case 'Container': return Box;
    default: return Server;
  }
};

const getRelationshipLabel = (type: RelationshipType): string => {
  const labels: Record<RelationshipType, string> = {
    depends_on: 'Dépend de',
    uses: 'Utilise',
    runs_on: 'S\'exécute sur',
    hosted_on: 'Hébergé sur',
    installed_on: 'Installé sur',
    connects_to: 'Connecté à',
    interfaces_with: 'Interface avec',
    contains: 'Contient',
    member_of: 'Membre de',
    instance_of: 'Instance de',
    provides: 'Fournit',
    consumes: 'Consomme',
    owned_by: 'Possédé par',
    supported_by: 'Supporté par',
  };
  return labels[type] || type;
};

const getCriticalityColor = (criticality: string) => {
  switch (criticality) {
    case 'Critical': return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'High': return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
    case 'Medium': return 'bg-warning/10 text-warning border-warning/30';
    case 'Low': return 'bg-muted text-muted-foreground border-muted';
    default: return 'bg-muted text-muted-foreground border-muted';
  }
};

// =============================================================================
// RELATIONSHIP CARD
// =============================================================================

interface RelationshipCardProps {
  relationship: CMDBRelationship;
  targetCI: ConfigurationItem | null;
  isSource: boolean;
  onDelete?: () => void;
  canEdit: boolean;
}

const RelationshipCard: React.FC<RelationshipCardProps> = ({
  relationship,
  targetCI,
  isSource,
  onDelete,
  canEdit,
}) => {
  const { t } = useStore();
  const [deleting, setDeleting] = useState(false);

  const Icon = targetCI ? getCIClassIcon(targetCI.ciClass) : Server;

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl border border-border/40 hover:border-primary/30 transition-all">
      {/* Direction indicator */}
      <div className={cn(
        'p-2 rounded-xl',
        isSource ? 'bg-blue-500/10 text-blue-600' : 'bg-green-500/10 text-green-600'
      )}>
        {isSource ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
      </div>

      {/* Target CI icon */}
      <div className="p-2 rounded-xl bg-muted/50">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Target info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {targetCI?.name || (isSource ? relationship.targetId : relationship.sourceId)}
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{getRelationshipLabel(relationship.relationshipType)}</span>
          {targetCI && (
            <>
              <span>•</span>
              <span>{targetCI.ciClass}</span>
            </>
          )}
        </div>
      </div>

      {/* Criticality badge */}
      <Badge
        variant="outline"
        className={cn('shrink-0', getCriticalityColor(relationship.criticality))}
      >
        {relationship.criticality}
      </Badge>

      {/* Delete button */}
      {canEdit && onDelete && (
        <CustomTooltip content={t('common.delete', { defaultValue: 'Supprimer' })}>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={deleting}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </CustomTooltip>
      )}
    </div>
  );
};

// =============================================================================
// ADD RELATIONSHIP DIALOG
// =============================================================================

interface AddRelationshipDialogProps {
  ci: ConfigurationItem;
  onAdd: (targetId: string, relationshipType: RelationshipType, direction: 'outgoing' | 'incoming') => Promise<void>;
}

const AddRelationshipDialog: React.FC<AddRelationshipDialogProps> = ({
  ci,
  onAdd,
}) => {
  const { t } = useStore();
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('depends_on');
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>('outgoing');
  const [isLoading, setIsLoading] = useState(false);

  // Get all CIs for selection
  const { data: allCIs } = useCMDBCIs({});

  // Filter out current CI
  const availableCIs = useMemo(() => {
    return (allCIs?.items || []).filter((c) => c.id !== ci.id);
  }, [allCIs?.items, ci.id]);

  // Valid relationship types for this CI class
  const validTypes = VALID_RELATIONSHIPS[ci.ciClass] || [];

  const handleSubmit = async () => {
    if (!targetId || !relationshipType) return;
    setIsLoading(true);
    try {
      await onAdd(targetId, relationshipType, direction);
      setOpen(false);
      setTargetId('');
      setRelationshipType('depends_on');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        {t('cmdb.relations.add', { defaultValue: 'Ajouter une relation' })}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t('cmdb.relations.addTitle', { defaultValue: 'Nouvelle Relation' })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Direction */}
          <div className="space-y-2">
            <Label>{t('cmdb.relations.direction', { defaultValue: 'Direction' })}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={direction === 'outgoing' ? 'default' : 'outline'}
                onClick={() => setDirection('outgoing')}
                className="flex-1"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                {t('cmdb.relations.outgoing', { defaultValue: 'Sortant' })}
              </Button>
              <Button
                type="button"
                variant={direction === 'incoming' ? 'default' : 'outline'}
                onClick={() => setDirection('incoming')}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('cmdb.relations.incoming', { defaultValue: 'Entrant' })}
              </Button>
            </div>
          </div>

          {/* Target CI */}
          <div className="space-y-2">
            <Label htmlFor="targetId">
              {direction === 'outgoing'
                ? t('cmdb.relations.targetCI', { defaultValue: 'CI Cible' })
                : t('cmdb.relations.sourceCI', { defaultValue: 'CI Source' })}
            </Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un CI" />
              </SelectTrigger>
              <SelectContent>
                {availableCIs.map((c) => {
                  const Icon = getCIClassIcon(c.ciClass);
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground">({c.ciClass})</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Relationship Type */}
          <div className="space-y-2">
            <Label htmlFor="relationshipType">
              {t('cmdb.relations.type', { defaultValue: 'Type de Relation' })}
            </Label>
            <Select
              value={relationshipType}
              onValueChange={(v) => setRelationshipType(v as RelationshipType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {validTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {getRelationshipLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visual Preview */}
          <div className="p-4 bg-muted/30 rounded-xl border border-border/40">
            <p className="text-sm text-muted-foreground text-center">
              {direction === 'outgoing' ? (
                <>
                  <span className="font-medium text-foreground">{ci.name}</span>
                  {' → '}
                  <span className="text-primary">{getRelationshipLabel(relationshipType)}</span>
                  {' → '}
                  <span className="font-medium text-foreground">
                    {availableCIs.find((c) => c.id === targetId)?.name || '...'}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">
                    {availableCIs.find((c) => c.id === targetId)?.name || '...'}
                  </span>
                  {' → '}
                  <span className="text-primary">{getRelationshipLabel(relationshipType)}</span>
                  {' → '}
                  <span className="font-medium text-foreground">{ci.name}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('common.cancel', { defaultValue: 'Annuler' })}
          </Button>
          <Button onClick={handleSubmit} disabled={!targetId || isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4 mr-2" />
            )}
            {t('common.add', { defaultValue: 'Ajouter' })}
          </Button>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CIInspectorRelations: React.FC<CIInspectorRelationsProps> = ({
  ci,
  canEdit = true,
}) => {
  const { t } = useStore();

  // Fetch relationships for this CI
  const { data: relationships, isLoading, error } = useCMDBRelationships(ci.id);
  const { createRelationship, deleteRelationship } = useCMDBRelationshipMutations();

  // Fetch all CIs for resolution
  const { data: allCIs } = useCMDBCIs({});

  // Separate relationships into outgoing and incoming
  const { outgoing, incoming } = useMemo(() => {
    if (!relationships) return { outgoing: [], incoming: [] };
    return {
      outgoing: relationships.filter((r) => r.sourceId === ci.id),
      incoming: relationships.filter((r) => r.targetId === ci.id),
    };
  }, [relationships, ci.id]);

  // Resolve CI by ID
  const getCIById = (id: string): ConfigurationItem | null => {
    return (allCIs?.items || []).find((c) => c.id === id) || null;
  };

  // Handle add relationship
  const handleAddRelationship = async (
    targetId: string,
    relationshipType: RelationshipType,
    direction: 'outgoing' | 'incoming'
  ) => {
    const targetCI = getCIById(targetId);
    if (!targetCI) return;

    await createRelationship.mutateAsync({
      sourceId: direction === 'outgoing' ? ci.id : targetId,
      sourceCIClass: direction === 'outgoing' ? ci.ciClass : targetCI.ciClass,
      targetId: direction === 'outgoing' ? targetId : ci.id,
      targetCIClass: direction === 'outgoing' ? targetCI.ciClass : ci.ciClass,
      relationshipType,
      direction: 'unidirectional',
      criticality: 'Medium',
      status: 'Active',
      discoveredBy: 'Manual',
      confidence: 100,
    });
  };

  // Handle delete relationship
  const handleDeleteRelationship = async (relationshipId: string) => {
    await deleteRelationship.mutateAsync(relationshipId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-3" />
        <p className="text-sm text-destructive">
          {t('cmdb.relations.error', { defaultValue: 'Erreur lors du chargement des relations' })}
        </p>
      </div>
    );
  }

  const hasRelationships = outgoing.length > 0 || incoming.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          {t('cmdb.relations.title', { defaultValue: 'Relations' })}
          {hasRelationships && (
            <Badge variant="soft" className="ml-2">
              {outgoing.length + incoming.length}
            </Badge>
          )}
        </h3>

        {canEdit && (
          <AddRelationshipDialog ci={ci} onAdd={handleAddRelationship} />
        )}
      </div>

      {/* Empty state */}
      {!hasRelationships && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-full bg-muted/50 mb-4">
            <Unlink className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-medium">
            {t('cmdb.relations.empty', { defaultValue: 'Aucune relation' })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {t('cmdb.relations.emptyDescription', {
              defaultValue: 'Ce CI n\'a pas encore de relations définies',
            })}
          </p>
        </div>
      )}

      {/* Outgoing relationships */}
      {outgoing.length > 0 && (
        <div className="glass-premium p-6 rounded-3xl border border-border/40">
          <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-blue-600" />
            {t('cmdb.relations.outgoing', { defaultValue: 'Relations Sortantes' })}
            <Badge variant="soft" className="ml-2">{outgoing.length}</Badge>
          </h4>
          <div className="space-y-3">
            {outgoing.map((rel) => (
              <RelationshipCard
                key={rel.id}
                relationship={rel}
                targetCI={getCIById(rel.targetId)}
                isSource
                canEdit={canEdit}
                onDelete={() => handleDeleteRelationship(rel.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Incoming relationships */}
      {incoming.length > 0 && (
        <div className="glass-premium p-6 rounded-3xl border border-border/40">
          <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
            <ArrowLeft className="h-4 w-4 text-green-600" />
            {t('cmdb.relations.incoming', { defaultValue: 'Relations Entrantes' })}
            <Badge variant="soft" className="ml-2">{incoming.length}</Badge>
          </h4>
          <div className="space-y-3">
            {incoming.map((rel) => (
              <RelationshipCard
                key={rel.id}
                relationship={rel}
                targetCI={getCIById(rel.sourceId)}
                isSource={false}
                canEdit={canEdit}
                onDelete={() => handleDeleteRelationship(rel.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CIInspectorRelations;
