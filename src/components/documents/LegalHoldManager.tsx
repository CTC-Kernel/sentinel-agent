/**
 * Story 25.3 - Legal Hold Manager UI Component
 *
 * Provides interface for managing legal holds:
 * - List active and released legal holds
 * - Create new legal holds with document selection
 * - Release legal holds with confirmation
 * - View documents under each hold
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield,
  ShieldOff,
  Plus,
  Search,
  FileText,
  Calendar,
  User,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Filter,
  Loader2,
  Scale,
  Trash2,
} from '../ui/Icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '../ui/input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';

import { useStore } from '@/store';
import { useLocale } from '@/hooks/useLocale';
import { useDocumentsData } from '../../hooks/documents/useDocumentsData';
import {
  getLegalHolds,
  createLegalHold,
  releaseLegalHold,
  deleteLegalHold,
  getLegalHoldStats,
} from '@/services/legalHoldService';
import type { LegalHold, LegalHoldStatus } from '@/types/vault';
import type { Document } from '@/types/documents';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ErrorLogger } from '@/services/errorLogger';

interface LegalHoldManagerProps {
  className?: string;
}

export function LegalHoldManager({ className }: LegalHoldManagerProps) {
  const { t } = useLocale();
  const { user, organization } = useStore();
  const organizationId = organization?.id;
  const { documents } = useDocumentsData(organizationId);

  // State
  const [holds, setHolds] = useState<LegalHold[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LegalHoldStatus>('all');
  const [expandedHolds, setExpandedHolds] = useState<Set<string>>(new Set());

  // Stats
  const [stats, setStats] = useState({
    activeHolds: 0,
    releasedHolds: 0,
    documentsUnderHold: 0,
  });

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [selectedHold, setSelectedHold] = useState<LegalHold | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    reason: '',
    description: '',
    matterNumber: '',
    selectedDocuments: [] as string[],
  });
  const [releaseReason, setReleaseReason] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const loadHolds = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const data = await getLegalHolds(organizationId, { includeReleased: true });
      setHolds(data);
    } catch (error) {
      ErrorLogger.error(error, 'LegalHoldManager.loadHolds');
      toast.error(t('legalHold.error.loadFailed', 'Erreur lors du chargement des legal holds'));
    } finally {
      setLoading(false);
    }
  }, [organizationId, t]);

  const loadStats = useCallback(async () => {
    if (!organizationId) return;
    try {
      const data = await getLegalHoldStats(organizationId);
      setStats(data);
    } catch (error) {
      ErrorLogger.error(error, 'LegalHoldManager.loadStats');
    }
  }, [organizationId]);

  // Load data
  useEffect(() => {
    if (organizationId) {
      loadHolds();
      loadStats();
    }
  }, [organizationId, loadHolds, loadStats]);

  // Filter holds
  const filteredHolds = useMemo(() => {
    return holds.filter((hold) => {
      // Status filter
      if (statusFilter !== 'all' && hold.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          hold.name.toLowerCase().includes(search) ||
          hold.reason.toLowerCase().includes(search) ||
          hold.matterNumber?.toLowerCase().includes(search)
        );
      }

      return true;
    });
  }, [holds, statusFilter, searchTerm]);

  // Get documents for a hold
  const getDocumentsForHold = (holdId: string): Document[] => {
    const hold = holds.find((h) => h.id === holdId);
    if (!hold) return [];

    return documents.filter((doc) => hold.documentIds.includes(doc.id));
  };

  // Toggle hold expansion
  const toggleHoldExpanded = (holdId: string) => {
    setExpandedHolds((prev) => {
      const next = new Set(prev);
      if (next.has(holdId)) {
        next.delete(holdId);
      } else {
        next.add(holdId);
      }
      return next;
    });
  };

  // Handle create legal hold
  const handleCreate = async () => {
    if (!organizationId || !user) return;
    if (!formData.name.trim() || !formData.reason.trim()) {
      toast.error(t('legalHold.error.requiredFields', 'Veuillez remplir tous les champs obligatoires'));
      return;
    }

    setFormLoading(true);
    try {
      await createLegalHold(
        organizationId,
        formData.name,
        formData.reason,
        user.uid,
        formData.selectedDocuments,
        {
          description: formData.description || undefined,
          matterNumber: formData.matterNumber || undefined,
        }
      );

      toast.success(t('legalHold.success.created', 'Legal hold cree avec succes'));
      setCreateDialogOpen(false);
      resetForm();
      loadHolds();
      loadStats();
    } catch (error) {
      ErrorLogger.error(error, 'LegalHoldManager.createLegalHold');
      toast.error(t('legalHold.error.createFailed', 'Erreur lors de la creation du legal hold'));
    } finally {
      setFormLoading(false);
    }
  };

  // Handle release legal hold
  const handleRelease = async () => {
    if (!selectedHold || !user) return;

    setFormLoading(true);
    try {
      await releaseLegalHold(selectedHold.id, user.uid, releaseReason || undefined);

      toast.success(t('legalHold.success.released', 'Legal hold libere avec succes'));
      setReleaseDialogOpen(false);
      setSelectedHold(null);
      setReleaseReason('');
      loadHolds();
      loadStats();
    } catch (error) {
      ErrorLogger.error(error, 'LegalHoldManager.releaseLegalHold');
      toast.error(t('legalHold.error.releaseFailed', 'Erreur lors de la liberation du legal hold'));
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete legal hold
  const handleDelete = async (hold: LegalHold) => {
    if (hold.status === 'active' && hold.documentIds.length > 0) {
      toast.error(t('legalHold.error.cannotDelete', 'Impossible de supprimer un legal hold actif avec des documents'));
      return;
    }

    try {
      await deleteLegalHold(hold.id);
      toast.success(t('legalHold.success.deleted', 'Legal hold supprime'));
      loadHolds();
      loadStats();
    } catch (error) {
      ErrorLogger.error(error, 'LegalHoldManager.deleteLegalHold');
      toast.error(t('legalHold.error.deleteFailed', 'Erreur lors de la suppression'));
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      reason: '',
      description: '',
      matterNumber: '',
      selectedDocuments: [],
    });
  };

  // Toggle document selection
  const toggleDocumentSelection = (docId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedDocuments: prev.selectedDocuments.includes(docId)
        ? prev.selectedDocuments.filter((id) => id !== docId)
        : [...prev.selectedDocuments, docId],
    }));
  };

  const formatDate = (timestamp: { toDate: () => Date } | undefined) => {
    if (!timestamp) return '-';
    return format(timestamp.toDate(), 'dd MMM yyyy HH:mm', { locale: fr });
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => !doc.isUnderHold);
  }, [documents]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {t('legalHold.title', 'Legal Holds')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('legalHold.description', 'Gerez les legal holds pour la conformite legale et les litiges')}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('legalHold.create', 'Nouveau Legal Hold')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('legalHold.stats.active', 'Holds Actifs')}
            </CardTitle>
            <Shield className="h-4 w-4 text-warning-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeHolds}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('legalHold.stats.released', 'Holds Liberes')}
            </CardTitle>
            <ShieldOff className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.releasedHolds}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('legalHold.stats.documents', 'Documents Proteges')}
            </CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.documentsUnderHold}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('legalHold.search', 'Rechercher...')}
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v: string) => setStatusFilter(v as 'all' | LegalHoldStatus)}
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('legalHold.filter.all', 'Tous')}</SelectItem>
            <SelectItem value="active">{t('legalHold.filter.active', 'Actifs')}</SelectItem>
            <SelectItem value="released">{t('legalHold.filter.released', 'Liberes')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Legal Holds List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredHolds.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Scale className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== 'all'
                ? t('legalHold.noResults', 'Aucun legal hold trouve')
                : t('legalHold.empty', 'Aucun legal hold. Creez-en un pour commencer.')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredHolds.map((hold) => {
            const isExpanded = expandedHolds.has(hold.id);
            const holdDocs = getDocumentsForHold(hold.id);

            return (
              <Card key={hold.id} className={cn(hold.status === 'released' && 'opacity-75')}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleHoldExpanded(hold.id)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <CollapsibleTrigger className="h-6 w-6 -ml-2 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full flex items-center justify-center transition-colors">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </CollapsibleTrigger>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {hold.status === 'active' ? (
                              <Shield className="h-5 w-5 text-warning-500" />
                            ) : (
                              <ShieldOff className="h-5 w-5 text-green-500" />
                            )}
                            {hold.name}
                            <Badge status={hold.status === 'active' ? 'error' : 'neutral'} variant="soft">
                              {hold.status === 'active' ? 'Actif' : 'Libéré'}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {hold.reason}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hold.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedHold(hold);
                              setReleaseDialogOpen(true);
                            }}
                          >
                            <ShieldOff className="mr-2 h-4 w-4" />
                            {t('legalHold.release', 'Liberer')}
                          </Button>
                        )}
                        {(hold.status === 'released' || hold.documentIds.length === 0) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(hold)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <Separator className="mb-4" />

                      {/* Hold Details */}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Cree le:</span>
                          <span>{formatDate(hold.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Par:</span>
                          <span>{hold.createdBy}</span>
                        </div>
                        {hold.matterNumber && (
                          <div className="flex items-center gap-2 text-sm">
                            <Scale className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Reference:</span>
                            <span>{hold.matterNumber}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Documents:</span>
                          <span>{hold.documentIds.length}</span>
                        </div>
                      </div>

                      {hold.status === 'released' && hold.releasedAt && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4">
                          <p className="text-sm">
                            <span className="font-medium">Libere le:</span> {formatDate(hold.releasedAt)}
                            {hold.releasedBy && <span> par {hold.releasedBy}</span>}
                          </p>
                          {hold.releaseReason && (
                            <p className="text-sm text-muted-foreground mt-1">
                              <span className="font-medium">Raison:</span> {hold.releaseReason}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Documents List */}
                      {holdDocs.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Documents proteges:</h4>
                          <div className="space-y-2">
                            {holdDocs.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                              >
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{doc.title}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {doc.type}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  v{doc.version}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-warning-500" />
              {t('legalHold.create', 'Nouveau Legal Hold')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'legalHold.createDescription',
                'Creez un legal hold pour proteger des documents contre la modification ou la suppression.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label htmlFor="name">{t('legalHold.form.name', 'Nom')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Litige Commercial XYZ"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">{t('legalHold.form.reason', 'Raison')} *</Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Expliquez la raison du legal hold..."
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="matterNumber">
                  {t('legalHold.form.matterNumber', 'Reference du dossier')}
                </Label>
                <Input
                  id="matterNumber"
                  value={formData.matterNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, matterNumber: e.target.value }))
                  }
                  placeholder="Ex: CASE-2024-001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                {t('legalHold.form.description', 'Description')}
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Description detaillee (optionnel)..."
                rows={2}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>{t('legalHold.form.selectDocuments', 'Sélectionner les documents')}</Label>
              <p className="text-sm text-muted-foreground">
                {formData.selectedDocuments.length} document(s) sélectionné(s)
              </p>
              <ScrollArea className="h-[200px] border rounded-lg p-2">
                <div className="space-y-2">
                  {filteredDocuments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Aucun document disponible
                    </p>
                  ) : (
                    filteredDocuments.map((doc: Document) => (
                      <div
                        key={doc.id}
                        className={cn(
                          'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                          formData.selectedDocuments.includes(doc.id)
                            ? 'bg-primary/10'
                            : 'hover:bg-muted'
                        )}
                        onClick={() => toggleDocumentSelection(doc.id)}
                      >
                        <Checkbox
                          checked={formData.selectedDocuments.includes(doc.id)}
                          onCheckedChange={() => toggleDocumentSelection(doc.id)}
                        />
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.type} - v{doc.version}
                          </p>
                        </div>
                        {doc.isUnderHold && (
                          <Badge variant="outline" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Deja sous hold
                          </Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                resetForm();
              }}
            >
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button onClick={handleCreate} disabled={formLoading}>
              {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('legalHold.create', 'Creer le Legal Hold')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release Dialog */}
      <Dialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning-500" />
              {t('legalHold.releaseTitle', 'Liberer le Legal Hold')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'legalHold.releaseWarning',
                'Cette action liberera le legal hold et permettra la modification/suppression des documents proteges.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedHold && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedHold.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedHold.documentIds.length} document(s) seront libere(s)
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="releaseReason">
                {t('legalHold.form.releaseReason', 'Raison de la liberation')}
              </Label>
              <Textarea
                id="releaseReason"
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                placeholder="Expliquez pourquoi le legal hold est libere..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReleaseDialogOpen(false);
                setSelectedHold(null);
                setReleaseReason('');
              }}
            >
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button variant="destructive" onClick={handleRelease} disabled={formLoading}>
              {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('legalHold.confirmRelease', 'Confirmer la liberation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LegalHoldManager;
