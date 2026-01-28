/**
 * Portal Authentication Component
 * Email verification for vendor portal access
 * Story 37-2: Vendor Self-Service Portal
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { VendorPortalService } from '../../services/VendorPortalService';
import {
  VendorPortalAccess,
  PortalAccessError,
} from '../../types/vendorPortal';
import { Button } from '../ui/button';
import { Building2, Mail, Loader2, ShieldCheck, KeyRound } from '../ui/Icons';

interface PortalAuthProps {
  access: VendorPortalAccess;
  onSuccess: () => void;
  onError: (error: PortalAccessError) => void;
}

export const PortalAuth: React.FC<PortalAuthProps> = ({
  access,
  onSuccess,
  onError: _onError,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'welcome' | 'verify'>('welcome');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_codeSent, setCodeSent] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input when entering verify step
  useEffect(() => {
    if (step === 'verify' && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  // Handle send verification code
  const handleSendCode = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await VendorPortalService.sendVerificationCode(access.id);
      setCodeSent(true);
      setStep('verify');
    } catch {
      setError(t('vendorPortal.sendCodeError', 'Failed to send verification code. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle code input change
  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle key down for backspace navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
    }
  };

  // Handle verify code
  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError(t('vendorPortal.enterFullCode', 'Please enter the complete 6-digit code.'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await VendorPortalService.verifyEmailCode(access.id, fullCode);
      if (success) {
        onSuccess();
      } else {
        setError(t('vendorPortal.invalidCode', 'Invalid or expired code. Please try again.'));
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError(t('vendorPortal.verifyError', 'Verification failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Mask email for display
  const maskedEmail = access.vendorEmail.replace(
    /(.{2})(.*)(@.*)/,
    (_, start, middle, end) => start + '*'.repeat(Math.min(middle.length, 6)) + end
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-border/40 dark:border-border/40 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-white/20 rounded-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg">
              {t('vendorPortal.securePortal', 'Secure Vendor Portal')}
            </h1>
            <p className="text-white/80 text-sm">
              {t('vendorPortal.verifyIdentity', 'Verify your identity to continue')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white/10 rounded-3xl p-3">
          <Building2 className="w-5 h-5" />
          <div>
            <p className="text-sm opacity-80">{t('vendorPortal.requestedBy', 'Requested by')}</p>
            <p className="font-semibold">{access.organizationName}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {step === 'welcome' ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900 mx-auto mb-4 flex items-center justify-center">
              <Mail className="w-8 h-8 text-brand-600 dark:text-brand-400" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {t('vendorPortal.welcomeTitle', 'Welcome, {{name}}', { name: access.vendorName })}
            </h2>

            <p className="text-slate-600 dark:text-muted-foreground mb-6">
              {t('vendorPortal.welcomeMessage', 'To access the security questionnaire, we need to verify your email address.')}
            </p>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-4 mb-6">
              <p className="text-sm text-slate-500 dark:text-slate-300 mb-1">
                {t('vendorPortal.verificationSentTo', 'Verification code will be sent to:')}
              </p>
              <p className="font-medium text-slate-900 dark:text-white">{maskedEmail}</p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <Button
              onClick={handleSendCode}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('vendorPortal.sending', 'Sending...')}
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  {t('vendorPortal.sendCode', 'Send Verification Code')}
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900 mx-auto mb-4 flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-brand-600 dark:text-brand-400" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {t('vendorPortal.enterCode', 'Enter Verification Code')}
            </h2>

            <p className="text-slate-600 dark:text-muted-foreground mb-6">
              {t('vendorPortal.codeSentTo', 'A 6-digit code has been sent to {{email}}', { email: maskedEmail })}
            </p>

            {/* Code Input */}
            <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-bold rounded-3xl border-2 border-border/40 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus-visible:ring-brand-300 outline-none transition-all"
                />
              ))}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <Button
              onClick={handleVerify}
              disabled={isLoading || code.join('').length !== 6}
              className="w-full mb-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('vendorPortal.verifying', 'Verifying...')}
                </>
              ) : (
                t('vendorPortal.verify', 'Verify & Continue')
              )}
            </Button>

            <button
              onClick={handleSendCode}
              disabled={isLoading}
              className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              {t('vendorPortal.resendCode', "Didn't receive the code? Resend")}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-border/40 dark:border-border/40">
        <p className="text-xs text-slate-500 dark:text-slate-300 text-center">
          {t('vendorPortal.securityNote', 'This portal access is restricted and monitored for security purposes.')}
        </p>
      </div>
    </div>
  );
};

export default PortalAuth;
