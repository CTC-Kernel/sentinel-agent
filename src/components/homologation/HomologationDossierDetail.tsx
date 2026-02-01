/**
 * HomologationDossierDetail
 *
 * Detailed view for a homologation dossier with document generation and editing.
 * Story 38-2: Homologation Document Generation
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  FileText,
  Shield,
  ShieldAlert,
  Calendar,
  User,
  Building,
  Link as LinkIcon,
  AlertTriangle,
  Check,
  Clock,
  XCircle,
  Loader2,
  Save,
  ChevronLeft
} from '../ui/Icons';
import type { LucideIcon } from '../ui/Icons';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { RichTextEditor } from '../ui/RichTextEditor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from '../../lib/toast';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { HomologationService } from '../../services/HomologationService';
import {
  HomologationDocumentService,
  type GeneratedDocument
} from '../../services/HomologationDocumentService';
import { DocumentGenerationPanel } from './DocumentGenerationPanel';
import { HomologationAIAssistant } from './HomologationAIAssistant';
import type { HomologationDossier, HomologationLevel, HomologationStatus } from '../../types/homologation';
import { LEVEL_INFO, DOCUMENT_TYPE_INFO } from '../../types/homologation';
import { ErrorLogger } from '../../services/errorLogger';

// ============================================================================
// Constants
// ============================================================================

const LEVEL_ICONS: Record<HomologationLevel, LucideIcon> = {
  etoile: Star,
  simple: FileText,
  standard: Shield,
  renforce: ShieldAlert
};

const STATUS_CONFIG: Record<
  HomologationStatus,
  { color: string; bgColor: string; borderColor: string; icon: LucideIcon }
> = {
  draft: { color: 'text-slate-600', bgColor: 'bg-slate-100', borderColor: 'border-border/40', icon: FileText },
  in_progress: { color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-300', icon: Clock },
  pending_decision: {
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    icon: AlertTriangle
  },
  homologated: { color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-300', icon: Check },
  expired: { color: 'text-red-600', bgColor: 'bg-red-100', borderColor: 'border-red-300', icon: XCircle },
  revoked: { color: 'text-red-700', bgColor: 'bg-red-200', borderColor: 'border-red-400', icon: XCircle }
};

// ============================================================================
// Component
// ============================================================================

export const HomologationDossierDetail: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { dossierId } = useParams<{ dossierId: string }>();
  const navigate = useNavigate();
  const { organization } = useStore();
  const { dateFnsLocale } = useLocale();
  const { user } = useAuth();
  const isEnglish = i18n.language === 'en';

  // State
  const [dossier, setDossier] = useState<HomologationDossier | null>(null);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Document viewer/editor state
  const [selectedDocument, setSelectedDocument] = useState<GeneratedDocument | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch dossier and documents
  const fetchData = useCallback(async () => {
    if (!organization?.id || !dossierId) return;

    setLoading(true);
    setError(null);

    try {
      const [fetchedDossier, fetchedDocuments] = await Promise.all([
        HomologationService.getDossier(organization.id, dossierId),
        HomologationDocumentService.getDocuments(organization.id, dossierId)
      ]);

      if (!fetchedDossier) {
        throw new Error('Dossier not found');
      }

      setDossier(fetchedDossier);
      setDocuments(fetchedDocuments);
    } catch (err) {
      ErrorLogger.error(err, 'HomologationDossierDetail.fetchData');
      setError(err instanceof Error ? err : new Error('Failed to load dossier'));
    } finally {
      setLoading(false);
    }
  }, [organization?.id, dossierId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate validity info
  const validityInfo = useMemo(() => {
    if (!dossier) return null;

    if (!dossier.validityEndDate) {
      return { status: 'not_set', daysRemaining: null };
    }

    const endDate = parseISO(dossier.validityEndDate);
    const daysRemaining = differenceInDays(endDate, new Date());

    if (daysRemaining < 0) {
      return { status: 'expired', daysRemaining };
    } else if (daysRemaining <= 30) {
      return { status: 'critical', daysRemaining };
    } else if (daysRemaining <= 90) {
      return { status: 'warning', daysRemaining };
    } else {
      return { status: 'ok', daysRemaining };
    }
  }, [dossier]);

  // Handle document view
  const handleViewDocument = useCallback((doc: GeneratedDocument) => {
    setSelectedDocument(doc);
    setIsEditing(false);
    setEditedContent(doc.content);
  }, []);

  // Handle document edit
  const handleEditDocument = useCallback((doc: GeneratedDocument) => {
    setSelectedDocument(doc);
    setIsEditing(true);
    setEditedContent(doc.content);
  }, []);

  // Handle document save
  const handleSaveDocument = useCallback(async () => {
    if (!organization?.id || !dossierId || !selectedDocument || !user?.uid) return;

    setSaving(true);
    try {
      await HomologationDocumentService.updateDocumentContent(
        organization.id,
        dossierId,
        selectedDocument.id,
        user.uid,
        editedContent,
        selectedDocument.sections.map((s) => ({ ...s, isModified: true }))
      );

      toast.success(
        t('homologation.documents.saved', 'Document enregistré'),
        t('homologation.documents.savedDesc', 'Les modifications ont été enregistrées.')
      );

      // Refresh documents
      await fetchData();
      setIsEditing(false);
    } catch (err) {
      ErrorLogger.error(err, 'HomologationDossierDetail.saveDocument');
      toast.error(
        t('common.error', 'Erreur'),
        t('homologation.documents.saveError', 'Erreur lors de l\'enregistrement.')
      );
    } finally {
      setSaving(false);
    }
  }, [organization?.id, dossierId, selectedDocument, user?.uid, editedContent, t, fetchData]);

  // Handle dossier update (for AI assistant)
  const handleDossierUpdate = useCallback(
    async (updates: Partial<HomologationDossier>) => {
      if (!organization?.id || !dossierId || !user?.uid) return;

      try {
        await HomologationService.updateDossier(organization.id, dossierId, user.uid, updates);
        await fetchData();
        toast.success(
          t('homologation.updated', 'Dossier mis à jour'),
          t('homologation.updatedDesc', 'Les modifications ont été appliquées.')
        );
      } catch (err) {
        ErrorLogger.error(err, 'HomologationDossierDetail.updateDossier');
        toast.error(
          t('common.error', 'Erreur'),
          t('homologation.updateError', 'Erreur lors de la mise à jour.')
        );
      }
    },
    [organization?.id, dossierId, user?.uid, t, fetchData]
  );

  // Handle status change
  const handleStatusChange = useCallback(
    async (newStatus: HomologationStatus) => {
      if (!organization?.id || !dossierId || !user?.uid) return;

      try {
        const updates: Record<string, unknown> = { status: newStatus };

        // Set dates for homologation
        if (newStatus === 'homologated') {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setFullYear(endDate.getFullYear() + (dossier?.validityYears || 3));

          updates.validityStartDate = startDate.toISOString();
          updates.validityEndDate = endDate.toISOString();
          updates.decisionDate = startDate.toISOString();
        }

        await HomologationService.updateDossier(organization.id, dossierId, user.uid, updates);

        toast.success(
          t('homologation.statusUpdated', 'Statut mis à jour'),
          t('homologation.statusUpdatedDesc', 'Le statut du dossier a été modifié.')
        );

        await fetchData();
      } catch (err) {
        ErrorLogger.error(err, 'HomologationDossierDetail.statusChange');
        toast.error(
          t('common.error', 'Erreur'),
          t('homologation.statusUpdateError', 'Erreur lors de la mise à jour.')
        );
      }
    },
    [organization?.id, dossierId, user?.uid, dossier?.validityYears, t, fetchData]
  );

  // Render loading state
  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Render error state
  if (error || !dossier) {
    return (
      <div className="container mx-auto py-6">
        <Card className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t('common.error', 'Erreur')}</h2>
          <p className="text-muted-foreground mb-4">
            {error?.message || t('homologation.dossierNotFound', 'Dossier non trouvé')}
          </p>
          <Button onClick={() => navigate('/homologation')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back', 'Retour')}
          </Button>
        </Card>
      </div>
    );
  }

  const levelInfo = LEVEL_INFO[dossier.level];
  const LevelIcon = LEVEL_ICONS[dossier.level];
  const statusConfig = STATUS_CONFIG[dossier.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/homologation')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{dossier.name}</h1>
            <Badge
              variant="outline"
              className={cn(statusConfig.color, statusConfig.borderColor, 'border')}
            >
              <StatusIcon className="h-3.5 w-3.5 mr-1" />
              {t(`homologation.status.${dossier.status}`, dossier.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground">{dossier.systemScope}</p>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left sidebar - Dossier info */}
        <div className="space-y-6">
          {/* Level card */}
          <Card className="p-4">
            <h3 className="font-medium mb-3">{t('homologation.level', 'Niveau')}</h3>
            <div className="flex items-center gap-3">
              <div
                className="p-3 rounded-3xl"
                style={{ backgroundColor: `${levelInfo.color}20`, color: levelInfo.color }}
              >
                <LevelIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold" style={{ color: levelInfo.color }}>
                  {isEnglish ? levelInfo.labelEn : levelInfo.label}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isEnglish ? levelInfo.descriptionEn : levelInfo.description}
                </p>
              </div>
            </div>
            {dossier.levelOverridden && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                {t('homologation.levelOverridden', 'Niveau modifié manuellement')}
              </p>
            )}
          </Card>

          {/* Validity card */}
          <Card className="p-4">
            <h3 className="font-medium mb-3">{t('homologation.validityLabel', 'Validité')}</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('homologation.validityPeriod', 'Durée')}:
                </span>
                <span className="font-medium">{dossier.validityYears} {t('common.years', 'ans')}</span>
              </div>

              {dossier.validityStartDate && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t('common.from', 'Du')}:</span>
                  <span className="font-medium">
                    {format(parseISO(dossier.validityStartDate), 'PPP', { locale: dateFnsLocale })}
                  </span>
                </div>
              )}

              {dossier.validityEndDate && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t('common.to', 'Au')}:</span>
                  <span className="font-medium">
                    {format(parseISO(dossier.validityEndDate), 'PPP', { locale: dateFnsLocale })}
                  </span>
                </div>
              )}

              {validityInfo && validityInfo.daysRemaining !== null && (
                <div
                  className={cn(
                    'mt-2 p-2 rounded-lg text-sm',
                    validityInfo.status === 'expired'
                      ? 'bg-red-100 text-red-700'
                      : validityInfo.status === 'critical'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        : validityInfo.status === 'warning'
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                          : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                  )}
                >
                  {validityInfo.status === 'expired'
                    ? t('homologation.expiredSince', 'Expiré depuis {{days}} jours', {
                      days: Math.abs(validityInfo.daysRemaining)
                    })
                    : t('homologation.expiresIn', 'Expire dans {{days}} jours', {
                      days: validityInfo.daysRemaining
                    })}
                </div>
              )}
            </div>
          </Card>

          {/* Details card */}
          <Card className="p-4">
            <h3 className="font-medium mb-3">{t('common.details', 'Détails')}</h3>
            <div className="space-y-3 text-sm">
              {dossier.authorityName && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">
                      {t('homologation.authority', 'Autorité d\'homologation')}
                    </p>
                    <p className="font-medium">{dossier.authorityName}</p>
                  </div>
                </div>
              )}

              {dossier.decisionReference && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">
                      {t('homologation.decisionReference', 'Référence décision')}
                    </p>
                    <p className="font-medium">{dossier.decisionReference}</p>
                  </div>
                </div>
              )}

              {dossier.linkedEbiosAnalysisId && (
                <div className="flex items-start gap-2">
                  <LinkIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">
                      {t('homologation.linkedEbios', 'Analyse EBIOS liée')}
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => navigate(`/ebios/${dossier.linkedEbiosAnalysisId}`)}
                    >
                      {t('common.view', 'Voir')} →
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">{t('common.createdAt', 'Créé le')}</p>
                  <p className="font-medium">
                    {format(parseISO(dossier.createdAt), 'PPP', { locale: dateFnsLocale })}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Actions card */}
          <Card className="p-4">
            <h3 className="font-medium mb-3">{t('common.actions', 'Actions')}</h3>
            <div className="space-y-2">
              {dossier.status === 'draft' && (
                <Button
                  className="w-full"
                  onClick={() => handleStatusChange('in_progress')}
                >
                  {t('homologation.startWork', 'Démarrer le dossier')}
                </Button>
              )}

              {dossier.status === 'in_progress' && (
                <Button
                  className="w-full"
                  onClick={() => handleStatusChange('pending_decision')}
                >
                  {t('homologation.submitForDecision', 'Soumettre pour décision')}
                </Button>
              )}

              {dossier.status === 'pending_decision' && (
                <>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => handleStatusChange('homologated')}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {t('homologation.approve', 'Approuver')}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleStatusChange('in_progress')}
                  >
                    {t('homologation.sendBack', 'Renvoyer en révision')}
                  </Button>
                </>
              )}

              {dossier.status === 'homologated' && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => handleStatusChange('revoked')}
                >
                  {t('homologation.revoke', 'Révoquer')}
                </Button>
              )}

              {(dossier.status === 'expired' || dossier.status === 'revoked') && (
                <Button
                  className="w-full"
                  onClick={() => handleStatusChange('draft')}
                >
                  {t('homologation.reopen', 'Rouvrir le dossier')}
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right content - Documents */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Assistant */}
          <HomologationAIAssistant
            dossier={dossier}
            onUpdate={handleDossierUpdate}
          />

          {/* Document Generation Panel */}
          <DocumentGenerationPanel
            dossier={dossier}
            documents={documents}
            onDocumentGenerated={fetchData}
            onViewDocument={handleViewDocument}
            onEditDocument={handleEditDocument}
          />

          {/* Description */}
          {dossier.description && (
            <Card className="p-4">
              <h3 className="font-medium mb-2">{t('common.description', 'Description')}</h3>
              <p className="text-sm text-muted-foreground">{dossier.description}</p>
            </Card>
          )}

          {/* Justification */}
          <Card className="p-4">
            <h3 className="font-medium mb-2">
              {t('homologation.levelJustification', 'Justification du niveau')}
            </h3>
            <p className="text-sm text-muted-foreground">{dossier.levelJustification}</p>
          </Card>
        </div>
      </div>

      {/* Document Viewer/Editor Dialog */}
      <Dialog
        open={!!selectedDocument}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDocument(null);
            setIsEditing(false);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                {selectedDocument
                  ? isEnglish
                    ? DOCUMENT_TYPE_INFO[selectedDocument.type].labelEn
                    : DOCUMENT_TYPE_INFO[selectedDocument.type].label
                  : ''}
              </span>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <Button size="sm" onClick={handleSaveDocument} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {t('common.save', 'Enregistrer')}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                  >
                    {t('common.edit', 'Modifier')}
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-4">
            {selectedDocument && (
              <RichTextEditor
                value={isEditing ? editedContent : selectedDocument.content}
                onChange={setEditedContent}
                editable={isEditing}
                readOnly={!isEditing}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomologationDossierDetail;
