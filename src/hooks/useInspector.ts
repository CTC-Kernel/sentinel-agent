/**
 * Hook personnalisé pour mutualiser la logique des Inspectors
 *
 * Centralise la gestion:
 * - Tab navigation avec URL sync
 * - Actions CRUD (update, create, delete)
 * - Loading states
 * - Error handling
 * - Breadcrumbs
 *
 * @module useInspector
 */

import { useState, useCallback, useMemo, useEffect, useTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { ErrorHandler, ErrorSeverity, ErrorCategory } from '../utils/errorHandler';

/**
 * Configuration d'un onglet
 */
export interface InspectorTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: number | string;
  disabled?: boolean;
}

/**
 * Configuration des actions CRUD
 */
export interface InspectorActions<TFormData> {
  onUpdate?: (id: string, data: TFormData) => Promise<boolean | string>;
  onCreate?: (data: TFormData) => Promise<boolean | string>;
  onDelete?: (id: string, name: string) => Promise<void>;
}

/**
 * Options de configuration de l'inspector
 */
export interface UseInspectorOptions<T, TFormData> {
  /** Entité sélectionnée (null pour création) */
  entity: T | null;

  /** Liste des tabs */
  tabs: InspectorTab[];

  /** Tab par défaut */
  defaultTab?: string;

  /** Actions CRUD */
  actions: InspectorActions<TFormData>;

  /** Nom du module (pour le contexte d'erreur) */
  moduleName: string;

  /** Fonction pour obtenir le nom de l'entité */
  getEntityName?: (entity: T) => string;

  /** Breadcrumbs personnalisés */
  breadcrumbs?: { label: string; onClick?: () => void }[];

  /** Callback après succès */
  onSuccess?: () => void;

  /** Sync tab avec URL query params */
  syncWithUrl?: boolean;
}

/**
 * Retour du hook
 */
/**
 * Retour du hook
 */
export interface UseInspectorReturn {
  /** Tab actif */
  activeTab: string;

  /** Changer de tab */
  setActiveTab: (tabId: string) => void;

  /** État de chargement */
  loading: boolean;

  /** État de sauvegarde */
  saving: boolean;

  /** Gérer la mise à jour */
  handleUpdate: (data: unknown) => Promise<void>;

  /** Gérer la création */
  handleCreate: (data: unknown) => Promise<void>;

  /** Gérer la suppression */
  handleDelete: () => Promise<void>;

  /** Breadcrumbs */
  breadcrumbs?: { label: string; onClick?: () => void }[];

  /** Est en mode création */
  isCreateMode: boolean;

  /** État de transition (onglet en cours de chargement) */
  isPending: boolean;

  /** Nom de l'entité */
  entityName: string | null;

  /** Mode édition actif (pour update) */
  isEditing: boolean;
  toggleEditMode: () => void;
  enterEditMode: () => void;
  exitEditMode: () => void;
}

/**
 * Hook useInspector
 *
 * @template T - Type de l'entité
 * @template TFormData - Type des données du formulaire
 *
 * @example
 * ```typescript
 * const inspector = useInspector({
 *   entity: selectedAsset,
 *   tabs: assetTabs,
 *   actions: {
 *     onUpdate: handleUpdateAsset,
 *     onCreate: handleCreateAsset,
 *     onDelete: handleDeleteAsset
 *   },
 *   moduleName: 'Asset',
 *   getEntityName: (asset) => asset.name,
 *   syncWithUrl: true
 * });
 *
 * // Dans le composant
 * <InspectorLayout
 *   activeTab={inspector.activeTab}
 *   onTabChange={inspector.setActiveTab}
 *   breadcrumbs={inspector.breadcrumbs}
 * >
 *   {inspector.activeTab === 'details' && (
 *     <AssetForm
 *       onSubmit={inspector.isCreateMode ? inspector.handleCreate : inspector.handleUpdate}
 *       loading={inspector.saving}
 *     />
 *   )}
 * </InspectorLayout>
 * ```
 */
