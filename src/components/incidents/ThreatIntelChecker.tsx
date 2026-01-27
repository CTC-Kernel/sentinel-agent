import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { ShieldAlert } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { useStore } from '../../store';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Button } from '../ui/button';

export const ThreatIntelChecker: React.FC = () => {
    const { addToast } = useStore();
    const [urlToCheck, setUrlToCheck] = useState('');
    const [urlReputationResult, setUrlReputationResult] = useState<{ safe: boolean; threatType?: string } | null>(null);
    const [checkingUrl, setCheckingUrl] = useState(false);

    const handleCheckUrl = async () => {
        if (!urlToCheck) return;
        setCheckingUrl(true);
        setUrlReputationResult(null);
        try {
            const checkUrlReputationWithSafeBrowsing = httpsCallable(functions, 'checkUrlReputationWithSafeBrowsing');
            const { data } = await checkUrlReputationWithSafeBrowsing({ url: urlToCheck });
            const result = (data as { result?: { safe?: boolean; threatType?: string } } | undefined)?.result;

            if (!result || result.safe === undefined) {
                addToast('Erreur lors de la vérification de réputation', 'error');
            } else {
                setUrlReputationResult({ safe: result.safe, threatType: result.threatType });
            }
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'ThreatIntelChecker.checkUrl', 'UNKNOWN_ERROR');
        } finally {
            setCheckingUrl(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Threat Intel
            </h3>
            <div className="space-y-3">
                <FloatingLabelInput
                    label="Vérifier une URL / IP"
                    value={urlToCheck}
                    onChange={(e) => setUrlToCheck(e.target.value)}
                    placeholder="https://example.com"
                />
                <Button
                    onClick={handleCheckUrl}
                    disabled={!urlToCheck || checkingUrl}
                    isLoading={checkingUrl}
                    className="w-full"
                    variant="secondary"
                >
                    Vérifier la réputation
                </Button>

                {urlReputationResult && (
                    <div className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${urlReputationResult.safe ? 'bg-green-100 text-green-700 dark:text-green-400 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:text-red-400 dark:bg-red-900/20 dark:text-red-400'}`}>
                        {urlReputationResult.safe ? (
                            <>
                                <ShieldAlert className="h-4 w-4" />
                                URL/IP saine
                            </>
                        ) : (
                            <>
                                <ShieldAlert className="h-4 w-4" />
                                Menace détectée: {urlReputationResult.threatType}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
