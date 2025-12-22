
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { PageHeader } from '../components/ui/PageHeader';
import { motion } from 'framer-motion';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';

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
    FileCheck,
    Trash2,
    Lock,
    Search,
    Archive,
    BarChart3
} from 'lucide-react';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { where, deleteDoc, doc, getDocs, query, collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Risk, Audit, Asset, Document, Control, Incident } from '../types';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { Button } from '../components/ui/button';
import { PdfService } from '../services/PdfService';
import { CompliancePackService } from '../services/CompliancePackService';
import { ErrorLogger } from '../services/errorLogger';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { db, storage } from '../firebase';
import { hasPermission, canDeleteResource } from '../utils/permissions';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { usePersistedState } from '../hooks/usePersistedState';
import { ReportTemplates } from '../components/reports/ReportTemplates';

export const Reports: React.FC = () => {
    const { user, organization, addToast, t } = useStore();
    const [activeTab, setActiveTab] = usePersistedState('reports_active_tab', 'generate');
    const [generating, setGenerating] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const { hasFeature } = usePlanLimits();
    const hasWhiteLabel = hasFeature('whiteLabelReports');
    const hasCompliancePack = hasFeature('customTemplates');

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
        { enabled: !!user?.organizationId }
    );

    const { data: controls, loading: controlsLoading } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId && activeTab === 'generate' }
    );

    const isLoading = risksLoading || auditsLoading || assetsLoading || controlsLoading;

    // RBAC Checks
    const canReadRisks = hasPermission(user, 'Risk', 'read', organization?.ownerId);
    const canReadAudits = hasPermission(user, 'Audit', 'read', organization?.ownerId);
    const canReadAssets = hasPermission(user, 'Asset', 'read', organization?.ownerId);
    // SoA relies on Controls/Risk/Asset, usually Risk management or Control read is good proxy.
    const canReadControls = hasPermission(user, 'Control', 'read', organization?.ownerId);
    const canManageDocuments = hasPermission(user, 'Document', 'manage', organization?.ownerId);

    const handleUpgradeClick = () => {
        addToast(t('reports.upgradePro'), "info");
        navigate('/pricing');
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saveGeneratedReport = async (doc: any, filename: string, title: string) => {
        if (!user?.organizationId || !doc) return;

        try {
            // 1. Get Blob
            const blob = doc.output('blob');

            // 2. Upload to Storage
            const storagePath = `documents/${user.organizationId}/${Date.now()}_${filename}`;
            const storageRef = ref(storage, storagePath);
            const snapshot = await uploadBytes(storageRef, blob);
            const url = await getDownloadURL(snapshot.ref);

            // 3. Create Document Record
            await addDoc(collection(db, 'documents'), {
                title: title,
                type: 'Rapport',
                url: url,
                hash: '', // Optional: could compute SHA-256
                ownerId: user.uid,
                owner: user.displayName || user.email || 'Système',
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: '1.0',
                size: blob.size,
                status: 'Validé',
                description: `Rapport généré automatiquement : ${title}`,
                isSecure: false,
                watermarkEnabled: false
            });

            refreshDocuments();
        } catch (error) {
            console.error("Error saving report to history:", error);
            // Don't toast error to user if download success, just log it.
            // Or maybe toast warning "Rapport téléchargé mais non sauvegardé dans l'historique".
        }
    };

    const handleGenerateReport = async (type: string, title?: string) => {
        if (generating) return;

        if (type === 'compliance_pack' && !hasCompliancePack) {
            handleUpgradeClick();
            return;
        }

        setGenerating(type);

        addToast(t('reports.generating'), "info");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let generatedDoc: any = null;
        let generatedFilename = '';
        let generatedTitle = title || 'Rapport';

        try {
            const canWhiteLabel = hasWhiteLabel;

            const baseOptions = {
                organizationName: canWhiteLabel ? (organization?.name || 'Sentinel GRC') : 'Sentinel GRC',
                organizationLogo: canWhiteLabel ? organization?.logoUrl : undefined,
                author: user?.displayName || user?.email || 'Utilisateur Sentinel',
                coverImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop',
                includeCover: true,
                autoDownload: true // Ensure user gets the download immediately
            };

            switch (type) {
                case 'risks_executive':
                    if (!canReadRisks) throw new Error(t('reports.permissionDenied'));
                    generatedTitle = title || t('reports.riskExecTitle').toUpperCase();
                    generatedFilename = `rapport_executif_risques_${new Date().toISOString().split('T')[0]}.pdf`;
                    generatedDoc = PdfService.generateRiskExecutiveReport(risks, {
                        ...baseOptions,
                        title: generatedTitle,
                        subtitle: `Analyse des Risques & Conformité ISO 27001 | ${new Date().toLocaleDateString()}`,
                        filename: generatedFilename,
                    });
                    break;
                case 'audits_summary':
                    if (!canReadAudits) throw new Error("Permission refusée");
                    if (audits.length > 0) {
                        const latestAudit = audits[0];
                        generatedTitle = `RAPPORT D'AUDIT: ${latestAudit.name}`;
                        generatedFilename = `audit_${latestAudit.id}.pdf`;
                        generatedDoc = PdfService.generateAuditExecutiveReport(latestAudit, [], {
                            ...baseOptions,
                            title: generatedTitle,
                            filename: generatedFilename
                        });
                    } else {
                        addToast("Aucun audit disponible pour le rapport", "info");
                        setGenerating(null);
                        return;
                    }
                    break;
                case 'assets_inventory': {
                    if (!canReadAssets) throw new Error(t('reports.permissionDenied'));
                    generatedTitle = t('reports.assetInvTitle');
                    generatedFilename = 'inventaire_actifs.pdf';
                    const assetData = assets.map(a => [
                        a.name,
                        a.type,
                        a.confidentiality,
                        a.owner || 'N/A',
                        a.lifecycleStatus || 'Inconnu'
                    ]);
                    generatedDoc = PdfService.generateTableReport(
                        {
                            ...baseOptions,
                            title: generatedTitle,
                            subtitle: `${t('reports.inventoryTitle')} | ${new Date().toLocaleDateString()}`,
                            filename: generatedFilename,
                        },
                        ['Nom', 'Type', 'Confidentialité', 'Propriétaire', 'Statut'],
                        assetData
                    );
                    break;
                }
                case 'compliance_soa':
                    if (!canReadControls) throw new Error(t('reports.permissionDenied'));
                    generatedTitle = t('reports.soaTitle').toUpperCase();
                    generatedFilename = `soa_audit_${new Date().toISOString().split('T')[0]}.pdf`;
                    generatedDoc = PdfService.generateComplianceExecutiveReport(controls, {
                        ...baseOptions,
                        title: generatedTitle,
                        subtitle: `${t('reports.soaDesc')} | ${new Date().toLocaleDateString()}`,
                        filename: generatedFilename,
                    });
                    break;
                case 'compliance_pack': {
                    // Compliance Pack Service handles its own zipping and generation logic
                    // It returns void usually or download trigger.
                    // If we want to save history for ZIPs, we'd need Service to return Blob.
                    // For now, assume it's standalone.
                    if (!canReadControls) throw new Error("Permission refusée");
                    const [incidentsSnap, allDocsSnap] = await Promise.all([
                        getDocs(query(collection(db, 'incidents'), where('organizationId', '==', user?.organizationId))),
                        getDocs(query(collection(db, 'documents'), where('organizationId', '==', user?.organizationId)))
                    ]);

                    const incidentsData = incidentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Incident));
                    const allDocumentsData = allDocsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Document));

                    await CompliancePackService.generatePack({
                        organizationName: canWhiteLabel ? (organization?.name || 'Sentinel GRC') : 'Sentinel GRC',
                        risks,
                        controls,
                        documents: allDocumentsData,
                        audits,
                        incidents: incidentsData,
                        assets
                    });
                    // Skip history saving for ZIP pack for now as it's complex blob
                    break;
                }
                default:
                    addToast(t('reports.unsupported'), "error");
                    setGenerating(null);
                    return;
            }

            if (generatedDoc) {
                // Save to history asynchronously
                saveGeneratedReport(generatedDoc, generatedFilename, generatedTitle);
                addToast(t('reports.success'), "success");
            }

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Reports.generate', 'REPORT_GENERATION_FAILED');
        } finally {
            setGenerating(null);
        }
    };

    const handleDeleteReport = async (id: string, name: string, ownerId?: string) => {
        if (!canDeleteResource(user, 'Document', ownerId, organization?.ownerId)) {
            addToast(t('reports.permissionDenied'), "error");
            return;
        }

        if (!confirm(t('reports.deleteTitle', { name }))) return;
        try {
            await deleteDoc(doc(db, 'documents', id));
            addToast(t('reports.deleteSuccess'), "success");
            refreshDocuments();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Reports.delete', 'DELETE_FAILED');
        }
    };

    const filteredDocuments = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.version?.includes(searchTerm)
    );

    if (isLoading) return <LoadingScreen />;

    return (
        <div className="relative min-h-screen bg-transparent pb-20 overflow-x-hidden">
            <MasterpieceBackground />

            <div className="relative z-10 p-6 lg:p-10 max-w-[1600px] mx-auto space-y-8">
                <PageHeader
                    title={t('reports.title')}
                    subtitle={t('reports.subtitle')}
                    icon={<FileText className="w-8 h-8 text-white" />}
                    actions={
                        canManageDocuments && (
                            <Button
                                variant="outline"
                                className="gap-2 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white backdrop-blur-md"
                                onClick={() => navigate('/settings?tab=reports')}
                            >
                                <Settings className="w-4 h-4" />
                                {t('reports.config')}
                            </Button>
                        )
                    }
                />

                <ScrollableTabs
                    tabs={[
                        { id: 'generate', label: t('reports.generate'), icon: Printer },
                        { id: 'history', label: t('reports.history'), icon: History, count: documents.length },
                        { id: 'templates', label: t('reports.templates'), icon: FileSpreadsheet }
                    ]}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />

                <motion.div
                    variants={staggerContainerVariants}
                    initial="initial"
                    animate="visible"
                    key={activeTab} // Retrigger animation on tab change
                    className="space-y-10"
                >
                    {activeTab === 'generate' && (
                        <>
                            {/* RISK REPORTS SECTION */}
                            <motion.section variants={slideUpVariants} className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 text-orange-500 border border-orange-500/20 shadow-lg shadow-orange-500/10">
                                        <ShieldAlert className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('reports.risksTitle')}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('reports.risksSubtitle')}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <ReportCard
                                        title={t('reports.riskExecTitle')}
                                        description={t('reports.riskExecDesc')}
                                        icon={BarChart3}
                                        color="orange-500"
                                        gradient="from-orange-500 to-red-500"
                                        onGenerate={() => handleGenerateReport('risks_executive')}
                                        loading={generating === 'risks_executive'}
                                        disabled={!canReadRisks}
                                    />
                                    <ReportCard
                                        title={t('reports.riskRegTitle')}
                                        description={t('reports.riskRegDesc')}
                                        icon={FileSpreadsheet}
                                        color="orange-600"
                                        gradient="from-orange-600 to-amber-600"
                                        onGenerate={() => handleGenerateReport('risks_executive', 'Registre des Risques')}
                                        loading={generating === 'risks_register'}
                                        disabled={!canReadRisks}
                                    />
                                </div>
                            </motion.section>

                            {/* AUDIT REPORTS SECTION */}
                            <motion.section variants={slideUpVariants} className="space-y-6 pt-6 border-t border-slate-200 dark:border-dashed dark:border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/10 text-blue-500 border border-blue-500/20 shadow-lg shadow-blue-500/10">
                                        <Activity className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('reports.auditsTitle')}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('reports.auditsSubtitle')}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {audits.length > 0 ? (
                                        audits.slice(0, 3).map(audit => (
                                            <ReportCard
                                                key={audit.id}
                                                title={t('reports.auditReportTitle', { name: audit.name })}
                                                description={t('reports.auditReportDesc', { scope: audit.scope || 'N/A' })}
                                                icon={FileCheck}
                                                color="blue-500"
                                                gradient="from-blue-500 to-cyan-500"
                                                onGenerate={() => {
                                                    setGenerating(`audit_${audit.id}`);
                                                    // Use the main handler for consistency/saving
                                                    handleGenerateReport('audits_summary');
                                                }}
                                                loading={generating === `audit_${audit.id}` || generating === 'audits_summary'}
                                                disabled={!canReadAudits}
                                            />
                                        ))
                                    ) : (
                                        <div className="col-span-3 py-12 flex flex-col items-center justify-center text-center text-slate-500 bg-white/50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 backdrop-blur-sm">
                                            <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-full mb-3">
                                                <Activity className="w-6 h-6 opacity-50" />
                                            </div>
                                            <p className="font-medium">{t('reports.noAudits')}</p>
                                            <p className="text-xs opacity-70 mt-1">{t('reports.createAuditHint')}</p>
                                        </div>
                                    )}
                                </div>
                            </motion.section>

                            {/* ASSET REPORTS SECTION */}
                            <motion.section variants={slideUpVariants} className="space-y-6 pt-6 border-t border-slate-200 dark:border-dashed dark:border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/10 text-emerald-500 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                                        <Server className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('reports.inventoryTitle')}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('reports.inventorySubtitle')}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <ReportCard
                                        title={t('reports.assetInvTitle')}
                                        description={t('reports.assetInvDesc')}
                                        icon={Server}
                                        color="emerald-500"
                                        gradient="from-emerald-500 to-green-500"
                                        onGenerate={() => handleGenerateReport('assets_inventory')}
                                        loading={generating === 'assets_inventory'}
                                        disabled={!canReadAssets}
                                    />
                                    <ReportCard
                                        title={t('reports.soaTitle')}
                                        description={t('reports.soaDesc')}
                                        icon={ShieldCheck}
                                        color="indigo-500"
                                        gradient="from-indigo-500 to-violet-500"
                                        onGenerate={() => handleGenerateReport('compliance_soa')}
                                        loading={generating === 'compliance_soa'}
                                        disabled={!canReadControls}
                                    />
                                    <ReportCard
                                        title={t('reports.packTitle')}
                                        description={t('reports.packDesc')}
                                        icon={Archive}
                                        color="purple-500"
                                        gradient="from-purple-500 to-fuchsia-500"
                                        onGenerate={() => handleGenerateReport('compliance_pack')}
                                        loading={generating === 'compliance_pack'}
                                        disabled={!canReadControls}
                                        locked={!hasCompliancePack}
                                        lockMessage={t('reports.upgradeLock')}
                                        onLockedClick={handleUpgradeClick}
                                    />
                                </div>
                            </motion.section>
                        </>
                    )}

                    {activeTab === 'history' && (
                        <motion.div variants={slideUpVariants} className="space-y-6">
                            {/* Search Bar for History */}
                            <div className="flex flex-col md:flex-row gap-4 p-1.5 bg-white/60 dark:bg-[#0B1120]/60 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl backdrop-blur-xl mb-2">
                                <div className="relative flex-1 min-w-0 group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder={t('reports.searchPlaceholder')}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-11 pr-4 py-2.5 bg-transparent rounded-xl border-none focus:ring-0 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
                                {documentsLoading ? (
                                    <div className="p-20 flex justify-center"><LoadingScreen /></div>
                                ) : filteredDocuments.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center p-20">
                                        <EmptyState
                                            icon={FileSpreadsheet}
                                            title={t('reports.emptyTitle')}
                                            description={searchTerm ? t('reports.emptyDescSearch') : t('reports.emptyDesc')}
                                        />
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('reports.cols.name')}</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('reports.cols.date')}</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('reports.cols.version')}</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('reports.cols.author')}</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('reports.cols.actions')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                                {filteredDocuments.map((doc, index) => {
                                                    const canDelete = canDeleteResource(user, 'Document', doc.ownerId, organization?.ownerId);
                                                    return (
                                                        <motion.tr
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: index * 0.05 }}
                                                            key={doc.id}
                                                            className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-all group"
                                                        >
                                                            <td className="px-8 py-4 font-medium text-slate-900 dark:text-white">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 group-hover:bg-white group-hover:shadow-md dark:group-hover:bg-brand-500/20 transition-all text-slate-500 dark:text-slate-400 group-hover:text-brand-500 dark:group-hover:text-brand-400">
                                                                        <FileText className="w-5 h-5" />
                                                                    </div>
                                                                    <span className="font-semibold">{doc.title}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                                                {new Date(doc.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <Badge variant="soft" status="info" className="bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                                                    {doc.version || 'V1.0'}
                                                                </Badge>
                                                            </td>
                                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
                                                                        {(doc.author?.[0] || 'U').toUpperCase()}
                                                                    </div>
                                                                    <span className="text-xs">{doc.author || 'Inconnu'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                                    <a
                                                                        href={doc.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/20 rounded-lg transition-colors"
                                                                        title={t('reports.download')}
                                                                    >
                                                                        <Download className="w-4 h-4" />
                                                                    </a>
                                                                    {canDelete && (
                                                                        <button
                                                                            onClick={() => handleDeleteReport(doc.id, doc.title, doc.ownerId)}
                                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                                                                            title={t('reports.delete')}
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </motion.tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'templates' && (
                        <ReportTemplates />
                    )}
                </motion.div>
            </div>
        </div>
    );
};

interface ReportCardProps {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    gradient: string;
    onGenerate: () => void;
    loading?: boolean;
    disabled?: boolean;
    color?: string;
    locked?: boolean;
    lockMessage?: string;
    onLockedClick?: () => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ title, description, icon: Icon, gradient, onGenerate, loading, disabled, locked, lockMessage, onLockedClick }) => {
    const { t } = useStore();
    const effectiveDisabled = disabled;
    const showLock = locked;
    const handleClick = () => {
        if (showLock) {
            onLockedClick?.();
            return;
        }
        onGenerate();
    };

    return (
        <motion.div
            whileHover={effectiveDisabled ? {} : { y: -8, scale: 1.02 }}
            className={`group relative flex flex-col p-8 bg-white/60 dark:bg-[#0B1120]/60 backdrop-blur-xl rounded-3xl border border-white/40 dark:border-white/5 shadow-lg shadow-slate-200/50 dark:shadow-none transition-all duration-300 ${effectiveDisabled && !showLock ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-2xl hover:border-brand-500/30 dark:hover:border-white/20'} ${showLock ? 'ring-1 ring-amber-500/20' : ''}`}
        >
            {/* Inner Glow Effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/50 to-transparent dark:from-white/5 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-6 shadow-lg transform group-hover:scale-110 transition-transform duration-300 ${effectiveDisabled && !showLock ? 'grayscale opacity-50' : ''}`}>
                <Icon className="w-7 h-7 text-white" />
            </div>

            <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors flex items-center justify-between">
                {title}
                {(effectiveDisabled || showLock) && <Lock className="w-5 h-5 opacity-40" />}
            </h4>

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 flex-1 leading-relaxed">
                {description}
            </p>
            {showLock && lockMessage && (
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    {lockMessage}
                </p>
            )}

            <Button
                onClick={handleClick}
                disabled={(loading || effectiveDisabled) && !showLock}
                className={`w-full h-12 rounded-xl font-bold tracking-wide transition-all shadow-md group-hover:shadow-lg ${showLock ? 'bg-amber-500 text-white hover:bg-amber-600 border-none' : (effectiveDisabled ? 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500 border-none' : 'bg-white dark:bg-white/10 text-slate-900 dark:text-white hover:bg-brand-600 hover:text-white dark:hover:bg-brand-500 border border-slate-200 dark:border-white/10')}`}
                variant="outline"
            >
                {loading ? (
                    <>
                        <span className="w-5 h-5 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {t('reports.generating').split('...')[0]}...
                    </>
                ) : showLock ? (
                    <>
                        <Lock className="w-4 h-4 mr-2" />
                        {t('reports.upgradeBtn')}
                    </>
                ) : effectiveDisabled ? (
                    <>
                        <Lock className="w-4 h-4 mr-2" />
                        {t('reports.restricted')}
                    </>
                ) : (
                    <>
                        <Download className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                        {t('reports.generatePdf')}
                    </>
                )}
            </Button>
        </motion.div>
    );
};
