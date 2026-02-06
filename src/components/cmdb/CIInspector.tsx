/**
 * CMDB CI Inspector
 *
 * Slide-over panel for viewing and editing Configuration Item details.
 * Includes tabs for Details, Relations, History, and Impact Analysis.
 *
 * @module components/cmdb/CIInspector
 */

import React, { useMemo, useState } from 'react';
import { InspectorLayout } from '../ui/InspectorLayout';
import { useInspector } from '@/hooks/useInspector';
import { useStore } from '@/store';
import { useCMDBCI } from '@/hooks/cmdb/useCMDBCIs';
import {
  useSelectedCIId,
  useInspectorOpen,
  useCMDBActions,
} from '@/stores/cmdbStore';
import { ConfigurationItem, CIClass } from '@/types/cmdb';
import { CreateCIFormData } from '@/schemas/cmdbSchema';
import {
  Server,
  Database,
  Globe,
  Cloud,
  FileText,
  Network,
  Box,
  Plus,
  Trash2,
  LayoutDashboard,
  GitBranch,
  History,
  Zap,
  LucideIcon,
} from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { Button } from '../ui/button';
import { CIInspectorDetails } from './inspector/CIInspectorDetails';
import { CIInspectorRelations } from './inspector/CIInspectorRelations';
import { CIInspectorHistory } from './inspector/CIInspectorHistory';
import { CIInspectorImpact } from './inspector/CIInspectorImpact';
import { cn } from '@/lib/utils';

// =============================================================================
// HELPERS
// =============================================================================

