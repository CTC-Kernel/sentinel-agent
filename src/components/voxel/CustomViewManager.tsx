/**
 * Story 31.4 - Custom View Manager
 *
 * Component for saving, loading, editing, and deleting custom Voxel views.
 * Provides a modal interface for managing user's saved views.
 */

import React, { useState, useCallback } from 'react';
import {
  Save,
  Trash2,
  Edit2,
  Play,
  X,
  Plus,
  Layers,
  LayoutGrid,
  Camera,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useViewPresets } from '@/hooks/voxel/useViewPresets';
import type { CustomViewConfig } from '@/stores/viewPresets';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// ============================================================================
// Types
// ============================================================================

interface CustomViewManagerProps {
  /** Whether the manager modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Optional: open directly to save mode */
  initialMode?: 'list' | 'save';
}

type ManagerMode = 'list' | 'save' | 'edit';

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Visual preview of a custom view's layers
 */
function LayerPreview({ layers }: { layers: string[] }) {
  const layerColors: Record<string, string> = {
    asset: 'bg-blue-500',
    risk: 'bg-red-500',
    control: 'bg-green-500',
    incident: 'bg-orange-500',
    supplier: 'bg-purple-500',
    project: 'bg-cyan-500',
    audit: 'bg-amber-500',
  };

  const layerLabels: Record<string, string> = {
    asset: 'Actifs',
    risk: 'Risques',
    control: 'Controles',
    incident: 'Incidents',
    supplier: 'Fournisseurs',
    project: 'Projets',
    audit: 'Audits',
  };

  return (
    <div className="flex flex-wrap gap-1">
      {layers.map((layer) => (
        <span
          key={layer}
          className={cn(
            'px-1.5 py-0.5 text-[10px] font-medium rounded text-white',
            layerColors[layer] || 'bg-gray-500'
          )}
        >
          {layerLabels[layer] || layer}
        </span>
      ))}
    </div>
  );
}

/**
 * Card displaying a single custom view
 */
function CustomViewCard({
  view,
  onApply,
  onEdit,
  onDelete,
}: {
  view: CustomViewConfig;
  onApply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group border rounded-lg p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate">{view.name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {view.description}
          </p>
        </div>
        <span className="text-lg">{view.icon}</span>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Layers className="h-3 w-3" />
          <LayerPreview layers={view.layers} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <LayoutGrid className="h-3 w-3" />
          <span className="capitalize">{view.layout}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Camera className="h-3 w-3" />
          <span>
            ({Math.round(view.camera.position.x)}, {Math.round(view.camera.position.y)}, {Math.round(view.camera.position.z)})
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(view.updatedAt, { addSuffix: true, locale: fr })}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onApply} title="Appliquer">
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Modifier">
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} title="Supprimer">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for custom view cards
 */
