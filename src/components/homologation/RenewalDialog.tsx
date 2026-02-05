/**
 * RenewalDialog
 *
 * Dialog for initiating homologation renewal process.
 * Story 38-3: Homologation Validity Tracking
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ErrorLogger } from '@/services/errorLogger';
import {
 RefreshCw,
 Calendar,
 AlertTriangle,
 CheckCircle,
 Loader2,
 FileText
} from '../ui/Icons';
import { format, parseISO } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
 DialogFooter
} from '../ui/dialog';
import { toast } from '../../lib/toast';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { HomologationService } from '../../services/HomologationService';
import type { HomologationDossier } from '../../types/homologation';
import { LEVEL_INFO, REQUIRED_DOCUMENTS } from '../../types/homologation';

// ============================================================================
// Component
// ============================================================================

interface RenewalDialogProps {
 dossier: HomologationDossier | null;
 open: boolean;
 onOpenChange: (open: boolean) => void;
}

export const RenewalDialog: React.FC<RenewalDialogProps> = ({
 dossier,
 open,
 onOpenChange
}) => {
 const { t, i18n } = useTranslation();
 const navigate = useNavigate();
 const { organization } = useStore();
 const { dateFnsLocale } = useLocale();
 const { user } = useAuth();
 const isEnglish = i18n.language === 'en';

 const [loading, setLoading] = useState(false);

 // Calculate days until expiration
 const daysRemaining = dossier?.validityEndDate
 ? HomologationService.calculateDaysUntilExpiration(dossier.validityEndDate)
 : null;

 // Get validity state
 const validityState = HomologationService.getValidityState(daysRemaining);

 // Handle renewal initiation
 const handleInitiateRenewal = useCallback(async () => {
 if (!organization?.id || !user?.uid || !dossier) return;

 setLoading(true);
 try {
 const newDossier = await HomologationService.initializeRenewal(
 organization.id,
 user.uid,
 dossier.id
 );

 toast.success(
 t('homologation.renewal.created', 'Dossier de renouvellement créé'),
 t(
 'homologation.renewal.createdDesc',
 'Le nouveau dossier a été créé avec les données pré-remplies.'
 )
 );

 onOpenChange(false);
 navigate(`/homologation/${newDossier.id}`);
 } catch (error) {
 ErrorLogger.error(error, 'RenewalDialog.handleInitiateRenewal');
 toast.error(
 t('common.error', 'Erreur'),
 t('homologation.renewal.error', 'Erreur lors de la création du renouvellement.')
 );
 } finally {
 setLoading(false);
 }
 }, [organization?.id, user?.uid, dossier, t, navigate, onOpenChange]);

 if (!dossier) return null;

 const levelInfo = LEVEL_INFO[dossier.level];
 const requiredDocs = REQUIRED_DOCUMENTS[dossier.level];

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <RefreshCw className="h-5 w-5 text-blue-600" />
 {t('homologation.renewal.title', 'Renouvellement d\'homologation')}
 </DialogTitle>
 <DialogDescription>
 {t(
 'homologation.renewal.description',
 'Créez un nouveau dossier de renouvellement basé sur l\'homologation existante.'
 )}
 </DialogDescription>
 </DialogHeader>

 {/* Current dossier info */}
 <div className="space-y-4">
 {/* Dossier summary */}
 <div className="p-4 rounded-lg bg-muted/50 space-y-3">
 <div className="flex items-center justify-between">
 <h4 className="font-medium">{dossier.name}</h4>
 <span
 className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border"
 style={{ borderColor: levelInfo.color, color: levelInfo.color }}
 >
 {isEnglish ? levelInfo.labelEn : levelInfo.label}
 </span>
 </div>

 <p className="text-sm text-muted-foreground">{dossier.systemScope}</p>

 {/* Validity dates */}
 <div className="flex items-center gap-4 text-sm">
 <div className="flex items-center gap-1">
 <Calendar className="h-4 w-4 text-muted-foreground" />
 <span className="text-muted-foreground">
  {t('homologation.renewal.currentPeriod', 'Période actuelle')}:
 </span>
 </div>
 <span>
 {dossier.validityStartDate
  ? format(parseISO(dossier.validityStartDate), 'dd MMM yyyy', { locale: dateFnsLocale })
  : 'N/A'}{' '}
 →{' '}
 {dossier.validityEndDate
  ? format(parseISO(dossier.validityEndDate), 'dd MMM yyyy', { locale: dateFnsLocale })
  : 'N/A'}
 </span>
 </div>

 {/* Expiration status */}
 {daysRemaining !== null && (
 <div
 className={cn(
  'flex items-center gap-2 p-2 rounded-lg text-sm',
  validityState === 'expired'
  ? 'bg-red-100 text-red-700 dark:text-red-400 dark:bg-red-950 dark:text-red-300'
  : validityState === 'critical'
  ? 'bg-red-50 text-red-600 dark:text-red-400 dark:bg-red-950/50 dark:text-red-300'
  : validityState === 'expiring_soon'
  ? 'bg-amber-50 text-amber-600 dark:text-amber-400 dark:bg-amber-950/50 dark:text-amber-300'
  : 'bg-green-50 text-green-600 dark:text-green-400 dark:bg-green-950/50 dark:text-green-300'
 )}
 >
 {validityState === 'expired' ? (
  <AlertTriangle className="h-4 w-4" />
 ) : validityState === 'critical' || validityState === 'expiring_soon' ? (
  <AlertTriangle className="h-4 w-4" />
 ) : (
  <CheckCircle className="h-4 w-4" />
 )}
 <span>
  {daysRemaining < 0
  ? t('homologation.renewal.expiredSince', 'Expiré depuis {{days}} jours', {
  days: Math.abs(daysRemaining)
  })
  : t('homologation.renewal.expiresIn', 'Expire dans {{days}} jours', {
  days: daysRemaining
  })}
 </span>
 </div>
 )}
 </div>

 {/* What will be created */}
 <div className="space-y-2">
 <h4 className="font-medium text-sm">
 {t('homologation.renewal.whatWillBeCreated', 'Ce qui sera créé')}
 </h4>
 <ul className="space-y-2 text-sm">
 <li className="flex items-start gap-2">
 <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
 <span>
  {t(
  'homologation.renewal.newDossier',
  'Nouveau dossier "{{name}} - Renouvellement"',
  { name: dossier.name }
  )}
 </span>
 </li>
 <li className="flex items-start gap-2">
 <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
 <span>
  {t(
  'homologation.renewal.sameLevel',
  'Même niveau d\'homologation ({{level}})',
  { level: isEnglish ? levelInfo.labelEn : levelInfo.label }
  )}
 </span>
 </li>
 <li className="flex items-start gap-2">
 <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
 <span>
  {t('homologation.renewal.prefilled', 'Données pré-remplies depuis le dossier actuel')}
 </span>
 </li>
 <li className="flex items-start gap-2">
 <FileText className="h-4 w-4 text-blue-500 mt-0.5" />
 <span>
  {t('homologation.renewal.docsToGenerate', '{{count}} documents à régénérer', {
  count: requiredDocs.length
  })}
 </span>
 </li>
 </ul>
 </div>

 {/* Warning */}
 <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 text-sm">
 <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
 <p className="text-amber-800 dark:text-amber-200">
 {t(
 'homologation.renewal.warning',
 'Vous devrez mettre à jour l\'analyse de risques et régénérer les documents avant de soumettre le nouveau dossier.'
 )}
 </p>
 </div>
 </div>

 <DialogFooter className="gap-2">
 <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
 {t('common.cancel', 'Annuler')}
 </Button>
 <Button onClick={handleInitiateRenewal} disabled={loading}>
 {loading ? (
 <Loader2 className="h-4 w-4 animate-spin mr-2" />
 ) : (
 <RefreshCw className="h-4 w-4 mr-2" />
 )}
 {t('homologation.renewal.initiate', 'Créer le renouvellement')}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
};

export default RenewalDialog;
