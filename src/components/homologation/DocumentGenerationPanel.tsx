/**
 * DocumentGenerationPanel
 *
 * Panel for generating and managing homologation documents.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  FileCheck,
  Download,
  RefreshCw,
  Loader2,
  Check,
  Clock,
  AlertCircle,
  Eye,
  Pencil
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/progress';
import { toast } from '../../lib/toast';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import {
  HomologationDocumentService,
  type GeneratedDocument,
  type DocumentGenerationContext
} from '../../services/HomologationDocumentService';
import type {
  HomologationDossier,
  HomologationDocumentType
} from '../../types/homologation';
import { DOCUMENT_TYPE_INFO, REQUIRED_DOCUMENTS } from '../../types/homologation';
import { ErrorLogger } from '../../services/errorLogger';

interface DocumentGenerationPanelProps {
  dossier: HomologationDossier;
  documents: GeneratedDocument[];
  onDocumentGenerated: () => void;
  onViewDocument: (doc: GeneratedDocument) => void;
  onEditDocument: (doc: GeneratedDocument) => void;
}

const STATUS_CONFIG = {
  not_started: { icon: FileText, color: 'text-slate-500', bgColor: 'bg-slate-100', label: 'À générer' },
  draft: { icon: Clock, color: 'text-blue-500', bgColor: 'bg-blue-100', label: 'Brouillon' },
  completed: { icon: Check, color: 'text-green-500', bgColor: 'bg-green-100', label: 'Terminé' },
  validated: { icon: FileCheck, color: 'text-purple-500', bgColor: 'bg-purple-100', label: 'Validé' }
} as const;

export const DocumentGenerationPanel: React.FC<DocumentGenerationPanelProps> = ({
  dossier,
  documents,
  onDocumentGenerated,
  onViewDocument,
  onEditDocument
}) => {
  const { t, i18n } = useTranslation();
  const { organization } = useStore();
  const { user } = useAuth();
  const isEnglish = i18n.language === 'en';

  const [generatingType, setGeneratingType] = useState<HomologationDocumentType | 'all' | null>(null);
  const [downloadingType, setDownloadingType] = useState<HomologationDocumentType | null>(null);

  // Get required document types for this level
  const requiredTypes = useMemo(() => {
    return REQUIRED_DOCUMENTS[dossier.level];
  }, [dossier.level]);

  // Map documents by type
  const documentsByType = useMemo(() => {
    const map = new Map<HomologationDocumentType, GeneratedDocument>();
    for (const doc of documents) {
      map.set(doc.type, doc);
    }
    return map;
  }, [documents]);

  // Calculate progress
  const progress = useMemo(() => {
    const total = requiredTypes.length;
    const completed = requiredTypes.filter((type) => {
      const doc = documentsByType.get(type);
      return doc && (doc.status === 'completed' || doc.status === 'validated');
    }).length;
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [requiredTypes, documentsByType]);

  // Build generation context
  const buildContext = useCallback(async (): Promise<DocumentGenerationContext> => {
    let ebiosData = undefined;
    if (dossier.linkedEbiosAnalysisId && organization?.id) {
      ebiosData = await HomologationDocumentService.fetchEbiosData(
        organization.id,
        dossier.linkedEbiosAnalysisId
      );
    }

    return {
      organization: {
        name: organization?.name || 'Organisation',
        address: organization?.address,
        sector: '' // TODO: Add industry to organization settings
      },
      dossier,
      ebiosData: ebiosData || undefined,
      locale: isEnglish ? 'en' : 'fr'
    };
  }, [dossier, organization, isEnglish]);

  // Generate single document
  const handleGenerateDocument = useCallback(
    async (type: HomologationDocumentType) => {
      if (!organization?.id || !user?.uid) return;

      setGeneratingType(type);
      try {
        const context = await buildContext();
        const generatedDoc = HomologationDocumentService.generateDocumentContent(type, context);

        await HomologationDocumentService.saveDocument(
          organization.id,
          dossier.id,
          user.uid,
          generatedDoc
        );

        toast.success(
          t('homologation.documents.generated', 'Document généré'),
          t('homologation.documents.generatedDesc', 'Le document a été généré avec succès.')
        );

        onDocumentGenerated();
      } catch (error) {
        ErrorLogger.error(error, 'DocumentGenerationPanel.generateDocument');
        toast.error(
          t('common.error', 'Erreur'),
          t('homologation.documents.generateError', 'Erreur lors de la génération.')
        );
      } finally {
        setGeneratingType(null);
      }
    },
    [organization?.id, user?.uid, dossier.id, buildContext, t, onDocumentGenerated]
  );

  // Generate all documents
  const handleGenerateAll = useCallback(async () => {
    if (!organization?.id || !user?.uid) return;

    setGeneratingType('all');
    try {
      const context = await buildContext();
      const allDocs = HomologationDocumentService.generateAllDocuments(context);

      for (const doc of allDocs) {
        // Skip if already exists
        if (!documentsByType.has(doc.type)) {
          await HomologationDocumentService.saveDocument(
            organization.id,
            dossier.id,
            user.uid,
            doc
          );
        }
      }

      toast.success(
        t('homologation.documents.allGenerated', 'Documents générés'),
        t(
          'homologation.documents.allGeneratedDesc',
          'Tous les documents ont été générés.'
        )
      );

      onDocumentGenerated();
    } catch (error) {
      ErrorLogger.error(error, 'DocumentGenerationPanel.generateAllDocuments');
      toast.error(
        t('common.error', 'Erreur'),
        t('homologation.documents.generateError', 'Erreur lors de la génération.')
      );
    } finally {
      setGeneratingType(null);
    }
  }, [
    organization?.id,
    user?.uid,
    dossier.id,
    buildContext,
    documentsByType,
    t,
    onDocumentGenerated
  ]);

  // Download PDF
  const handleDownloadPDF = useCallback(
    async (doc: GeneratedDocument) => {
      setDownloadingType(doc.type);
      try {
        const context = await buildContext();
        HomologationDocumentService.downloadDocumentPDF(doc, context);
        toast.success(
          t('homologation.documents.downloaded', 'PDF téléchargé'),
          t('homologation.documents.downloadedDesc', 'Le document a été téléchargé.')
        );
      } catch (error) {
        ErrorLogger.error(error, 'DocumentGenerationPanel.downloadPDF');
        toast.error(
          t('common.error', 'Erreur'),
          t('homologation.documents.downloadError', 'Erreur lors du téléchargement.')
        );
      } finally {
        setDownloadingType(null);
      }
    },
    [buildContext, t]
  );

  // Get document status
  const getDocumentStatus = (type: HomologationDocumentType) => {
    const doc = documentsByType.get(type);
    if (!doc) return 'not_started';
    return doc.status;
  };

  // Render document row
  const renderDocumentRow = (type: HomologationDocumentType) => {
    const info = DOCUMENT_TYPE_INFO[type];
    const doc = documentsByType.get(type);
    const status = getDocumentStatus(type);
    const statusConfig = STATUS_CONFIG[status];
    const StatusIcon = statusConfig.icon;
    const isGenerating = generatingType === type || generatingType === 'all';
    const isDownloading = downloadingType === type;

    return (
      <div
        key={type || 'unknown'}
        className="flex items-center gap-4 p-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
      >
        {/* Status icon */}
        <div className={cn('p-2 rounded-lg', statusConfig.bgColor)}>
          <StatusIcon className={cn('h-5 w-5', statusConfig.color)} />
        </div>

        {/* Document info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate">{isEnglish ? info.labelEn : info.label}</h4>
          <p className="text-sm text-muted-foreground truncate">
            {isEnglish ? info.descriptionEn : info.description}
          </p>
        </div>

        {/* Status badge */}
        <Badge variant="outline" className={cn(statusConfig.color, 'border-current')}>
          {t(`homologation.documents.status.${status}`, statusConfig.label)}
        </Badge>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!doc ? (
            <Button
              size="sm"
              onClick={() => handleGenerateDocument(type)}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">
                {t('homologation.documents.generate', 'Générer')}
              </span>
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onViewDocument(doc)}
                title={t('common.view', 'Voir')}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEditDocument(doc)}
                title={t('common.edit', 'Modifier')}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDownloadPDF(doc)}
                disabled={isDownloading}
                title={t('homologation.documents.downloadPDF', 'Télécharger PDF')}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">
            {t('homologation.documents.title', 'Documents d\'homologation')}
          </h3>
          <Button
            size="sm"
            onClick={handleGenerateAll}
            disabled={generatingType !== null}
          >
            {generatingType === 'all' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t('homologation.documents.generateAll', 'Générer tous')}
          </Button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <Progress value={progress.percentage} className="flex-1 h-2" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {progress.completed}/{progress.total} {t('homologation.documents.completed', 'terminés')}
          </span>
        </div>
      </div>

      {/* Document list */}
      <div className="divide-y">{requiredTypes.map(renderDocumentRow)}</div>

      {/* EBIOS link hint */}
      {!dossier.linkedEbiosAnalysisId && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950 border-t">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {t('homologation.documents.noEbiosLink', 'Aucune analyse EBIOS liée')}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {t(
                  'homologation.documents.ebiosHint',
                  'Liez une analyse EBIOS pour pré-remplir automatiquement les documents.'
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default DocumentGenerationPanel;
