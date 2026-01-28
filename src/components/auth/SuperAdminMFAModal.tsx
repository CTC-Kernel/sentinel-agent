/**
 * SuperAdminMFAModal Component
 *
 * Modal for MFA verification before sensitive super admin actions.
 * Displays action description and prompts for TOTP code.
 */

import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { ShieldAlert } from '../ui/Icons';
import type { SuperAdminMFAModalProps } from '../../hooks/useSuperAdminMFA';

export const SuperAdminMFAModal: React.FC<SuperAdminMFAModalProps> = ({
  isOpen,
  actionDescription,
  mfaCode,
  setMfaCode,
  isVerifying,
  verificationError,
  onVerify,
  onCancel,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && mfaCode.length === 6 && !isVerifying) {
      onVerify();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Vérification de sécurité requise"
    >
      <div className="space-y-6">
        {/* Security Warning */}
        <div className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-200 dark:border-amber-800 dark:border-amber-800/30">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-2xl text-amber-600 dark:text-amber-400 flex-shrink-0 border border-amber-200/50 dark:border-amber-500/20 shadow-inner">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
              Action sensible détectée
            </h4>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Vous êtes sur le point d'effectuer une action critique :
            </p>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mt-2 italic">
              "{actionDescription}"
            </p>
          </div>
        </div>

        {/* MFA Code Input */}
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-muted-foreground">
            Pour confirmer cette action, veuillez entrer le code à 6 chiffres de votre application d'authentification.
          </p>

          <FloatingLabelInput
            label="Code MFA"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={handleKeyDown}
            className="text-center tracking-[0.5em] font-mono text-lg"
            maxLength={6}
            placeholder="000000"
          />

          {verificationError && (
            <p className="text-sm text-red-500 dark:text-red-400 text-center">
              {verificationError}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
            disabled={isVerifying}
          >
            Annuler
          </Button>
          <Button
            onClick={onVerify}
            disabled={mfaCode.length !== 6 || isVerifying}
            isLoading={isVerifying}
            className="flex-1 bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/20 border-none rounded-3xl"
          >
            Confirmer
          </Button>
        </div>
      </div>
    </Modal>
  );
};
