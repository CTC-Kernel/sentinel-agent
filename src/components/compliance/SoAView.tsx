import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Control, Risk, SoAVersion, SoAControlSnapshot, Framework } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { Download, AlertTriangle, FileText, Save, History, Clock, User, ChevronRight, X, Loader2 } from '../ui/Icons';
import { useStore } from '../../store';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../../lib/utils';
import { ErrorLogger } from '../../services/errorLogger';
import { useLocale } from '@/hooks/useLocale';

interface SoAViewProps {
    controls: Control[];
    risks: Risk[];
    framework?: Framework;
    handlers: {
        updateControl: (id: string, updates: Partial<Control>) => Promise<boolean>;
        handleApplicabilityChange: (control: Control, isApplicable: boolean) => Promise<void>;
        updateJustification: (control: Control, text: string) => Promise<void>;
    };
    onSeed?: () => Promise<void>;
}

export const SoAView: React.FC<SoAViewProps> = ({ controls, risks, framework = 'ISO27001', handlers, onSeed }) => {
    const { user, addToast } = useStore();
    const { t } = useLocale();
    const [versions, setVersions] = useState<SoAVersion[]>([]);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [savingVersion, setSavingVersion] = useState(false);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<SoAVersion | null>(null);

    // Calculate current stats
    const currentStats = {
        totalControls: controls.length,
        applicableControls: controls.filter(c => c.applicability !== 'Non applicable' && c.status !== 'Non applicable').length,
        implementedControls: controls.filter(c => c.status === 'Implémenté').length,
        partialControls: controls.filter(c => c.status === 'Partiel').length,
    };

    // Load version history
    const loadVersions = useCallback(async () => {
        if (!user?.organizationId) return;
        setLoadingVersions(true);
        try {
            const versionsRef = collection(db, 'organizations', user.organizationId, 'soaVersions');
            const q = query(versionsRef, orderBy('generatedAt', 'desc'), limit(20));
            const snapshot = await getDocs(q);
            const loadedVersions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                generatedAt: doc.data().generatedAt instanceof Timestamp
                    ? doc.data().generatedAt.toDate().toISOString()
                    : doc.data().generatedAt
            })) as SoAVersion[];
            setVersions(loadedVersions);
        } catch (error) {
            ErrorLogger.error(error, 'SoAView.loadVersions');
        } finally {
            setLoadingVersions(false);
        }
    }, [user?.organizationId]);

    useEffect(() => {
        loadVersions();
    }, [loadVersions]);

    // Save current state as a new version
    const saveVersion = async () => {
        if (!user?.organizationId || !user?.uid) {
            addToast(t('soa.errorNotConnected', { defaultValue: 'Erreur: utilisateur non connecté' }), 'error');
            return;
        }

        setSavingVersion(true);
        try {
            const snapshot: SoAControlSnapshot[] = controls.map(c => ({
                code: c.code,
                name: c.name,
                applicability: c.applicability || (c.status === 'Non applicable' ? 'Non applicable' : 'Applicable'),
                justification: c.justification || '',
                status: c.status,
                risksCount: c.relatedRiskIds?.filter(id => risks.some(r => r.id === id)).length || 0,
                evidenceCount: c.evidenceIds?.length || 0,
            }));

            const newVersion = {
                organizationId: user.organizationId,
                framework,
                version: versions.length + 1,
                generatedAt: serverTimestamp(),
                generatedBy: user.uid,
                generatedByName: user.displayName || user.email || 'Unknown',
                controlsSnapshot: snapshot,
                stats: currentStats,
            };

            const versionsRef = collection(db, 'organizations', user.organizationId, 'soaVersions');
            await addDoc(versionsRef, newVersion);

            addToast(t('soa.versionSaved', { defaultValue: 'Version SoA sauvegardée' }), 'success');
            await loadVersions(); // Refresh the list
        } catch (error) {
            ErrorLogger.error(error, 'SoAView.saveVersion');
            addToast(t('soa.saveError', { defaultValue: 'Erreur lors de la sauvegarde' }), 'error');
        } finally {
            setSavingVersion(false);
        }
    };

    // Export PDF (current or selected version)
    const exportPDF = async (versionData?: SoAVersion) => {
        setExportingPdf(true);
        try {
            const doc = new jsPDF();
            const isHistorical = !!versionData;
            const title = isHistorical
                ? `Statement of Applicability (SoA) - ${versionData.framework} - v${versionData.version}`
                : `Statement of Applicability (SoA) - ${framework}`;

            doc.text(title, 14, 20);

            if (isHistorical && versionData) {
                doc.setFontSize(10);
                doc.text(`Généré le: ${new Date(versionData.generatedAt).toLocaleDateString('fr-FR')}`, 14, 28);
                doc.text(`Par: ${versionData.generatedByName}`, 14, 34);
            }

            const dataSource = isHistorical && versionData
                ? versionData.controlsSnapshot.map(c => [
                    c.code,
                    c.name,
                    c.applicability,
                    c.justification || '-',
                    c.status,
                    c.risksCount.toString()
                ])
                : controls.map(c => [
                    c.code,
                    c.name,
                    c.applicability || (c.status === 'Non applicable' ? 'Non applicable' : 'Applicable'),
                    c.justification || '-',
                    c.status,
                    (c.relatedRiskIds?.length || 0).toString()
                ]);

            autoTable(doc, {
                startY: isHistorical ? 42 : 30,
                head: [['Code', 'Nom', 'Applicabilité', 'Justification', 'Statut', 'Risques']],
                body: dataSource,
            });

            const filename = isHistorical
                ? `SoA_${versionData?.framework}_v${versionData?.version}.pdf`
                : 'SoA_Report.pdf';
            doc.save(filename);
            addToast(t('soa.exportSuccess', { defaultValue: 'Export SoA généré avec succès' }), 'success');
        } catch (error) {
            ErrorLogger.error(error, 'SoAView.exportPDF');
            addToast(t('soa.exportError', { defaultValue: 'Erreur lors de l\'export PDF' }), 'error');
        } finally {
            setExportingPdf(false);
        }
    };

    // Display data (current or selected historical version)
    const displayControls = selectedVersion
        ? selectedVersion.controlsSnapshot.map((snap, idx) => ({
            id: `snap-${idx}`,
            code: snap.code,
            name: snap.name,
            applicability: snap.applicability,
            justification: snap.justification,
            status: snap.status,
            linkedRisksCount: snap.risksCount,
            evidenceCount: snap.evidenceCount,
            isHistorical: true,
        }))
        : controls.map(c => ({
            id: c.id,
            code: c.code,
            name: c.name,
            description: c.description,
            applicability: c.applicability || (c.status === 'Non applicable' ? 'Non applicable' : 'Applicable'),
            justification: c.justification,
            status: c.status,
            linkedRisksCount: c.relatedRiskIds?.filter(id => risks.some(r => r.id === id)).length || 0,
            evidenceCount: c.evidenceIds?.length || 0,
            maturity: c.maturity,
            isHistorical: false,
            control: c,
        }));

    return (
        <div className="space-y-4">
            {/* Header with actions */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    {selectedVersion && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <History className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                                Version {selectedVersion.version} - {new Date(selectedVersion.generatedAt).toLocaleDateString('fr-FR')}
                            </span>
                            <button
                                onClick={() => setSelectedVersion(null)}
                                className="ml-2 p-0.5 hover:bg-yellow-200 dark:hover:bg-yellow-800 rounded"
                            >
                                <X className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setShowHistory(!showHistory)}
                        className="relative"
                    >
                        <History className="h-4 w-4 mr-2" />
                        Historique
                        {versions.length > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 rounded-full">
                                {versions.length}
                            </span>
                        )}
                    </Button>
                    {!selectedVersion && (
                        <Button
                            variant="outline"
                            onClick={saveVersion}
                            disabled={savingVersion || controls.length === 0}
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {savingVersion ? 'Sauvegarde...' : 'Sauvegarder version'}
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => exportPDF(selectedVersion || undefined)} disabled={exportingPdf}>
                        {exportingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        {t('soa.exportPdf', { defaultValue: 'Exporter SoA (PDF)' })}
                    </Button>
                </div>
            </div>

            {/* Version History Panel */}
            {showHistory && (
                <div className="glass-premium rounded-3xl p-4 space-y-3 border border-border/40">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <History className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                            Historique des versions
                        </h3>
                        <button
                            onClick={() => setShowHistory(false)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                            <X className="h-4 w-4 text-slate-500" />
                        </button>
                    </div>

                    {loadingVersions ? (
                        <div className="py-4 text-center text-slate-500">Chargement...</div>
                    ) : versions.length === 0 ? (
                        <div className="py-4 text-center text-slate-500">
                            Aucune version sauvegardée. Cliquez sur "Sauvegarder version" pour créer un snapshot.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {versions.map((version) => (
                                <button
                                    key={version.id}
                                    onClick={() => {
                                        setSelectedVersion(version);
                                        setShowHistory(false);
                                    }}
                                    className={cn(
                                        "w-full p-3 rounded-lg border text-left transition-all",
                                        selectedVersion?.id === version.id
                                            ? "border-brand-500 bg-brand-50 dark:bg-brand-800"
                                            : "border-border/40 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                                                <span className="text-sm font-bold text-brand-700 dark:text-brand-300">
                                                    v{version.version}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 text-sm text-slate-900 dark:text-white">
                                                    <Clock className="h-3 w-3 text-slate-400" />
                                                    {new Date(version.generatedAt).toLocaleDateString('fr-FR', {
                                                        day: 'numeric',
                                                        month: 'long',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <User className="h-3 w-3" />
                                                    {version.generatedByName}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right text-xs">
                                                <div className="text-green-600 dark:text-green-400">
                                                    {version.stats.implementedControls} implémentés
                                                </div>
                                                <div className="text-slate-500 dark:text-slate-400">
                                                    {version.stats.totalControls} contrôles
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-400" />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Stats Summary */}
            {!selectedVersion && controls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <div className="text-xs text-slate-500 dark:text-slate-300 uppercase">Total</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{currentStats.totalControls}</div>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-xs text-blue-600 dark:text-blue-400 uppercase">Applicables</div>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{currentStats.applicableControls}</div>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-xs text-green-600 dark:text-green-400 uppercase">Implémentés</div>
                        <div className="text-2xl font-bold text-green-700 dark:text-green-300">{currentStats.implementedControls}</div>
                    </div>
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="text-xs text-yellow-600 dark:text-yellow-400 uppercase">Partiels</div>
                        <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{currentStats.partialControls}</div>
                    </div>
                </div>
            )}

            {/* SoA Table */}
            <div className="overflow-x-auto rounded-lg border border-border/40 dark:border-border/40">
                {displayControls.length === 0 ? (
                    <div className="text-center py-12 space-y-4">
                        <p className="text-slate-600 dark:text-muted-foreground">Aucun contrôle disponible dans ce référentiel.</p>
                        {onSeed && !selectedVersion && (
                            <Button onClick={onSeed} variant="default">
                                Charger les contrôles par défaut
                            </Button>
                        )}
                    </div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-900/50">
                            <tr>
                                <th className="px-4 py-3">Code</th>
                                <th className="px-4 py-3">Contrôle</th>
                                <th className="px-4 py-3">Applicable</th>
                                <th className="px-4 py-3">Risques</th>
                                <th className="px-4 py-3">Preuves</th>
                                <th className="px-4 py-3">Justification</th>
                                <th className="px-4 py-3">Statut implémentation</th>
                                {!selectedVersion && <th className="px-4 py-3">Maturité</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-slate-900">
                            {displayControls.map(item => {
                                const isNonApplicable = item.applicability === 'Non applicable' || item.status === 'Non applicable';
                                const missingJustification = isNonApplicable && (!item.justification || item.justification.trim() === '');

                                return (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                        <td className="px-4 py-3 font-medium">{item.code}</td>
                                        <td className="px-4 py-3 max-w-sm">
                                            <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                                            {!item.isHistorical && 'description' in item && (
                                                <div className="text-xs text-slate-500 dark:text-slate-300 truncate" title={item.description}>{item.description}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.isHistorical ? (
                                                <Badge status={isNonApplicable ? 'neutral' : 'info'} variant="soft">
                                                    {item.applicability}
                                                </Badge>
                                            ) : (
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <span className="sr-only">Toggle applicability for {item.name}</span>
                                                    <input
                                                        checked={!isNonApplicable}
                                                        onChange={(e) => 'control' in item && item.control && handlers.handleApplicabilityChange(item.control, e.target.checked)}
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border/40 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                                                </label>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.linkedRisksCount > 0 ? (
                                                <Badge variant="outline" className="flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                                    {item.linkedRisksCount}
                                                </Badge>
                                            ) : <span className="text-muted-foreground">-</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.evidenceCount > 0 ? (
                                                <Badge variant="outline" className="flex items-center gap-1">
                                                    <FileText className="h-3 w-3 text-blue-500" />
                                                    {item.evidenceCount}
                                                </Badge>
                                            ) : <span className="text-muted-foreground">-</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.isHistorical ? (
                                                <span className={cn(
                                                    "text-xs",
                                                    missingJustification ? "text-red-500" : "text-slate-600 dark:text-slate-300"
                                                )}>
                                                    {item.justification || (missingJustification ? "Justification requise" : "-")}
                                                </span>
                                            ) : (
                                                <input
                                                    defaultValue={item.justification || ''}
                                                    onBlur={(e) => {
                                                        if ('control' in item && item.control && e.target.value !== item.justification) {
                                                            handlers.updateJustification(item.control, e.target.value);
                                                        }
                                                    }}
                                                    type="text"
                                                    className={`bg-transparent text-xs w-full focus:ring-1 focus-visible:ring-brand-500 rounded px-2 py-1 transition-colors ${missingJustification
                                                        ? 'border border-red-500 bg-red-50 dark:bg-red-50 dark:bg-red-900 placeholder-red-400'
                                                        : 'border-none placeholder-slate-400'
                                                        }`}
                                                    placeholder={missingJustification ? "Justification requise !" : "Ajouter une justification..."}
                                                    aria-label={`Justification pour ${item.name}`}
                                                />
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge status={
                                                item.status === 'Implémenté' ? 'success' :
                                                    item.status === 'Non applicable' ? 'neutral' :
                                                        item.status === 'Partiel' ? 'warning' : 'error'
                                            } variant="soft">
                                                {item.status}
                                            </Badge>
                                        </td>
                                        {!selectedVersion && !item.isHistorical && 'maturity' in item && (
                                            <td className="px-4 py-3">
                                                {item.maturity ? (
                                                    <div className="flex gap-1">
                                                        {[1, 2, 3, 4, 5].map(i => (
                                                            <div key={`star-${i}`} className={`h-1.5 w-3 rounded-sm ${i <= item.maturity! ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                                        ))}
                                                    </div>
                                                ) : '-'}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
