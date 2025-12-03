import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ShieldAlert } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { useStore } from '../../store';

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
            const functions = getFunctions();
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
                <input
                    type="text"
                    placeholder="Vérifier une URL / IP..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    value={urlToCheck}
                    onChange={(e) => setUrlToCheck(e.target.value)}
                />
                <button
                    onClick={handleCheckUrl}
                    disabled={!urlToCheck || checkingUrl}
                    className="w-full py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                    {checkingUrl ? 'Vérification...' : 'Vérifier la réputation'}
                </button>

                {urlReputationResult && (
                    <div className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${urlReputationResult.safe ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
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
