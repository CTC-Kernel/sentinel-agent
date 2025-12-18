
import React, { useState } from 'react';
import { useStore } from '../store';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { PageHeader } from '../components/ui/PageHeader';
import { motion } from 'framer-motion';
import {
    FileText,
    ShieldAlert,
    ShieldCheck,
    Server,
    Download,
    Printer,
    History,
    Settings,
    FileSpreadsheet,
    Activity,
    BarChart3,
    FileCheck,
    Trash2,
    File as DocumentIcon,
    Lock
} from 'lucide-react';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { where, deleteDoc, doc } from 'firebase/firestore';
import { Risk, Audit, Asset, Document } from '../types';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { Button } from '../components/ui/button';
import { PdfService } from '../services/PdfService';
import { ErrorLogger } from '../services/errorLogger';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { getPlanLimits } from '../config/plans';
import { db } from '../firebase';
import { hasPermission, canDeleteResource } from '../utils/permissions';

export const Reports: React.FC = () => {
    const { user, organization, addToast } = useStore();
    const [activeTab, setActiveTab] = useState('generate');
    const [generating, setGenerating] = useState<string | null>(null);

    // Data Fetching
    const { data: risks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const { data: audits, loading: auditsLoading } = useFirestoreCollection<Audit>(
        'audits',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const { data: assets, loading: assetsLoading } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const { data: documents, loading: documentsLoading, refresh: refreshDocuments } = useFirestoreCollection<Document>(
        'documents',
        [
            where('organizationId', '==', user?.organizationId || 'ignore'),
            where('type', '==', 'Rapport')
        ],
        { enabled: !!user?.organizationId && activeTab === 'history' }
    );

    const isLoading = risksLoading || auditsLoading || assetsLoading;

    // RBAC Checks
    const canReadRisks = hasPermission(user, 'Risk', 'read', organization?.ownerId);
    const canReadAudits = hasPermission(user, 'Audit', 'read', organization?.ownerId);
    const canReadAssets = hasPermission(user, 'Asset', 'read', organization?.ownerId);
    // SoA relies on Controls/Risk/Asset, usually Risk management or Control read is good proxy.
    const canReadControls = hasPermission(user, 'Control', 'read', organization?.ownerId);
    const canManageDocuments = hasPermission(user, 'Document', 'manage', organization?.ownerId);

    const handleGenerateReport = async (type: string, title?: string) => {
        if (generating) return;
        setGenerating(type);
        addToast("Génération du rapport en cours...", "info");

        try {
            const limits = getPlanLimits(organization?.subscription?.planId || 'discovery');
            const canWhiteLabel = limits.features.whiteLabelReports;

            const baseOptions = {
                organizationName: canWhiteLabel ? (organization?.name || 'Sentinel GRC') : 'Sentinel GRC',
                organizationLogo: canWhiteLabel ? organization?.logoUrl : undefined,
                author: user?.displayName || user?.email || 'Utilisateur Sentinel',
                coverImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop',
                includeCover: true
            };

            switch (type) {
                case 'risks_executive':
                    if (!canReadRisks) throw new Error("Permission refusée");
                    PdfService.generateRiskExecutiveReport(risks, {
                        ...baseOptions,
                        title: title || "RAPPORT DE GOUVERNANCE CYBER",
                        subtitle: `Analyse des Risques & Conformité ISO 27001 | ${new Date().toLocaleDateString()}`,
                        filename: `rapport_executif_risques_${new Date().toISOString().split('T')[0]}.pdf`,
                    });
                    break;
                case 'audits_summary':
                    if (!canReadAudits) throw new Error("Permission refusée");
                    if (audits.length > 0) {
                        const latestAudit = audits[0];
                        PdfService.generateAuditExecutiveReport(latestAudit, [], {
                            ...baseOptions,
                            title: `RAPPORT D'AUDIT: ${latestAudit.name}`,
                            filename: `audit_${latestAudit.id}.pdf`
                        });
                    } else {
                        addToast("Aucun audit disponible pour le rapport", "info");
                    }
                    break;
                case 'assets_inventory':
                    if (!canReadAssets) throw new Error("Permission refusée");
                    const assetData = assets.map(a => [
                        a.name,
                        a.type,
                        a.confidentiality,
                        a.owner || 'N/A',
                        a.lifecycleStatus || 'Inconnu'
                    ]);
                    PdfService.generateTableReport(
                        {
                            ...baseOptions,
                            title: 'Registre des Actifs',
                            subtitle: `Inventaire exhaustif | ${new Date().toLocaleDateString()}`,
                            filename: 'inventaire_actifs.pdf',
                        },
                        ['Nom', 'Type', 'Confidentialité', 'Propriétaire', 'Statut'],
                        assetData
                    );
                    break;
                case 'compliance_soa':
                    // if (!canReadControls) throw new Error("Permission refusée");
                    addToast("Rapport SoA bientôt disponible", "info");
                    break;
                default:
                    addToast("Type de rapport non supporté", "error");
            }
            addToast("Rapport généré avec succès", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Reports.generate', 'REPORT_GENERATION_FAILED');
        } finally {
            setGenerating(null);
        }
    };

    const handleDeleteReport = async (id: string, name: string, ownerId?: string) => {
        if (!canDeleteResource(user, 'Document', ownerId, organization?.ownerId)) {
            addToast("Vous n'avez pas la permission de supprimer ce rapport", "error");
            return;
        }

        if (!confirm(`Supprimer le rapport ${name} ?`)) return;
        try {
            await deleteDoc(doc(db, 'documents', id));
            addToast("Rapport supprimé", "success");
            refreshDocuments();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Reports.delete', 'DELETE_FAILED');
        }
    };

    if (isLoading) return <LoadingScreen />;

    return (
        <div className="relative min-h-screen bg-transparent pb-20">
            <MasterpieceBackground />

            <div className="relative z-10 p-6 lg:p-10 max-w-[1600px] mx-auto space-y-8">
                <PageHeader
                    title="Centre de Rapports"
                    subtitle="Générez, consultez et personnalisez vos rapports de gouvernance et de conformité."
                    icon={<FileText className="w-8 h-8 text-white" />}
                    actions={
                        canManageDocuments && (
                            <Button variant="outline" className="gap-2">
                                <Settings className="w-4 h-4" />
                                Configuration
                            </Button>
                        )
                    }
                />

                <ScrollableTabs
                    tabs={[
                        { id: 'generate', label: 'Générer', icon: Printer },
                        { id: 'history', label: 'Historique', icon: History, count: documents.length },
                        { id: 'templates', label: 'Modèles', icon: FileSpreadsheet }
                    ]}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />

                <div className="space-y-6">
                    {activeTab === 'generate' && (
                        <>
                            {/* RISK REPORTS SECTION */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                                        <ShieldAlert className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Rapports de Risques</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <ReportCard
                                        title="Rapport Exécutif des Risques"
                                        description="Synthèse globale des risques majeurs, cartographie et plans de traitement pour le COMEX."
                                        icon={BarChart3}
                                        color="orange-500"
                                        onGenerate={() => handleGenerateReport('risks_executive')}
                                        loading={generating === 'risks_executive'}
                                        disabled={!canReadRisks}
                                    />
                                    <ReportCard
                                        title="Registre des Risques (Détaillé)"
                                        description="Export complet du registre des risques avec tous les attributs (Menace, Vulnérabilité, Scénario...)."
                                        icon={FileSpreadsheet}
                                        color="orange-600"
                                        onGenerate={() => handleGenerateReport('risks_executive', 'Registre des Risques')}
                                        loading={generating === 'risks_register'}
                                        disabled={!canReadRisks}
                                    />
                                </div>
                            </div>

                            {/* AUDIT REPORTS SECTION */}
                            <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-white/5">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                        <Activity className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Rapports d'Audit</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {audits.length > 0 ? (
                                        audits.slice(0, 3).map(audit => (
                                            <ReportCard
                                                key={audit.id}
                                                title={`Rapport: ${audit.name}`}
                                                description={`Rapport d'audit pour ${audit.scope || 'Périmètre non défini'}.`}
                                                icon={FileCheck}
                                                color="blue-500"
                                                onGenerate={() => {
                                                    setGenerating(`audit_${audit.id}`);
                                                    const limits = getPlanLimits(organization?.subscription?.planId || 'discovery');
                                                    const canWhiteLabel = limits.features.whiteLabelReports;

                                                    PdfService.generateAuditExecutiveReport(audit, [], {
                                                        organizationName: canWhiteLabel ? (organization?.name || 'Sentinel GRC') : 'Sentinel GRC',
                                                        organizationLogo: canWhiteLabel ? organization?.logoUrl : undefined,
                                                        author: user?.displayName || 'Auditeur',
                                                        title: `RAPPORT D'AUDIT: ${audit.name}`,
                                                        filename: `audit_${audit.id}.pdf`,
                                                        includeCover: true
                                                    }).save(`audit_${audit.id}.pdf`);

                                                    setGenerating(null);
                                                    addToast("Rapport téléchargé", "success");
                                                }}
                                                loading={generating === `audit_${audit.id}`}
                                                disabled={!canReadAudits}
                                            />
                                        ))
                                    ) : (
                                        <div className="col-span-3 py-8 text-center text-slate-500 bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                                            Aucun audit disponible. Créez un audit pour générer un rapport.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ASSET REPORTS SECTION */}
                            <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-white/5">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                        <Server className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Inventaires & Conformité</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <ReportCard
                                        title="Inventaire des Actifs"
                                        description="Liste exhaustive des actifs, classés par type, criticité et propriétaire."
                                        icon={Server}
                                        color="emerald-500"
                                        onGenerate={() => handleGenerateReport('assets_inventory')}
                                        loading={generating === 'assets_inventory'}
                                        disabled={!canReadAssets}
                                    />
                                    <ReportCard
                                        title="Statement of Applicability (SoA)"
                                        description="Déclaration d'applicabilité ISO 27001 (Annexe A) avec statuts et justifications."
                                        icon={ShieldCheck}
                                        color="indigo-500"
                                        onGenerate={() => handleGenerateReport('compliance_soa')}
                                        loading={generating === 'compliance_soa'}
                                        disabled={!canReadControls}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'history' && (
                        <div className="bg-white/60 dark:bg-[#0B1120]/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 shadow-sm overflow-hidden">
                            {documentsLoading ? (
                                <div className="p-8 flex justify-center"><LoadingScreen /></div>
                            ) : documents.length === 0 ? (
                                <div className="p-12 text-center text-slate-500">
                                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    Aucun rapport historique trouvé.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50/50 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-medium">
                                            <tr>
                                                <th className="px-6 py-4">Nom du rapport</th>
                                                <th className="px-6 py-4">Date</th>
                                                <th className="px-6 py-4">Auteur</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                            {documents.map((doc) => {
                                                const canDelete = canDeleteResource(user, 'Document', doc.ownerId, organization?.ownerId);
                                                return (
                                                    <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white flex items-center gap-3">
                                                            <div className="p-2 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                                                                <DocumentIcon className="w-4 h-4" />
                                                            </div>
                                                            {doc.title}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500">
                                                            {new Date(doc.createdAt).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500">
                                                            {doc.version || 'V1.0'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <a
                                                                    href={doc.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-2 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                                                                    title="Télécharger"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </a>
                                                                {canDelete && (
                                                                    <button
                                                                        onClick={() => handleDeleteReport(doc.id, doc.title, doc.ownerId)}
                                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                        title="Supprimer"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface ReportCardProps {
    title: string;
    description: string;
    icon: any;
    color: string;
    onGenerate: () => void;
    loading?: boolean;
    disabled?: boolean;
}

const ReportCard: React.FC<ReportCardProps> = ({ title, description, icon: Icon, color, onGenerate, loading, disabled }) => {
    return (
        <motion.div
            whileHover={disabled ? {} : { y: -5 }}
            className={`group relative flex flex-col p-6 bg-white/60 dark:bg-[#0B1120]/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 shadow-sm transition-all duration-300 ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-xl'}`}
        >
            <div className={`w-12 h-12 rounded-xl bg-opacity-10 bg-${color} flex items-center justify-center mb-4 ${disabled ? 'grayscale' : ''}`}>
                {/* Replaced dynamic class logic with simpler approach if needed, but keeping dynamic for now but extracting 'bg-' safer */}
                <Icon className={`w-6 h-6 text-${color} ${disabled ? 'text-slate-400' : ''}`} />
            </div>

            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-500 transition-colors">
                {title} {disabled && <Lock className="inline w-4 h-4 ml-2 opacity-50" />}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 flex-1 leading-relaxed">
                {description}
            </p>

            <Button
                onClick={onGenerate}
                disabled={loading || disabled}
                className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-brand-500 dark:hover:border-brand-500 text-slate-700 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 group-hover:shadow-lg transition-all"
                variant="outline"
            >
                {loading ? (
                    <>
                        <span className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Génération...
                    </>
                ) : disabled ? (
                    <>
                        <Lock className="w-4 h-4 mr-2" />
                        Accès restreint
                    </>
                ) : (
                    <>
                        <Download className="w-4 h-4 mr-2" />
                        Générer le PDF
                    </>
                )}
            </Button>
        </motion.div>
    );
};
