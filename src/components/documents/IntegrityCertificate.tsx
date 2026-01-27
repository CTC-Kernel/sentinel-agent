/**
 * Story 26.3 - Integrity Certificate UI Component
 *
 * Displays document integrity status and provides verification functionality:
 * - Shows hash value with copy button
 * - Displays verification status (verified, pending, compromised)
 * - Shows last verification timestamp
 * - "Verify Now" button to trigger verification
 * - Downloadable integrity certificate (PDF)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Clock,
  Copy,
  Check,
  RefreshCw,
  Download,
  Hash,
  Lock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  History,
} from '../ui/Icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { jsPDF } from 'jspdf';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tooltip } from '../ui/Tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';

import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import {
  IntegrityService,
  type IntegrityStatus,
  type DocumentIntegrity,
  type IntegrityCertificate as CertificateType,
  type HashHistoryEvent,
} from '@/services/integrityService';
import { toast } from 'sonner';
import { ErrorLogger } from '@/services/errorLogger';

interface IntegrityCertificateProps {
  documentId: string;
  documentName?: string;
  className?: string;
  compact?: boolean;
}

/**
 * Status configuration for visual display
 */
const statusConfig: Record<
  IntegrityStatus,
  {
    icon: React.FC<{ className?: string }>;
    label: string;
    description: string;
    badgeStatus: 'success' | 'warning' | 'error' | 'neutral';
    color: string;
  }
> = {
  verified: {
    icon: ShieldCheck,
    label: 'Intégrité vérifiée',
    description: 'Le document n\'a pas été modifié depuis son téléversement',
    badgeStatus: 'success',
    color: 'text-green-600 dark:text-green-400',
  },
  pending: {
    icon: ShieldQuestion,
    label: 'Vérification en attente',
    description: 'L\'intégrité n\'a pas encore été vérifiée',
    badgeStatus: 'warning',
    color: 'text-warning-600 dark:text-warning-400',
  },
  compromised: {
    icon: ShieldAlert,
    label: 'Intégrité compromise',
    description: 'ALERTE: Le document a été modifié ou corrompu',
    badgeStatus: 'error',
    color: 'text-red-600 dark:text-red-400',
  },
  unknown: {
    icon: ShieldQuestion,
    label: 'Statut inconnu',
    description: 'Aucune information d\'intégrité disponible',
    badgeStatus: 'neutral',
    color: 'text-slate-500 dark:text-slate-300',
  },
};

