import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { CustomSelect } from '../ui/CustomSelect';
import { useSupplierDependencies } from '../../hooks/suppliers/useSupplierDependencies';
import { Supplier } from '../../types';
import { AlertCircle, FileText, Play } from '../ui/Icons';
import { toast } from '@/lib/toast';
import { SupplierService } from '../../services/SupplierService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    supplier: Supplier;
    onAssessmentCreated: (assessmentId: string) => void;
}

export const SupplierAssessmentModal: React.FC<Props> = ({ isOpen, onClose, supplier, onAssessmentCreated }) => {
    const { user } = useStore();
    const { templates, addTemplate, loading } = useSupplierDependencies({ fetchTemplates: true });

    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Seed "Standard DORA" template if no templates exist
    useEffect(() => {
        const seedTemplates = async () => {
            if (!loading && templates.length === 0 && user?.organizationId) {
                // Auto-seed a default DORA template for convenience
                await addTemplate({
                    organizationId: user.organizationId,
                    title: "Questionnaire de Conformité DORA (Standard)",
                    description: "Évaluation standard simplifiée des exigences DORA pour les prestataires TIC.",
                    sections: [
                        {
                            id: "sec_gov",
                            title: "Gouvernance & Risques",
                            description: "Organisation de la sécurité et gestion des risques.",
                            weight: 30,
                            questions: [
                                { id: "q1", text: "Avez-vous une politique de sécurité de l'information (PSSI) documentée et approuvée ?", type: "yes_no", required: true, weight: 1 },
                                { id: "q2", text: "Réalisez-vous une analyse de risques au moins annuellement ?", type: "yes_no", required: true, weight: 1 },
                                { id: "q3", text: "Avez-vous désigné un responsable de la sécurité (CISO/RSSI) ?", type: "yes_no", required: true, weight: 1 }
                            ]
                        },
                        {
                            id: "sec_inc",
                            title: "Gestion des Incidents",
                            description: "Capacité de détection et réponse aux incidents.",
                            weight: 30,
                            questions: [
                                { id: "q4", text: "Disposez-vous d'un processus formel de gestion des incidents majeurs ?", type: "yes_no", required: true, weight: 1 },
                                { id: "q5", text: "Notifiez-vous vos clients en cas d'incident impactant leurs données sous 24h ?", type: "yes_no", required: true, weight: 1 }
                            ]
                        },
                        {
                            id: "sec_res",
                            title: "Résilience & Continuité",
                            description: "Exigences de continuité d'activité (PCA/PRA).",
                            weight: 40,
                            questions: [
                                { id: "q6", text: "Avez-vous un Plan de Continuité d'Activité (PCA) testé régulièrement ?", type: "yes_no", required: true, weight: 1 },
                                { id: "q7", text: "Vos sauvegardes sont-elles chiffrées et testées ?", type: "yes_no", required: true, weight: 1 }
                            ]
                        }
                    ],
                    isDefault: true,
                    createdBy: user.uid
                });
            }
        };
        if (isOpen) {
            seedTemplates();
        }
    }, [isOpen, loading, templates.length, user, addTemplate]);

    const handleCreate = async () => {
        if (!selectedTemplateId || !user?.organizationId) return;

        setIsSubmitting(true);
        try {
            const template = templates.find(t => t.id === selectedTemplateId);
            if (!template) throw new Error("Modèle introuvable");

            const assessmentId = await SupplierService.createAssessment(
                user.organizationId,
                supplier.id,
                supplier.name,
                template
            );

            toast.success("Évaluation créée avec succès");
            onAssessmentCreated(assessmentId);
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de la création de l'évaluation");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-brand-600" />
                        Nouvelle Évaluation Fournisseur
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800 dark:text-blue-300">
                            <p className="font-semibold mb-1">Conformité DORA</p>
                            Cette évaluation permet de calculer le score de sécurité du fournisseur et de s'assurer de sa conformité aux exigences réglementaires.
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Modèle de questionnaire
                        </label>
                        {loading ? (
                            <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                        ) : (
                            <CustomSelect
                                options={templates.map(t => ({ value: t.id, label: t.title }))}
                                value={selectedTemplateId}
                                onChange={(val) => setSelectedTemplateId(val as string)}
                                placeholder="Sélectionner un modèle..."
                            />
                        )}
                        {templates.length === 0 && !loading && (
                            <p className="text-xs text-slate-500">Aucun modèle disponible. Un modèle par défaut va être généré...</p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Annuler</Button>
                    <Button
                        onClick={handleCreate}
                        disabled={!selectedTemplateId || isSubmitting}
                        className="gap-2"
                    >
                        <Play className="w-4 h-4" />
                        Lancer l'évaluation
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
