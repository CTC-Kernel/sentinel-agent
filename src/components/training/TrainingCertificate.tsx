/**
 * TrainingCertificate Component
 *
 * UI component for generating and downloading training completion certificates.
 * Part of the Training & Awareness module (NIS2 Art. 21.2g).
 *
 * Features:
 * - Certificate generation trigger
 * - Download functionality
 * - Verification display
 * - Loading states
 *
 * @module TrainingCertificate
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
 Award,
 Download,
 Loader2,
 CheckCircle,
 Shield,
 ExternalLink,
 Copy,
 Check,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { useStore } from '../../store';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import type { TrainingAssignment } from '../../types/training';

// ============================================================================
// Types
// ============================================================================

interface TrainingCertificateProps {
 assignment: TrainingAssignment;
 courseName: string;
 className?: string;
}

interface CertificateResult {
 success: boolean;
 downloadUrl: string;
 verificationHash: string;
 fileName: string;
}

type CertificateState = 'idle' | 'generating' | 'ready' | 'error';

// ============================================================================
// Main Component
// ============================================================================

export const TrainingCertificate: React.FC<TrainingCertificateProps> = ({
 assignment,
 courseName,
 className = '',
}) => {
 const { t, addToast } = useStore();

 // Local state
 const [state, setState] = useState<CertificateState>(
 assignment.certificateUrl ? 'ready' : 'idle'
 );
 const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
 const [verificationHash, setVerificationHash] = useState<string | null>(
 assignment.verificationHash || null
 );
 const [copied, setCopied] = useState(false);

 // Generate certificate
 const handleGenerateCertificate = useCallback(async () => {
 setState('generating');

 try {
 const generateCertificate = httpsCallable<
 { assignmentId: string },
 CertificateResult
 >(functions, 'generateTrainingCertificate');

 const result = await generateCertificate({ assignmentId: assignment.id });

 if (result.data.success) {
 setDownloadUrl(result.data.downloadUrl);
 setVerificationHash(result.data.verificationHash);
 setState('ready');

 addToast(t('training.certificate.generated'), 'success');
 } else {
 throw new Error('Certificate generation failed');
 }
 } catch (error) {
 setState('error');
 ErrorLogger.handleErrorWithToast(error, 'training.certificate.error');
 }
 }, [assignment.id, t, addToast]);

 // Download certificate
 const handleDownload = useCallback(() => {
 if (downloadUrl) {
 window.open(/* sanitize */ downloadUrl, '_blank');
 }
 }, [downloadUrl]);

 // Copy verification hash
 const handleCopyHash = useCallback(async () => {
 if (verificationHash) {
 try {
 await navigator.clipboard.writeText(verificationHash);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 addToast(t('common.copied'), 'success');
 } catch {
 ErrorLogger.handleErrorWithToast(new Error('Copy failed'), 'common.copyError');
 }
 }
 }, [verificationHash, t, addToast]);

 // Check if assignment is completed
 if (assignment.status !== 'completed') {
 return (
 <div className={`glass-premium p-5 rounded-2xl border border-border/40 ${className}`}>
 <div className="flex items-center gap-3 text-muted-foreground">
 <Award className="w-6 h-6" />
 <div>
 <div className="font-medium">{t('training.certificate.notAvailable')}</div>
 <div className="text-sm">{t('training.certificate.completeFirst')}</div>
 </div>
 </div>
 </div>
 );
 }

 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className={`glass-premium p-5 rounded-2xl border border-border/40 ${className}`}
 >
 {/* Header */}
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-3xl bg-success-bg">
 <Award className="w-6 h-6 text-success-text" />
 </div>
 <div>
 <h3 className="font-bold text-foreground">
 {t('training.certificate.title')}
 </h3>
 <p className="text-sm text-muted-foreground">{courseName}</p>
 </div>
 </div>

 {/* Status Badge */}
 {state === 'ready' && (
 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-success-bg text-success-text">
 <CheckCircle className="w-3 h-3" />
 {t('training.certificate.ready')}
 </div>
 )}
 </div>

 {/* Content based on state */}
 {state === 'idle' && (
 <div className="space-y-4">
 <p className="text-sm text-muted-foreground">
 {t('training.certificate.description')}
 </p>
 <Button onClick={handleGenerateCertificate} className="w-full">
 <Award className="w-4 h-4 mr-2" />
 {t('training.certificate.generate')}
 </Button>
 </div>
 )}

 {state === 'generating' && (
 <div className="flex flex-col items-center justify-center py-8">
 <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
 <p className="text-sm text-muted-foreground">
 {t('training.certificate.generating')}
 </p>
 </div>
 )}

 {state === 'ready' && (
 <div className="space-y-4">
 {/* Completion info */}
 <div className="flex items-center justify-between p-3 rounded-3xl bg-muted/30 border border-white/5">
 <div className="flex items-center gap-2">
 <CheckCircle className="w-4 h-4 text-success-text" />
 <span className="text-sm text-foreground">
 {t('training.certificate.completedOn', {
  date: assignment.completedAt?.toDate().toLocaleDateString('fr-FR'),
 })}
 </span>
 </div>
 {assignment.score !== undefined && assignment.score !== null && (
 <span className="text-sm font-bold text-foreground">
 Score: {assignment.score}%
 </span>
 )}
 </div>

 {/* Verification hash */}
 {verificationHash && (
 <div className="p-3 rounded-3xl bg-muted/30 border border-white/5">
 <div className="flex items-center gap-2 mb-2">
 <Shield className="w-4 h-4 text-primary" />
 <span className="text-xs font-medium text-muted-foreground">
  {t('training.certificate.verificationCode')}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <code className="text-sm font-mono text-foreground">
  {verificationHash}
 </code>
 <Button
  variant="ghost"
  size="sm"
  onClick={handleCopyHash}
  className="h-8 px-2"
 >
  {copied ? (
  <Check className="w-4 h-4 text-success-text" />
  ) : (
  <Copy className="w-4 h-4" />
  )}
 </Button>
 </div>
 </div>
 )}

 {/* Actions */}
 <div className="flex gap-2">
 <Button onClick={handleDownload} className="flex-1">
 <Download className="w-4 h-4 mr-2" />
 {t('training.certificate.download')}
 </Button>
 {downloadUrl && (
 <Button
 variant="outline"
 onClick={() => window.open(/* sanitize */ downloadUrl, '_blank')}
 >
 <ExternalLink className="w-4 h-4" />
 </Button>
 )}
 </div>

 {/* NIS2 compliance note */}
 <p className="text-xs text-muted-foreground text-center">
 {t('training.certificate.nis2Compliance')}
 </p>
 </div>
 )}

 {state === 'error' && (
 <div className="space-y-4">
 <div className="p-4 rounded-3xl bg-error-bg/50 border border-error-text/20">
 <p className="text-sm text-error-text">
 {t('training.certificate.errorMessage')}
 </p>
 </div>
 <Button
 onClick={handleGenerateCertificate}
 variant="outline"
 className="w-full"
 >
 {t('common.retry')}
 </Button>
 </div>
 )}
 </motion.div>
 );
};

TrainingCertificate.displayName = 'TrainingCertificate';
