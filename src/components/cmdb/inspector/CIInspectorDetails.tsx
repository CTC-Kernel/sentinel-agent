/**
 * CI Inspector Details Tab
 *
 * Form component for viewing and editing Configuration Item details.
 * Includes all core CI fields and class-specific attributes.
 *
 * @module components/cmdb/inspector/CIInspectorDetails
 */

import React, { useEffect, useMemo } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Server,
  Database,
  Globe,
  Cloud,
  FileText,
  Network,
  Box,
  Save,
  RotateCcw,
  Loader2,
  User,
  Cpu,
  Wifi,
  LucideIcon,
} from '../../ui/Icons';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Label } from '../../ui/label';
import { useStore } from '@/store';
import { useTeamData } from '@/hooks/team/useTeamData';
import { ConfigurationItem, CIClass } from '@/types/cmdb';
import { createCISchema, CreateCIFormData } from '@/schemas/cmdbSchema';
import { cn } from '@/lib/utils';

// =============================================================================
// PROPS
// =============================================================================

interface CIInspectorDetailsProps {
  /** CI to edit (null for creation) */
  ci: ConfigurationItem | null;
  /** Form submission handler */
  onSubmit: (data: CreateCIFormData) => Promise<void>;
  /** Whether editing existing CI */
  isEditing: boolean;
  /** Cancel handler */
  onCancel: () => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Dirty state change callback */
  onDirtyChange?: (dirty: boolean) => void;
  /** Loading state */
  isLoading?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

const CI_CLASSES: { value: CIClass; label: string; icon: LucideIcon }[] = [
  { value: 'Hardware', label: 'Hardware', icon: Server },
  { value: 'Software', label: 'Software', icon: Database },
  { value: 'Service', label: 'Service', icon: Globe },
  { value: 'Cloud', label: 'Cloud', icon: Cloud },
  { value: 'Document', label: 'Document', icon: FileText },
  { value: 'Network', label: 'Network', icon: Network },
  { value: 'Container', label: 'Container', icon: Box },
];

const CI_TYPES_BY_CLASS: Record<CIClass, string[]> = {
  Hardware: ['Server', 'Workstation', 'Laptop', 'Network_Device', 'Storage', 'IoT', 'OT_Device'],
  Software: ['Application', 'Operating_System', 'Middleware', 'Database', 'Security_Tool'],
  Service: ['Business_Service', 'IT_Service', 'Infrastructure_Service'],
  Document: ['Policy', 'Procedure', 'Standard', 'Configuration'],
  Network: ['Subnet', 'VLAN', 'VPN', 'DNS_Zone', 'Firewall_Rule'],
  Cloud: ['EC2', 'RDS', 'S3', 'Lambda', 'Azure_VM', 'GCP_Instance'],
  Container: ['Docker', 'Kubernetes_Pod', 'Namespace', 'Service_Mesh'],
};

const CI_STATUSES = [
  { value: 'In_Use', label: 'En Utilisation' },
  { value: 'In_Stock', label: 'En Stock' },
  { value: 'In_Maintenance', label: 'En Maintenance' },
  { value: 'Retired', label: 'Retiré' },
  { value: 'Missing', label: 'Manquant' },
];

const CI_ENVIRONMENTS = [
  { value: 'Production', label: 'Production' },
  { value: 'Staging', label: 'Staging' },
  { value: 'Development', label: 'Développement' },
  { value: 'Test', label: 'Test' },
  { value: 'DR', label: 'DR (Disaster Recovery)' },
];

const CI_CRITICALITIES = [
  { value: 'Critical', label: 'Critique' },
  { value: 'High', label: 'Élevée' },
  { value: 'Medium', label: 'Moyenne' },
  { value: 'Low', label: 'Faible' },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CIInspectorDetails: React.FC<CIInspectorDetailsProps> = ({
  ci,
  onSubmit,
  isEditing,
  onCancel,
  readOnly = false,
  onDirtyChange,
  isLoading = false,
}) => {
  const { t, user } = useStore();
  const { users = [] } = useTeamData();

  // Default values for form
  const defaultValues = useMemo<CreateCIFormData>(() => {
    if (ci) {
      return {
        ciClass: ci.ciClass,
        ciType: ci.ciType,
        name: ci.name,
        description: ci.description || '',
        status: ci.status,
        environment: ci.environment,
        criticality: ci.criticality,
        ownerId: ci.ownerId,
        supportGroupId: ci.supportGroupId || '',
        fingerprint: ci.fingerprint || {},
        discoverySource: ci.discoverySource,
        sourceAgentId: ci.sourceAgentId || '',
        legacyAssetId: ci.legacyAssetId || '',
        attributes: ci.attributes || {},
      };
    }
    return {
      ciClass: 'Hardware',
      ciType: 'Server',
      name: '',
      description: '',
      status: 'In_Use',
      environment: 'Production',
      criticality: 'Medium',
      ownerId: user?.uid || '',
      supportGroupId: '',
      fingerprint: {},
      discoverySource: 'Manual',
      sourceAgentId: '',
      legacyAssetId: '',
      attributes: {},
    };
  }, [ci, user?.uid]);

  const {
    register,
    control,
    handleSubmit,
    _watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<CreateCIFormData>({
    resolver: zodResolver(createCISchema),
    defaultValues,
  });

  // Watch for dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Reset form when CI changes
  useEffect(() => {
    reset(defaultValues);
  }, [ci?.id, defaultValues, reset]);

  const selectedClass = useWatch({ control, name: 'ciClass' });
  const availableTypes = CI_TYPES_BY_CLASS[selectedClass] || [];

  const handleFormSubmit = async (data: CreateCIFormData) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
      {/* Classification Section */}
      <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
          <Box className="h-4 w-4" />
          {t('cmdb.inspector.classification', { defaultValue: 'Classification' })}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CI Class */}
          <div className="space-y-2">
            <Label htmlFor="ciClass">
              {t('cmdb.fields.ciClass', { defaultValue: 'Classe CI' })} *
            </Label>
            <Controller
              name="ciClass"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isEditing || readOnly}
                >
                  <SelectTrigger id="ciClass">
                    <SelectValue placeholder="Sélectionner une classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {CI_CLASSES.map((cls) => (
                      <SelectItem key={cls.value} value={cls.value}>
                        <div className="flex items-center gap-2">
                          <cls.icon className="h-4 w-4" />
                          {cls.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.ciClass && (
              <p className="text-xs text-destructive">{errors.ciClass.message}</p>
            )}
          </div>

          {/* CI Type */}
          <div className="space-y-2">
            <Label htmlFor="ciType">
              {t('cmdb.fields.ciType', { defaultValue: 'Type CI' })} *
            </Label>
            <Controller
              name="ciType"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={readOnly}
                >
                  <SelectTrigger id="ciType">
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.ciType && (
              <p className="text-xs text-destructive">{errors.ciType.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Core Details Section */}
      <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {t('cmdb.inspector.coreDetails', { defaultValue: 'Informations Générales' })}
        </h3>

        <div className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              {t('cmdb.fields.name', { defaultValue: 'Nom' })} *
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="ex: SRV-PROD-01"
              disabled={readOnly}
              className={cn(errors.name && 'border-destructive')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              {t('cmdb.fields.description', { defaultValue: 'Description' })}
            </Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Description du CI..."
              rows={3}
              disabled={readOnly}
            />
          </div>

          {/* Status, Environment, Criticality */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="status">
                {t('cmdb.fields.status', { defaultValue: 'Statut' })}
              </Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={readOnly}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CI_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="environment">
                {t('cmdb.fields.environment', { defaultValue: 'Environnement' })}
              </Label>
              <Controller
                name="environment"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={readOnly}
                  >
                    <SelectTrigger id="environment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CI_ENVIRONMENTS.map((e) => (
                        <SelectItem key={e.value} value={e.value}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="criticality">
                {t('cmdb.fields.criticality', { defaultValue: 'Criticité' })}
              </Label>
              <Controller
                name="criticality"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={readOnly}
                  >
                    <SelectTrigger id="criticality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CI_CRITICALITIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ownership Section */}
      <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
          <User className="h-4 w-4" />
          {t('cmdb.inspector.ownership', { defaultValue: 'Propriété' })}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Owner */}
          <div className="space-y-2">
            <Label htmlFor="ownerId">
              {t('cmdb.fields.owner', { defaultValue: 'Propriétaire' })} *
            </Label>
            <Controller
              name="ownerId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={readOnly}
                >
                  <SelectTrigger id="ownerId">
                    <SelectValue placeholder="Sélectionner un propriétaire" />
                  </SelectTrigger>
                  <SelectContent>
                    {(users || []).map((u: { uid: string; displayName?: string; email?: string }) => (
                      <SelectItem key={u.uid} value={u.uid}>
                        {u.displayName || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.ownerId && (
              <p className="text-xs text-destructive">{errors.ownerId.message}</p>
            )}
          </div>

          {/* Support Group */}
          <div className="space-y-2">
            <Label htmlFor="supportGroupId">
              {t('cmdb.fields.supportGroup', { defaultValue: 'Groupe de Support' })}
            </Label>
            <Input
              id="supportGroupId"
              {...register('supportGroupId')}
              placeholder="ex: IT-Infrastructure"
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      {/* Fingerprint Section (for Hardware) */}
      {selectedClass === 'Hardware' && (
        <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            {t('cmdb.inspector.fingerprint', { defaultValue: 'Empreinte Digitale' })}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="fingerprint.serialNumber">
                {t('cmdb.fields.serialNumber', { defaultValue: 'Numéro de Série' })}
              </Label>
              <Input
                id="fingerprint.serialNumber"
                {...register('fingerprint.serialNumber')}
                placeholder="ex: SN123456789"
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fingerprint.primaryMacAddress">
                {t('cmdb.fields.macAddress', { defaultValue: 'Adresse MAC' })}
              </Label>
              <Input
                id="fingerprint.primaryMacAddress"
                {...register('fingerprint.primaryMacAddress')}
                placeholder="ex: 00:1a:2b:3c:4d:5e"
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fingerprint.hostname">
                {t('cmdb.fields.hostname', { defaultValue: 'Hostname' })}
              </Label>
              <Input
                id="fingerprint.hostname"
                {...register('fingerprint.hostname')}
                placeholder="ex: srv-prod-01"
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fingerprint.fqdn">
                {t('cmdb.fields.fqdn', { defaultValue: 'FQDN' })}
              </Label>
              <Input
                id="fingerprint.fqdn"
                {...register('fingerprint.fqdn')}
                placeholder="ex: srv-prod-01.example.com"
                disabled={readOnly}
              />
            </div>
          </div>
        </div>
      )}

      {/* Discovery Info (read-only for existing CIs) */}
      {ci && (
        <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            {t('cmdb.inspector.discovery', { defaultValue: 'Découverte' })}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-muted/50 rounded-2xl">
              <span className="text-[11px] uppercase text-muted-foreground font-bold block mb-1">
                Source
              </span>
              <p className="text-sm font-medium">{ci.discoverySource}</p>
            </div>

            {ci.lastDiscoveredAt && (
              <div className="p-4 bg-muted/50 rounded-2xl">
                <span className="text-[11px] uppercase text-muted-foreground font-bold block mb-1">
                  Dernière Découverte
                </span>
                <p className="text-sm font-medium">
                  {ci.lastDiscoveredAt.toDate().toLocaleString()}
                </p>
              </div>
            )}

            <div className="p-4 bg-muted/50 rounded-2xl">
              <span className="text-[11px] uppercase text-muted-foreground font-bold block mb-1">
                Score Qualité
              </span>
              <p className={cn(
                'text-sm font-bold',
                ci.dataQualityScore >= 80 ? 'text-success' :
                ci.dataQualityScore >= 60 ? 'text-warning' : 'text-destructive'
              )}>
                {ci.dataQualityScore}/100
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form Actions */}
      {!readOnly && (
        <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset(defaultValues)}
            disabled={!isDirty || isLoading}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('common.reset', { defaultValue: 'Réinitialiser' })}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            {t('common.cancel', { defaultValue: 'Annuler' })}
          </Button>
          <Button
            type="submit"
            disabled={!isDirty || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing
              ? t('common.save', { defaultValue: 'Enregistrer' })
              : t('common.create', { defaultValue: 'Créer' })}
          </Button>
        </div>
      )}
    </form>
  );
};

export default CIInspectorDetails;
