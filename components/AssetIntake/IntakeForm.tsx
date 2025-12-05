import React, { useState } from 'react';
import { HardwareInfo } from '../../utils/hardwareDetection';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { Laptop, Save, AlertTriangle, User, Server, Database } from '../ui/Icons';
import { Project, UserProfile } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';

interface IntakeFormProps {
    hardwareInfo: HardwareInfo;
    orgId: string;
    onSuccess: () => void;
}

export const IntakeForm: React.FC<IntakeFormProps> = ({ hardwareInfo, orgId, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [formData, setFormData] = useState({
        name: '',
        serialNumber: '',
        userId: '', // Changed from user string to userId for linking
        projectId: '',

        notes: '',
        hardwareType: hardwareInfo.isMobile ? 'Mobile' : 'Laptop' // Default guess
    });

    const assetTypeIcons: Record<string, React.ReactNode> = {
        'Laptop': <Laptop className="h-8 w-8 text-blue-600" />,
        'Server': <Server className="h-8 w-8 text-blue-600" />,
        'Workstation': <Laptop className="h-8 w-8 text-blue-600" />,
        'Mobile': <Laptop className="h-8 w-8 text-blue-600" />,
        'Tablet': <Laptop className="h-8 w-8 text-blue-600" />,
        'Network': <Server className="h-8 w-8 text-blue-600" />,
        'Storage': <Server className="h-8 w-8 text-blue-600" />,
        'Other': <AlertTriangle className="h-8 w-8 text-blue-600" />
    };

    React.useEffect(() => {
        const fetchOptions = async () => {
            if (!orgId) return;
            try {
                const [projSnap, userSnap] = await Promise.all([
                    getDocs(query(collection(db, 'projects'), where('organizationId', '==', orgId))),
                    getDocs(query(collection(db, 'users'), where('organizationId', '==', orgId)))
                ]);
                setProjects(projSnap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
                setUsers(userSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
            } catch (e) { ErrorLogger.error(e, 'IntakeForm.fetchOptions'); }
        };
        fetchOptions();

        // Smart Categorization
        if (hardwareInfo.os.includes('iOS') || hardwareInfo.os.includes('Android')) {
            setFormData(prev => ({ ...prev, hardwareType: 'Mobile' }));
        } else if (hardwareInfo.gpu.includes('NVIDIA') || Number(hardwareInfo.cpuCores) > 8) {
            setFormData(prev => ({ ...prev, hardwareType: 'Workstation' }));
        } else {
            setFormData(prev => ({ ...prev, hardwareType: 'Laptop' }));
        }
    }, [orgId, hardwareInfo]);

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


            const submitKioskAsset = httpsCallable(functions, 'submitKioskAsset');
            await submitKioskAsset({
                ...formData,
                orgId: orgId,
                hardware: hardwareInfo,
                userId: formData.userId,
                projectId: formData.projectId
            });
            onSuccess();
        } catch (err) {
            ErrorLogger.error(err, 'IntakeForm.handleSubmit');
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
                        {assetTypeIcons[formData.hardwareType]}
                        Matériel Détecté
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                                <User className="h-4 w-4" />
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
                                <Database className="h-4 w-4" />
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
                                <Laptop className="h-4 w-4" />
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
                                <FloatingLabelInput
                                    label="Nom de l'équipement"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="ex: MacBook Pro de Thibault"
                                    required
                                />
                            </div>
                            <div>
                                <FloatingLabelInput
                                    label="Numéro de Série"
                                    value={formData.serialNumber}
                                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                                    placeholder="ex: C02..."
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <CustomSelect
                                    label="Utilisateur Principal"
                                    value={formData.userId}
                                    onChange={(val) => setFormData({ ...formData, userId: val as string })}
                                    options={users.map(u => ({ value: u.uid, label: u.displayName }))}
                                    placeholder="-- Sélectionner un utilisateur --"
                                />
                            </div>
                            <div>
                                <CustomSelect
                                    label="Projet Associé"
                                    value={formData.projectId}
                                    onChange={(val) => setFormData({ ...formData, projectId: val as string })}
                                    options={projects.map(p => ({ value: p.id, label: p.name }))}
                                    placeholder="-- Aucun projet --"
                                />
                            </div>
                        </div>

                        <div>
                            <CustomSelect
                                label="Type d'équipement"
                                value={formData.hardwareType}
                                onChange={(val) => setFormData({ ...formData, hardwareType: val as string })}
                                options={[
                                    { value: 'Laptop', label: 'Ordinateur Portable' },
                                    { value: 'Desktop', label: 'Ordinateur Fixe' },
                                    { value: 'Mobile', label: 'Smartphone' },
                                    { value: 'Tablet', label: 'Tablette' },
                                    { value: 'Workstation', label: 'Station de Travail' },
                                    { value: 'Server', label: 'Serveur' },
                                    { value: 'Other', label: 'Autre' }
                                ]}
                            />
                        </div>

                        <div>
                            <FloatingLabelTextarea
                                label="Notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="État physique, accessoires fournis..."
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                {
                    error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2 text-sm font-medium border border-red-100 dark:border-red-900/30">
                            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                            {error}
                        </div>
                    )
                }

                <Button
                    type="submit"
                    isLoading={loading}
                    className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    <Save className="h-5 w-5 mr-2" />
                    Enregistrer l'équipement
                </Button>
            </form >
        </div >
    );
};