function CustomViewSkeleton() {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48 mt-2" />
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CustomViewManager({
  isOpen,
  onClose,
  initialMode = 'list',
}: CustomViewManagerProps) {
  const {
    customViews,
    isLoadingCustomViews,
    applyCustomView,
    saveCurrentAsCustom,
    updateCustomView,
    deleteCustomView,
    refreshCustomViews,
  } = useViewPresets();

  const [mode, setMode] = useState<ManagerMode>(initialMode);
  const [editingView, setEditingView] = useState<CustomViewConfig | null>(null);
  const [deleteConfirmView, setDeleteConfirmView] = useState<CustomViewConfig | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when mode changes
  React.useEffect(() => {
    if (mode === 'save') {
      setFormName('');
      setFormDescription('');
      setError(null);
    } else if (mode === 'edit' && editingView) {
      setFormName(editingView.name);
      setFormDescription(editingView.description);
      setError(null);
    }
  }, [mode, editingView]);

  // Reset to list mode when opened with list initial mode
  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setEditingView(null);
      setDeleteConfirmView(null);
    }
  }, [isOpen, initialMode]);

  /**
   * Handle saving a new custom view
   */
  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      setError('Le nom est requis');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await saveCurrentAsCustom(formName.trim(), formDescription.trim());
      if (result) {
        setMode('list');
        setFormName('');
        setFormDescription('');
      } else {
        setError('Impossible de sauvegarder la vue');
      }
    } catch (err) {
      setError('Une erreur est survenue');
    } finally {
      setIsSaving(false);
    }
  }, [formName, formDescription, saveCurrentAsCustom]);

  /**
   * Handle updating an existing custom view
   */
  const handleUpdate = useCallback(async () => {
    if (!editingView || !formName.trim()) {
      setError('Le nom est requis');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const success = await updateCustomView(editingView.id, {
        name: formName.trim(),
        description: formDescription.trim(),
      });
      if (success) {
        setMode('list');
        setEditingView(null);
      } else {
        setError('Impossible de mettre a jour la vue');
      }
    } catch (err) {
      setError('Une erreur est survenue');
    } finally {
      setIsSaving(false);
    }
  }, [editingView, formName, formDescription, updateCustomView]);

  /**
   * Handle deleting a custom view
   */
  const handleDelete = useCallback(async () => {
    if (!deleteConfirmView) return;

    try {
      await deleteCustomView(deleteConfirmView.id);
    } catch (err) {
      console.error('Failed to delete view:', err);
    } finally {
      setDeleteConfirmView(null);
    }
  }, [deleteConfirmView, deleteCustomView]);

  /**
   * Handle applying a custom view
   */
  const handleApply = useCallback((view: CustomViewConfig) => {
    applyCustomView(view);
    onClose();
  }, [applyCustomView, onClose]);

  /**
   * Handle editing a custom view
   */
  const handleEdit = useCallback((view: CustomViewConfig) => {
    setEditingView(view);
    setMode('edit');
  }, []);

  /**
   * Render the form (save or edit mode)
   */
  const renderForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="view-name">Nom de la vue *</Label>
        <Input
          id="view-name"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="Ma vue personnalisee"
          maxLength={50}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="view-description">Description</Label>
        <Textarea
          id="view-description"
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          placeholder="Description optionnelle de la vue..."
          rows={3}
          maxLength={200}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );

  /**
   * Render the list of custom views
   */
  const renderList = () => {
    if (isLoadingCustomViews) {
      return (
        <div className="grid gap-3">
          <CustomViewSkeleton />
          <CustomViewSkeleton />
        </div>
      );
    }

    if (customViews.length === 0) {
      return (
        <div className="text-center py-8">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h4 className="mt-4 font-medium">Aucune vue personnalisee</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Enregistrez votre configuration actuelle pour y acceder rapidement.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setMode('save')}>
            <Plus className="h-4 w-4 mr-2" />
            Creer une vue
          </Button>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[400px] pr-4">
        <div className="grid gap-3">
          {customViews.map((view) => (
            <CustomViewCard
              key={view.id}
              view={view}
              onApply={() => handleApply(view)}
              onEdit={() => handleEdit(view)}
              onDelete={() => setDeleteConfirmView(view)}
            />
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === 'save' && 'Enregistrer la vue actuelle'}
              {mode === 'edit' && 'Modifier la vue'}
              {mode === 'list' && 'Vues personnalisees'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'save' && 'Donnez un nom a votre configuration actuelle pour la retrouver facilement.'}
              {mode === 'edit' && 'Modifiez le nom et la description de votre vue.'}
              {mode === 'list' && `Vous avez ${customViews.length} vue${customViews.length !== 1 ? 's' : ''} sauvegardee${customViews.length !== 1 ? 's' : ''}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {mode === 'list' && renderList()}
            {(mode === 'save' || mode === 'edit') && renderForm()}
          </div>

          <DialogFooter>
            {mode === 'list' && (
              <>
                <Button variant="outline" onClick={onClose}>
                  Fermer
                </Button>
                <Button onClick={() => setMode('save')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle vue
                </Button>
              </>
            )}
            {mode === 'save' && (
              <>
                <Button variant="outline" onClick={() => setMode('list')}>
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={isSaving || !formName.trim()}>
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </>
            )}
            {mode === 'edit' && (
              <>
                <Button variant="outline" onClick={() => { setMode('list'); setEditingView(null); }}>
                  Annuler
                </Button>
                <Button onClick={handleUpdate} disabled={isSaving || !formName.trim()}>
                  {isSaving ? 'Mise a jour...' : 'Mettre a jour'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmView} onOpenChange={(open) => !open && setDeleteConfirmView(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette vue ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. La vue "{deleteConfirmView?.name}" sera definitivement supprimee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default CustomViewManager;