const getCIClassIcon = (ciClass: CIClass | undefined): LucideIcon => {
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

const getStatusColor = (status: string | undefined) => {
  switch (status) {
    case 'In_Use': return 'bg-success/10 text-success';
    case 'In_Stock': return 'bg-primary/10 text-primary';
    case 'In_Maintenance': return 'bg-warning/10 text-warning';
    case 'Retired': return 'bg-muted text-muted-foreground';
    case 'Missing': return 'bg-destructive/10 text-destructive';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getDQSColor = (score: number) => {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-warning';
  return 'text-destructive';
};

// =============================================================================
// PROPS
// =============================================================================

interface CIInspectorProps {
  /** Whether the inspector is open */
  isOpen?: boolean;
  /** Callback when closing */
  onClose?: () => void;
  /** Pre-selected CI (optional, otherwise uses store) */
  selectedCI?: ConfigurationItem | null;
  /** Callback when CI is updated */
  onUpdate?: (id: string, data: CreateCIFormData) => Promise<boolean | string>;
  /** Callback when CI is created */
  onCreate?: (data: CreateCIFormData) => Promise<boolean | string>;
  /** Callback when CI is deleted */
  onDelete?: (id: string, name: string) => void;
  /** Whether user can edit */
  canEdit?: boolean;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CIInspector: React.FC<CIInspectorProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  selectedCI: propSelectedCI,
  onUpdate,
  onCreate,
  onDelete,
  canEdit = true,
}) => {
  const { t } = useStore();

  // Use props or store
  const storeIsOpen = useInspectorOpen();
  const storeCIId = useSelectedCIId();
  const { closeInspector } = useCMDBActions();

  const isOpen = propIsOpen ?? storeIsOpen;
  const handleClose = propOnClose ?? closeInspector;

  // Fetch CI data if using store
  const { data: fetchedCI } = useCMDBCI(propSelectedCI ? null : storeCIId);
  const selectedCI = propSelectedCI ?? fetchedCI ?? null;

  const [isFormDirty, setIsFormDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tabs configuration
  const tabs = useMemo(() => {
    const baseTabs = [
      {
        id: 'details',
        label: t('cmdb.inspector.tabs.details', { defaultValue: 'Détails' }),
        icon: LayoutDashboard,
      },
    ];

    if (!selectedCI) return baseTabs;

    return [
      ...baseTabs,
      {
        id: 'relations',
        label: t('cmdb.inspector.tabs.relations', { defaultValue: 'Relations' }),
        icon: GitBranch,
      },
      {
        id: 'history',
        label: t('cmdb.inspector.tabs.history', { defaultValue: 'Historique' }),
        icon: History,
      },
      {
        id: 'impact',
        label: t('cmdb.inspector.tabs.impact', { defaultValue: 'Impact' }),
        icon: Zap,
      },
    ];
  }, [selectedCI, t]);

  // Inspector hook
  const {
    activeTab,
    setActiveTab,
    handleUpdate: handleHookUpdate,
    handleCreate: handleHookCreate,
  } = useInspector({
    entity: selectedCI || null,
    tabs,
    moduleName: 'ConfigurationItem',
    actions: {
      onUpdate: async (id, data) => {
        if (!onUpdate) return false;
        setIsSubmitting(true);
        try {
          const result = await onUpdate(id, data as CreateCIFormData);
          if (result) setIsFormDirty(false);
          return result;
        } finally {
          setIsSubmitting(false);
        }
      },
      onCreate: async (data) => {
        if (!onCreate) return false;
        setIsSubmitting(true);
        try {
          const result = await onCreate(data as CreateCIFormData);
          if (result) {
            setIsFormDirty(false);
            handleClose();
          }
          return result;
        } finally {
          setIsSubmitting(false);
        }
      },
      onDelete: async (id, name) => onDelete?.(id, name),
    },
    getEntityName: (ci) => ci.name,
  });

  // Get icon for CI class
  const CIIcon = selectedCI ? getCIClassIcon(selectedCI.ciClass) : Plus;

  // Handle delete
  const handleDelete = () => {
    if (selectedCI && onDelete) {
      onDelete(selectedCI.id, selectedCI.name);
    }
  };

  return (
    <InspectorLayout
      isOpen={isOpen}
      onClose={handleClose}
      title={
        selectedCI
          ? selectedCI.name
          : t('cmdb.inspector.newCI', { defaultValue: 'Nouveau Configuration Item' })
      }
      subtitle={
        selectedCI ? (
          <div className="flex items-center gap-2 mt-1">
            <span>{selectedCI.ciClass}</span>
            <span className="text-muted-foreground">•</span>
            <span>{selectedCI.ciType}</span>
            {selectedCI.environment && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                  {selectedCI.environment}
                </span>
              </>
            )}
          </div>
        ) : (
          t('cmdb.inspector.newCIDescription', {
            defaultValue: 'Ajouter un nouveau CI à la CMDB',
          })
        )
      }
      icon={CIIcon}
      statusBadge={
        selectedCI ? (
          <div className="flex gap-2 items-center">
            {/* Status badge */}
            <span
              className={cn(
                'px-2 py-0.5 rounded-3xl text-xs font-bold uppercase tracking-wider',
                getStatusColor(selectedCI.status)
              )}
            >
              {selectedCI.status.replace('_', ' ')}
            </span>

            {/* DQS badge */}
            <CustomTooltip
              content={t('cmdb.inspector.dqs', { defaultValue: 'Data Quality Score' })}
            >
              <span
                className={cn(
                  'px-2 py-0.5 rounded-3xl text-xs font-bold',
                  getDQSColor(selectedCI.dataQualityScore),
                  'bg-muted/50'
                )}
              >
                DQS: {selectedCI.dataQualityScore}
              </span>
            </CustomTooltip>

            {/* Delete button */}
            {canEdit && onDelete && (
              <CustomTooltip content={t('cmdb.inspector.delete', { defaultValue: 'Retirer' })}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CustomTooltip>
            )}
          </div>
        ) : null
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      hasUnsavedChanges={isFormDirty}
    >
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Details Tab */}
        {activeTab === 'details' && (
          <CIInspectorDetails
            ci={selectedCI}
            onSubmit={async (data) => {
              if (selectedCI) {
                await handleHookUpdate(data);
              } else {
                await handleHookCreate(data);
              }
            }}
            isEditing={!!selectedCI}
            onCancel={handleClose}
            readOnly={!canEdit}
            onDirtyChange={setIsFormDirty}
            isLoading={isSubmitting}
          />
        )}

        {/* Relations Tab */}
        {activeTab === 'relations' && selectedCI && (
          <CIInspectorRelations ci={selectedCI} canEdit={canEdit} />
        )}

        {/* History Tab */}
        {activeTab === 'history' && selectedCI && (
          <CIInspectorHistory ci={selectedCI} />
        )}

        {/* Impact Tab */}
        {activeTab === 'impact' && selectedCI && (
          <CIInspectorImpact ci={selectedCI} />
        )}
      </div>
    </InspectorLayout>
  );
};

export default CIInspector;