export function IntegrityCertificate({
  documentId,
  className,
  compact = false,
}: IntegrityCertificateProps) {
  const { user } = useStore();

  // State
  const [integrity, setIntegrity] = useState<DocumentIntegrity | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HashHistoryEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadIntegrityStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await IntegrityService.getIntegrityStatus(documentId);
      setIntegrity(status);
    } catch (error) {
      ErrorLogger.error(error, 'IntegrityCertificate.loadIntegrityStatus');
      setIntegrity({
        hash: null,
        algorithm: 'SHA-256',
        status: 'unknown',
        lastVerified: null,
        verifiedBy: null,
      });
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  // Load initial integrity status
  useEffect(() => {
    loadIntegrityStatus();
  }, [loadIntegrityStatus]);

  const handleVerify = useCallback(async () => {
    setVerifying(true);
    try {
      const result = await IntegrityService.verifyDocumentIntegrity(documentId);

      setIntegrity({
        hash: result.hash,
        algorithm: 'SHA-256',
        status: result.status,
        lastVerified: new Date(result.verifiedAt),
        verifiedBy: user?.uid || null,
      });

      if (result.match) {
        toast.success('Intégrité vérifiée avec succès');
      } else {
        toast.error('ALERTE: Intégrité compromise - hash différent détecté');
      }
    } catch (error) {
      ErrorLogger.error(error, 'IntegrityCertificate.verify');
      toast.error('Échec de la vérification d\'intégrité');
    } finally {
      setVerifying(false);
    }
  }, [documentId, user]);

  const handleCopyHash = useCallback(async (hashToCopy?: string | null) => {
    const targetHash = hashToCopy || integrity?.hash;
    if (!targetHash) return;

    try {
      await navigator.clipboard.writeText(targetHash);
      setCopiedHash(true);
      toast.success('Hash copié dans le presse-papiers');
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      toast.error('Impossible de copier le hash');
    }
  }, [integrity?.hash]);

  const loadHistory = useCallback(async () => {
    if (history.length > 0) return; // Already loaded

    setLoadingHistory(true);
    try {
      const response = await IntegrityService.getHashHistory(documentId, 20);
      setHistory(response.history);
    } catch (error) {
      ErrorLogger.error(error, 'IntegrityCertificate.loadHistory');
      toast.error('Impossible de charger l\'historique');
    } finally {
      setLoadingHistory(false);
    }
  }, [documentId, history.length]);

  const handleToggleHistory = useCallback(() => {
    if (!historyOpen) {
      loadHistory();
    }
    setHistoryOpen(!historyOpen);
  }, [historyOpen, loadHistory]);

  const handleDownloadCertificate = useCallback(async () => {
    setGeneratingPdf(true);
    try {
      const certificate = await IntegrityService.generateCertificate(documentId);
      generatePdfCertificate(certificate);
      toast.success('Certificat téléchargé');
    } catch (error) {
      ErrorLogger.error(error, 'IntegrityCertificate.generateCertificate');
      toast.error('Échec de la génération du certificat');
    } finally {
      setGeneratingPdf(false);
    }
  }, [documentId]);

  const generatePdfCertificate = (cert: CertificateType) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    let y = 30;

    // Header with decorative border
    doc.setDrawColor(15, 23, 42); // Slate-900
    doc.setLineWidth(2);
    doc.rect(10, 10, pageWidth - 20, doc.internal.pageSize.height - 20, 'S');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42);
    doc.text('CERTIFICAT D\'INTÉGRITÉ', pageWidth / 2, y, { align: 'center' });

    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text('Document numérique authentifié', pageWidth / 2, y, { align: 'center' });

    // Certificate number
    y += 15;
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`N° ${cert.certificateNumber}`, pageWidth / 2, y, { align: 'center' });

    // Separator
    y += 10;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);

    // Document Information Section
    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('INFORMATIONS DU DOCUMENT', margin, y);

    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const docInfo = [
      ['Nom du document:', cert.document.name],
      ['Type:', cert.document.type],
      ['Taille:', cert.document.size ? `${(cert.document.size / 1024).toFixed(2)} KB` : 'N/A'],
      ['Téléversé le:', cert.document.uploadedAt ? format(new Date(cert.document.uploadedAt), 'dd MMMM yyyy à HH:mm', { locale: fr }) : 'N/A'],
      ['Organisation:', cert.organization.name],
    ];

    docInfo.forEach(([label, value]) => {
      doc.setTextColor(100, 116, 139);
      doc.text(label, margin, y);
      doc.setTextColor(15, 23, 42);
      doc.text(String(value), margin + 45, y);
      y += 7;
    });

    // Integrity Section
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('INTÉGRITÉ CRYPTOGRAPHIQUE', margin, y);

    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    // Status badge
    const statusLabel = IntegrityService.getStatusLabel(cert.integrity.status);
    const statusColor = cert.integrity.status === 'verified' ? [16, 185, 129] :
      cert.integrity.status === 'compromised' ? [239, 68, 68] : [100, 116, 139];

    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(margin, y - 4, 40, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(statusLabel.toUpperCase(), margin + 20, y + 1, { align: 'center' });

    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);

    const integrityInfo = [
      ['Algorithme:', cert.integrity.algorithm],
      ['Hash SHA-256:', ''],
      ['Dernière vérification:', cert.integrity.lastVerified ? format(new Date(cert.integrity.lastVerified), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'N/A'],
    ];

    integrityInfo.forEach(([label, value]) => {
      doc.setTextColor(100, 116, 139);
      doc.text(label, margin, y);
      if (value) {
        doc.setTextColor(15, 23, 42);
        doc.text(String(value), margin + 45, y);
      }
      y += 7;
    });

    // Hash in monospace box
    y += 3;
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 12, 2, 2, 'F');
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(cert.integrity.hash, margin + 5, y + 3);

    // Encryption Section
    y += 25;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('CHIFFREMENT', margin, y);

    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const encInfo = [
      ['État:', cert.encryption.encrypted ? 'Chiffré' : 'Non chiffré'],
      ['Algorithme:', cert.encryption.algorithm],
      ['Version de clé:', cert.encryption.keyVersion],
      ['Chiffré le:', cert.encryption.encryptedAt ? format(new Date(cert.encryption.encryptedAt), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'N/A'],
    ];

    encInfo.forEach(([label, value]) => {
      doc.setTextColor(100, 116, 139);
      doc.text(label, margin, y);
      doc.setTextColor(15, 23, 42);
      doc.text(String(value), margin + 45, y);
      y += 7;
    });

    // Legal Disclaimer
    y += 15;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 30, 2, 2, 'F');

    y += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const disclaimer = doc.splitTextToSize(cert.legalDisclaimer, pageWidth - margin * 2 - 10);
    doc.text(disclaimer, margin + 5, y);

    // Generation info at bottom
    y = doc.internal.pageSize.height - 30;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Généré le ${format(new Date(cert.generatedAt), 'dd MMMM yyyy à HH:mm:ss', { locale: fr })}`, pageWidth / 2, y, { align: 'center' });
    doc.text(`par ${cert.generatedBy.name} (${cert.generatedBy.email})`, pageWidth / 2, y + 5, { align: 'center' });
    doc.text('Sentinel GRC - Coffre-Fort Documentaire', pageWidth / 2, y + 10, { align: 'center' });

    // Save
    const filename = `certificat-integrite-${cert.document.name.replace(/[^a-z0-9]/gi, '_')}-${format(new Date(), 'yyyyMMdd')}.pdf`;
    doc.save(filename);
  };

  // Get status configuration
  const status = integrity?.status || 'unknown';
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader className="pb-2">
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-2" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        </CardContent>
      </Card>
    );
  }

  // Compact version for inline display
  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <Tooltip
          content={
            <div className="space-y-1 max-w-xs text-center">
              <p className="font-medium">{config.description}</p>
              {integrity?.hash && (
                <p className="text-xs font-mono text-muted-foreground">
                  Hash: {IntegrityService.formatHash(integrity.hash)}
                </p>
              )}
              {integrity?.lastVerified && (
                <p className="text-xs text-muted-foreground">
                  Vérifié: {format(integrity.lastVerified, 'dd/MM/yyyy HH:mm', { locale: fr })}
                </p>
              )}
            </div>
          }
        >
          <div className={cn('flex items-center gap-2', config.color)}>
            <StatusIcon className="h-5 w-5" />
            <Badge status={config.badgeStatus} variant="soft" size="sm">
              {config.label}
            </Badge>
          </div>
        </Tooltip>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleVerify}
          disabled={verifying}
          className="h-7 px-2"
        >
          {verifying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  // Full card version
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className="h-5 w-5" />
            <CardTitle className="text-base font-semibold">
              Certificat d'Intégrité
            </CardTitle>
          </div>
          <Badge status={config.badgeStatus} variant="soft">
            {config.label}
          </Badge>
        </div>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Hash Display */}
        {integrity?.hash && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Hash className="h-4 w-4" />
              <span>Hash SHA-256</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg font-mono text-xs break-all border border-slate-200 dark:border-slate-700">
                {integrity.hash}
              </code>
              <Tooltip content="Copier l'empreinte">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCopyHash(integrity.hash)}
                >
                  {copiedHash ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Verification Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Dernière vérification</span>
            </div>
            <p className="font-medium">
              {integrity?.lastVerified
                ? format(integrity.lastVerified, 'dd MMMM yyyy à HH:mm', { locale: fr })
                : 'Jamais vérifié'}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>Algorithme</span>
            </div>
            <p className="font-medium font-mono">{integrity?.algorithm || 'SHA-256'}</p>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleVerify}
            disabled={verifying}
            variant="default"
            size="sm"
            className="gap-2"
          >
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Vérification...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Vérifier maintenant
              </>
            )}
          </Button>

          <Button
            onClick={handleDownloadCertificate}
            disabled={generatingPdf}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {generatingPdf ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Télécharger certificat
              </>
            )}
          </Button>
        </div>

        {/* History Collapsible */}
        <Collapsible open={historyOpen} onOpenChange={handleToggleHistory}>
          <CollapsibleTrigger
            className={cn(
              "flex items-center w-full justify-between mt-2 hover:bg-muted/50 p-2 rounded-md transition-colors",
              className
            )}
            onClick={handleToggleHistory}
          >
            <span className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historique des vérifications
            </span>
            {historyOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-3">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun historique disponible
              </p>
            ) : (
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {history.map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        'flex items-start gap-3 p-2 rounded-lg text-sm',
                        'bg-slate-50 dark:bg-slate-900/50'
                      )}
                    >
                      <div
                        className={cn(
                          'mt-0.5 rounded-full p-1',
                          event.status === 'verified'
                            ? 'bg-green-100 text-green-600 dark:text-green-400 dark:bg-green-900/30 dark:text-green-400'
                            : event.status === 'compromised'
                              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                        )}
                      >
                        {event.status === 'verified' ? (
                          <Check className="h-3 w-3" />
                        ) : event.status === 'compromised' ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium capitalize">
                          {event.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {event.timestamp
                            ? format(new Date(event.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr })
                            : '-'}
                        </p>
                        {event.hash && (
                          <p className="text-xs font-mono text-muted-foreground truncate">
                            {IntegrityService.formatHash(event.hash)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Warning for compromised status */}
        {status === 'compromised' && (
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 dark:border-red-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-red-800 dark:text-red-200">
                Alerte de sécurité
              </p>
              <p className="text-red-700 dark:text-red-300 mt-1">
                Le hash calculé ne correspond pas au hash d'origine. Le document a pu être modifié ou corrompu.
                Veuillez contacter votre administrateur.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default IntegrityCertificate;
