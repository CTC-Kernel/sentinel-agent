import React from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, Lock, LayoutTemplate, Star, ArrowRight } from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';

interface ReportTemplate {
    id: string;
    name: string;
    description: string;
    category: 'Risques' | 'Audits' | 'Conformité' | 'Projets';
    isPremium?: boolean;
    isCustom?: boolean;
}

const templates: ReportTemplate[] = [
    {
        id: 'risks_iso27005',
        name: 'Rapport Complet ISO 27005',
        description: 'Analyse détaillée des risques, scénarios de menaces et plans de traitement selon la norme ISO 27005.',
        category: 'Risques',
        isPremium: true
    },
    {
        id: 'audit_board',
        name: 'Synthèse pour Conseil d\'Administration',
        description: 'Format exécutif condensé metttant en avant les KPIs stratégiques et le ROI de la sécurité.',
        category: 'Audits',
        isPremium: true
    },
    {
        id: 'compliance_gdpr',
        name: 'Registre de Traitement (RGPD)',
        description: 'Modèle pré-configuré pour l\'export du registre des traitements des données personnelles.',
        category: 'Conformité'
    },
    {
        id: 'project_steerco',
        name: 'Support COMOP/COPIL',
        description: 'Présentation standardisée pour les comités de pilotage projets.',
        category: 'Projets'
    }
];

export const ReportTemplates: React.FC = () => {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <LayoutTemplate className="w-6 h-6 text-brand-500" />
                        Bibliothèque de Modèles
                    </h3>
                    <p className="text-slate-500 dark:text-muted-foreground mt-1">
                        Utilisez des modèles pré-configurés pour vos rapports récurrents.
                    </p>
                </div>
                <Button variant="default" className="gap-2">
                    <Star className="w-4 h-4" />
                    Créer un modèle
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template, index) => (
                    <motion.div
                        key={template.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group relative p-6 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 hover:border-brand-500/30 transition-all hover:shadow-xl"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 rounded-lg bg-slate-100 dark:bg-white/5 group-hover:bg-brand-500/10 text-slate-500 group-hover:text-brand-500 transition-colors">
                                <FileSpreadsheet className="w-6 h-6" />
                            </div>
                            {template.isPremium && (
                                <Badge variant="glass" status="warning" className="gap-1">
                                    <Lock className="w-3 h-3" />
                                    Premium
                                </Badge>
                            )}
                        </div>

                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-500 transition-colors">
                            {template.name}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-muted-foreground mb-6 h-10 line-clamp-2">
                            {template.description}
                        </p>

                        <div className="flex items-center justify-between mt-auto">
                            <Badge variant="soft" status="neutral">
                                {template.category}
                            </Badge>
                            <Button variant="ghost" size="sm" className="hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:text-brand-600">
                                Utiliser
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
