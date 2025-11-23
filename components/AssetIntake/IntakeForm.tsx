import React, { useState } from 'react';
import { HardwareInfo } from '../../utils/hardwareDetection';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { CheckCircle2, Laptop, Cpu, HardDrive, Monitor, Save, AlertTriangle } from '../ui/Icons';

interface IntakeFormProps {
    hardwareInfo: HardwareInfo;
    orgId: string;
    onSuccess: () => void;
}

export const IntakeForm: React.FC<IntakeFormProps> = ({ hardwareInfo, orgId, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        serialNumber: '',
        user: '',
        notes: '',
        type: hardwareInfo.isMobile ? 'Mobile' : 'Laptop' // Default guess
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!orgId) {
            setError("Organisation non identifiée. Lien invalide.");
            setLoading(false);
            return;
        }

        try {
            await addDoc(collection(db, 'assets'), {
                ...formData,
                organizationId: orgId,
                hardware: hardwareInfo,
                status: 'En stock', // Default status for new intake
                criticality: 'Moyenne',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                source: 'Kiosk Intake'
            });
            onSuccess();
        } catch (err) {
            console.error("Error submitting asset:", err);
            setError("Une erreur est survenue lors de l'enregistrement. Veuillez réessayer.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Hardware Detected Section */}
                <div className="glass-panel p-6 rounded-2xl border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Laptop className="h-5 w-5 text-brand-600" />
                        Matériel Détecté
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                                <Cpu className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase">Processeur / GPU</span>
                            </div>
                            <div className="font-medium text-slate-900 dark:text-white truncate" title={hardwareInfo.gpu}>
                                {hardwareInfo.gpu}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                {hardwareInfo.cpuCores} Cœurs logiques
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                                <HardDrive className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase">Mémoire & OS</span>
                            </div>
                            <div className="font-medium text-slate-900 dark:text-white">
                                {hardwareInfo.os} ({hardwareInfo.ram})
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                Navigateur: {hardwareInfo.browser}
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 col-span-1 md:col-span-2">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                                <Monitor className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase">Affichage</span>
                            </div>
                            <div className="font-medium text-slate-900 dark:text-white">
                                {hardwareInfo.screenResolution}
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Input Section */}
                <div className="glass-panel p-6 rounded-2xl border border-white/40 dark:border-white/10">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                        Informations Complémentaires
                    </h3>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Nom de l'équipement <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="ex: MacBook Pro de Thibault"
                                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Numéro de Série <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.serialNumber}
                                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                                    placeholder="ex: C02..."
                                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Utilisateur Principal
                                </label>
                                <input
                                    type="text"
                                    value={formData.user}
                                    onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                                    placeholder="ex: jean.dupont@example.com"
                                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Type d'équipement
                                </label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                >
                                    <option value="Laptop">Ordinateur Portable</option>
                                    <option value="Desktop">Ordinateur Fixe</option>
                                    <option value="Mobile">Smartphone</option>
                                    <option value="Tablet">Tablette</option>
                                    <option value="Other">Autre</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Notes
                            </label>
                            <textarea
                                rows={3}
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="État physique, accessoires fournis..."
                                className="w-full px-4 py-2.5 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none"
                            />
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2 text-sm font-medium border border-red-100 dark:border-red-900/30">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <Save className="h-5 w-5" />
                            Enregistrer l'équipement
                        </>
                    )}
                </button>
            </form>
        </div>
    );
};