export function useInspector<T extends { id?: string }, TFormData = T>({
  entity,
  tabs,
  defaultTab,
  actions,
  moduleName,
  getEntityName = (e: T) => (e as { name?: string }).name || 'Item',
  breadcrumbs: customBreadcrumbs,
  onSuccess,
  syncWithUrl = false
}: UseInspectorOptions<T, TFormData>): UseInspectorReturn {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // État
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Toggle edit state
  const toggleEditMode = useCallback(() => setIsEditing(prev => !prev), []);
  const enterEditMode = useCallback(() => setIsEditing(true), []);
  const exitEditMode = useCallback(() => setIsEditing(false), []);

  // Mode création
  const isCreateMode = !entity || !entity.id;

  // Nom de l'entité
  const entityName = useMemo(() => {
    if (isCreateMode) return null;
    return getEntityName(entity as T);
  }, [entity, isCreateMode, getEntityName]);

  // Tab actif
  const [internalTab, setInternalTab] = useState<string>(
    defaultTab || tabs[0]?.id || 'details'
  );
  const [isPending, startTransition] = useTransition();

  // Tab actif (sync avec URL si activé)
  const activeTab = useMemo(() => {
    if (syncWithUrl) {
      const urlTab = searchParams.get('tab');
      if (urlTab && tabs.some(t => t.id === urlTab)) {
        return urlTab;
      }
    }
    return internalTab;
  }, [syncWithUrl, searchParams, internalTab, tabs]);

  // Changer de tab
  const setActiveTab = useCallback((tabId: string) => {
    startTransition(() => {
      setInternalTab(tabId);

      if (syncWithUrl) {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('tab', tabId);
        setSearchParams(newParams, { replace: true });
      }
    });
  }, [syncWithUrl, searchParams, setSearchParams]);

  // Sync initial depuis URL
  useEffect(() => {
    if (syncWithUrl && !isCreateMode) {
      const urlTab = searchParams.get('tab');
      if (urlTab && tabs.some(t => t.id === urlTab)) {
        setInternalTab(urlTab);
      }
    }
  }, [syncWithUrl, searchParams, tabs, isCreateMode]);

  // Gérer la mise à jour
  const handleUpdate = useCallback(async (data: unknown) => {
    if (!entity?.id || !actions.onUpdate) {
      ErrorHandler.handle(
        new Error('Update action not configured'),
        `${moduleName}.handleUpdate`,
        {
          severity: ErrorSeverity.MEDIUM,
          showToast: false
        }
      );
      return;
    }

    setSaving(true);

    try {
      const result = await actions.onUpdate(entity.id, data as TFormData);

      if (result === true) {
        ErrorHandler.handle(
          new Error(`${moduleName} mis à jour avec succès`),
          `${moduleName}.handleUpdate`,
          {
            severity: ErrorSeverity.LOW,
            userMessage: `${entityName || moduleName} mis à jour avec succès`,
            showToast: true
          }
        );

        onSuccess?.();
      } else if (typeof result === 'string') {
        // Message d'erreur custom
        ErrorHandler.handle(
          new Error(result),
          `${moduleName}.handleUpdate`,
          {
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.BUSINESS_LOGIC,
            userMessage: result,
            showToast: true
          }
        );
      }
    } catch (error) {
      ErrorHandler.handle(error, `${moduleName}.handleUpdate`, {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        userMessage: `Erreur lors de la mise à jour de ${entityName || moduleName}`,
        logToSentry: true,
        showToast: true
      });
    } finally {
      setSaving(false);
    }
  }, [entity, actions, moduleName, entityName, onSuccess]);

  // Gérer la création
  const handleCreate = useCallback(async (data: unknown) => {
    if (!actions.onCreate) {
      ErrorHandler.handle(
        new Error('Create action not configured'),
        `${moduleName}.handleCreate`,
        {
          severity: ErrorSeverity.MEDIUM,
          showToast: false
        }
      );
      return;
    }

    setSaving(true);

    try {
      const result = await actions.onCreate(data as TFormData);

      if (result === true) {
        ErrorHandler.handle(
          new Error(`${moduleName} créé avec succès`),
          `${moduleName}.handleCreate`,
          {
            severity: ErrorSeverity.LOW,
            userMessage: `${moduleName} créé avec succès`,
            showToast: true
          }
        );

        onSuccess?.();
      } else if (typeof result === 'string') {
        // Message d'erreur custom
        ErrorHandler.handle(
          new Error(result),
          `${moduleName}.handleCreate`,
          {
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.BUSINESS_LOGIC,
            userMessage: result,
            showToast: true
          }
        );
      }
    } catch (error) {
      ErrorHandler.handle(error, `${moduleName}.handleCreate`, {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        userMessage: `Erreur lors de la création de ${moduleName}`,
        logToSentry: true,
        showToast: true
      });
    } finally {
      setSaving(false);
    }
  }, [actions, moduleName, onSuccess]);

  // Gérer la suppression
  const handleDelete = useCallback(async () => {
    if (!entity?.id || !actions.onDelete) {
      ErrorHandler.handle(
        new Error('Delete action not configured'),
        `${moduleName}.handleDelete`,
        {
          severity: ErrorSeverity.MEDIUM,
          showToast: false
        }
      );
      return;
    }

    setLoading(true);

    try {
      await actions.onDelete(entity.id, entityName || 'Item');

      ErrorHandler.handle(
        new Error(`${moduleName} supprimé avec succès`),
        `${moduleName}.handleDelete`,
        {
          severity: ErrorSeverity.LOW,
          userMessage: `${entityName || moduleName} supprimé avec succès`,
          showToast: true
        }
      );

      onSuccess?.();
    } catch (error) {
      ErrorHandler.handle(error, `${moduleName}.handleDelete`, {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        userMessage: `Erreur lors de la suppression de ${entityName || moduleName}`,
        logToSentry: true,
        showToast: true
      });
    } finally {
      setLoading(false);
    }
  }, [entity, actions, moduleName, entityName, onSuccess]);

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (customBreadcrumbs) {
      return customBreadcrumbs;
    }

    if (isCreateMode) {
      return [
        { label: moduleName, onClick: () => navigate(-1) },
        { label: 'Nouveau' }
      ];
    }

    return [
      { label: moduleName, onClick: () => navigate(-1) },
      { label: entityName || 'Détails' }
    ];
  }, [customBreadcrumbs, isCreateMode, moduleName, entityName, navigate]);

  return useMemo(() => ({
    activeTab,
    setActiveTab,
    loading,
    saving,
    handleUpdate,
    handleCreate,
    handleDelete,
    breadcrumbs,
    isCreateMode,
    entityName,
    isEditing,
    toggleEditMode,
    enterEditMode,
    exitEditMode,
    isPending
  }), [
    activeTab,
    setActiveTab,
    loading,
    saving,
    handleUpdate,
    handleCreate,
    handleDelete,
    breadcrumbs,
    isCreateMode,
    entityName,
    isEditing,
    toggleEditMode,
    enterEditMode,
    exitEditMode,
    isPending
  ]);
}

/**
 * Variante simplifiée pour les inspectors en lecture seule
 */
export function useInspectorReadOnly<T extends { id?: string }>(
  entity: T | null,
  tabs: InspectorTab[],
  moduleName: string,
  options?: {
    defaultTab?: string;
    syncWithUrl?: boolean;
    getEntityName?: (entity: T) => string;
  }
): Pick<UseInspectorReturn, 'activeTab' | 'setActiveTab' | 'breadcrumbs' | 'entityName' | 'isEditing' | 'toggleEditMode' | 'enterEditMode' | 'exitEditMode' | 'isPending'> {
  const inspector = useInspector<T, never>({
    entity,
    tabs,
    defaultTab: options?.defaultTab,
    actions: {},
    moduleName,
    getEntityName: options?.getEntityName,
    syncWithUrl: options?.syncWithUrl
  });

  return {
    activeTab: inspector.activeTab,
    setActiveTab: inspector.setActiveTab,
    breadcrumbs: inspector.breadcrumbs,
    entityName: inspector.entityName,
    isEditing: false,
    toggleEditMode: () => { },
    enterEditMode: () => { },
    exitEditMode: () => { },
    isPending: inspector.isPending
  };
}
