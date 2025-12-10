import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { detectHardware, HardwareInfo } from '../../utils/hardwareDetection';
import { IntakeForm } from './IntakeForm';
import { CheckCircle2, ShieldCheck, Lock } from '../ui/Icons';

export const KioskPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const orgId = searchParams.get('org');

    const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const init = async () => {
            // Add a small delay for effect and to ensure DOM is ready for canvas
            await new Promise(resolve => setTimeout(resolve, 800));
            const info = await detectHardware();
            setHardwareInfo(info);
            setLoading(false);
        };
        init();
    }, []);

    if (submitted) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafafa] dark:bg-slate-900 p-6 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-emerald-500/10 dark:bg-emerald-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-50 animate-float"></div>
                </div>

                <div className="glass-panel p-12 rounded-[2.5rem] max-w-md w-full text-center shadow-2xl animate-scale-in">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 dark:text-emerald-400 shadow-inner">
                        <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 font-display">
                        Enregistré !
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg">
                        L'équipement a été ajouté avec succès à l'inventaire. Vous pouvez fermer cette fenêtre.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-8 py-3 bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                    >
                        Enregistrer un autre appareil
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-slate-900 relative overflow-hidden flex flex-col">
            {/* Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[50rem] h-[50rem] bg-brand-200/30 dark:bg-slate-900/20 rounded-full mix-blend-multiply filter blur-[100px] animate-float"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[50rem] h-[50rem] bg-purple-200/30 dark:bg-purple-900/20 rounded-full mix-blend-multiply filter blur-[100px] animate-float" style={{ animationDelay: '2s' }}></div>
            </div>

            {/* Header */}
            <header className="relative z-10 px-6 py-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <ShieldCheck className="h-6 w-6 text-white dark:text-slate-900" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-none">Sentinel GRC</h1>
                        <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">Asset Intake</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/50 dark:bg-black/20 backdrop-blur-md rounded-full border border-white/20 dark:border-white/5">
                    <Lock className="h-3 w-3 text-slate-600" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Connexion Sécurisée</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 relative z-10 flex flex-col items-center justify-center p-4 md:p-8">
                {loading ? (
                    <div className="text-center animate-fade-in">
                        <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-6"></div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Analyse du matériel...</h2>
                        <p className="text-slate-600 dark:text-slate-400">Veuillez patienter pendant que nous détectons la configuration.</p>
                    </div>
                ) : (
                    <div className="w-full max-w-2xl animate-slide-up">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 font-display">
                                Nouvel Équipement
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 text-lg">
                                Vérifiez les informations détectées et complétez la fiche.
                            </p>
                        </div>

                        {hardwareInfo && (
                            <IntakeForm
                                hardwareInfo={hardwareInfo}
                                orgId={orgId || ''}
                                onSuccess={() => setSubmitted(true)}
                            />
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="relative z-10 py-6 text-center text-xs text-slate-500 dark:text-slate-600">
                &copy; {new Date().getFullYear()} Sentinel GRC. Tous droits réservés.
            </footer>
        </div>
    );
};
