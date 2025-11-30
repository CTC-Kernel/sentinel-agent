import React, { useEffect, useState, useRef } from 'react';
import { RiskFormData, riskSchema } from '../schemas/riskSchema';
import { z } from 'zod';

import { collection, addDoc, getDocs, query, deleteDoc, doc, updateDoc, where, limit, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Risk, Control, Asset, SystemLog, UserProfile, RiskHistory, Project, BusinessProcess, Supplier, Audit, RiskRecommendation, RiskTreatment } from '../types';
import { canEditResource, canDeleteResource } from '../utils/permissions';
import { Plus, Search, Server, Trash2, History, MessageSquare, ShieldAlert, Flame, FileSpreadsheet, Clock, Copy, FolderKanban, Network, CheckCircle2, CalendarDays, Download, TrendingUp, TrendingDown, ArrowRight, Upload, LayoutDashboard, Filter, RefreshCw, Edit, FileText, BrainCircuit } from '../components/ui/Icons';
import { CustomSelect } from '../components/ui/CustomSelect';

import { RiskForm } from '../components/risks/RiskForm';
import { RelationshipGraph } from '../components/RelationshipGraph';
import { useStore } from '../store';
import { usePersistedState } from '../hooks/usePersistedState';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { logAction } from '../services/logger';
import { Comments } from '../components/ui/Comments';
import { PdfService } from '../services/PdfService';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { RiskDashboard } from '../components/risks/RiskDashboard';
import { RiskTemplateModal } from '../components/risks/RiskTemplateModal';
import { RiskTemplate, createRisksFromTemplate } from '../utils/riskTemplates';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { RiskAIAssistant } from '../components/risks/RiskAIAssistant';
import { RiskRecommendationsModal } from '../components/risks/RiskRecommendationsModal';


import { PageHeader } from '../components/ui/PageHeader';
import { Drawer } from '../components/ui/Drawer';
import { ErrorLogger } from '../services/errorLogger';
import { hybridService } from '../services/hybridService';
import { aiService } from '../services/aiService';
import { integrationService } from '../services/integrationService';
import { sanitizeData } from '../utils/dataSanitizer';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { useLocation } from 'react-router-dom';



export const Risks: React.FC = () => {
    const { user, addToast } = useStore();
    const location = useLocation();

    // Data Fetching with Hooks
    const { data: rawRisks, loading: risksLoading, refresh: refreshRisks, error: risksError } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, enabled: !!user?.organizationId }
    );

    useEffect(() => {
        if (risksError) {
            ErrorLogger.handleErrorWithToast(risksError, 'Risks.fetch');
        }
    }, [risksError, user]);

    const { data: rawControls, loading: controlsLoading } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: rawAssets, loading: assetsLoading } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: rawProcesses, loading: processesLoading } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: usersList, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: suppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, enabled: !!user?.organizationId }
    );

    // Derived State (Sorting)
    const risks = React.useMemo(() => [...rawRisks].sort((a, b) => b.score - a.score), [rawRisks]);
    const controls = React.useMemo(() => [...rawControls].sort((a, b) => a.code.localeCompare(b.code)), [rawControls]);
    const assets = React.useMemo(() => [...rawAssets].sort((a, b) => a.name.localeCompare(b.name)), [rawAssets]);



    const [creationMode, setCreationMode] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [filter, setFilter] = usePersistedState<string>('risks_filter', '');
    const [viewMode, setViewMode] = usePersistedState<'list' | 'matrix'>('risks_view_mode', 'list');

    // Matrix Filter State
    const [matrixFilter, setMatrixFilter] = usePersistedState<{ p: number, i: number } | null>('risks_matrix_filter', null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const canEdit = canEditResource(user, 'Risk');
    const [isEditing, setIsEditing] = useState(false);
    // const [currentRiskId, setCurrentRiskId] = useState<string | null>(null); // Removed unused
    const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
    const [mitreQuery, setMitreQuery] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [mitreResults, setMitreResults] = useState<any[]>([]);
    const [inspectorTab, setInspectorTab] = useState<'details' | 'treatment' | 'dashboard' | 'projects' | 'audits' | 'history' | 'comments' | 'graph' | 'threats'>('details');
    const [linkedProjects, setLinkedProjects] = useState<Project[]>([]);
    const [linkedAudits, setLinkedAudits] = useState<Audit[]>([]);
    const [riskHistory, setRiskHistory] = useState<SystemLog[]>([]);
    const [riskScoreHistory, setRiskScoreHistory] = useState<RiskHistory[]>([]);
    const [stats, setStats] = useState({ total: 0, critical: 0, mitigated: 0, reviewDue: 0 });
    const [importing, setImporting] = useState(false);
    const loading = risksLoading || controlsLoading || assetsLoading || usersLoading || processesLoading || suppliersLoading || importing;
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // AI Recommendations State
    const [showRecommendations, setShowRecommendations] = useState(false);
    const [recommendations, setRecommendations] = useState<RiskRecommendation[]>([]);
    const [analyzing, setAnalyzing] = useState(false);

    useEffect(() => {
        const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        setStats({
            total: risks.length,
            critical: risks.filter(r => r.score >= 15).length,
            mitigated: risks.filter(r => (r.residualScore || r.score) < r.score).length,
            reviewDue: risks.filter(r => !r.lastReviewDate || new Date(r.lastReviewDate) < oneYearAgo).length
        });
    }, [risks]);



    const openInspector = React.useCallback(async (risk: Risk) => {
        setSelectedRisk(risk);
        setCreationMode(false);
        setInspectorTab('details');
        setIsEditing(false);

        if (!user?.organizationId) {
            ErrorLogger.error("Cannot open inspector: User has no organization ID", 'Risks.openInspector');
            return;
        }

        try {
            const q = query(collection(db, 'system_logs'), where('organizationId', '==', user.organizationId), limit(50));
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => d.data() as SystemLog);
            const relevantLogs = logs.filter(l => l.resource === 'Risk' && l.details?.includes(risk.threat));
            relevantLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setRiskHistory(relevantLogs);

            const hq = query(collection(db, 'risk_history'), where('riskId', '==', risk.id), where('organizationId', '==', user.organizationId));
            const hSnap = await getDocs(hq);
            const historyData = hSnap.docs.map(d => ({ id: d.id, ...d.data() } as RiskHistory));
            historyData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setRiskScoreHistory(historyData);

            const projQ = query(collection(db, 'projects'), where('organizationId', '==', user?.organizationId), where('relatedRiskIds', 'array-contains', risk.id));
            getDocs(projQ).then(snap => { setLinkedProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project))); });

            const auditQ = query(collection(db, 'audits'), where('organizationId', '==', user?.organizationId), where('relatedRiskIds', 'array-contains', risk.id));
            getDocs(auditQ).then(snap => { setLinkedAudits(snap.docs.map(d => ({ id: d.id, ...d.data() } as Audit))); });

        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Risks.openInspector', 'FETCH_FAILED'); }
    }, [user?.organizationId]);

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || risks.length === 0) return;
        const risk = risks.find(r => r.id === state.voxelSelectedId);
        if (risk) {
            openInspector(risk);
        }
    }, [location.state, loading, risks, openInspector]);



    const onSubmit = async (data: RiskFormData) => {
        if (!canEdit || !user?.organizationId) return;

        try {
            // Validate data with Zod
            const validatedData = riskSchema.parse(data);

            const score = validatedData.probability * validatedData.impact;
            const residualScore = (validatedData.residualProbability || validatedData.probability) * (validatedData.residualImpact || validatedData.impact);

            // Derive owner name
            const ownerUser = usersList.find(u => u.uid === validatedData.ownerId);
            const ownerName = ownerUser?.displayName || '';

            // Sanitize data before sending to Firestore
            const cleanNewRisk = { ...sanitizeData(validatedData), owner: ownerName };

            // Creation only
            const docRef = await addDoc(collection(db, 'risks'), {
                ...cleanNewRisk,
                organizationId: user.organizationId,
                score,
                residualScore,
                previousScore: score,
                createdAt: new Date().toISOString()
            });

            if (cleanNewRisk.isSecureStorage) {
                await hybridService.storeSecureData('risk', {
                    id: docRef.id,
                    ...cleanNewRisk,
                    organizationId: user.organizationId
                });
                addToast("Risque sécurisé sur OVH SecNumCloud", "success");
            }

            // Centralized Audit Logging (SecNumCloud)
            await hybridService.logCriticalEvent({
                action: 'create',
                object_type: 'risk',
                object_id: docRef.id,
                description: `Created risk: ${cleanNewRisk.threat}`,
                metadata: { score, residualScore }
            });

            await logAction(user, 'CREATE', 'Risk', `Ajout risque: ${cleanNewRisk.threat}`);
            addToast("Risque ajouté", "success");
            setCreationMode(false);
            refreshRisks();
        } catch (error) {
            if (error instanceof z.ZodError) {
                addToast((error as unknown as { errors: { message: string }[] }).errors[0].message, "error");
            } else {
                ErrorLogger.handleErrorWithToast(error, 'Risks.onSubmit', 'CREATE_FAILED');
            }
        }
    };

    const handleUpdate = async (data: RiskFormData) => {
        if (!user?.organizationId || !selectedRisk) return;
        try {
            // Validate data with Zod
            const validatedData = riskSchema.parse(data);
            const riskData = sanitizeData({ ...validatedData });
            const score = riskData.probability * riskData.impact;
            const historyEntry: RiskHistory = {
                date: new Date().toISOString(),
                previousScore: selectedRisk.score,
                newScore: score,
                changedBy: user.email || 'Unknown',
                previousProbability: selectedRisk.probability,
                newProbability: riskData.probability,
                previousImpact: selectedRisk.impact,
                newImpact: riskData.impact,
                // Add justification if present (e.g. from AI)
                reason: data.justification
            };

            const updatedHistory = [...(selectedRisk.history || []), historyEntry];

            await updateDoc(doc(db, 'risks', selectedRisk.id), {
                ...riskData,
                score,
                history: updatedHistory
            });

            if (riskData.isSecureStorage) {
                await hybridService.storeSecureData('risk', {
                    id: selectedRisk.id,
                    ...riskData,
                    organizationId: user.organizationId
                });
                addToast("Données synchronisées avec OVH SecNumCloud", "success");
            }

            // Centralized Audit Logging (SecNumCloud)
            await hybridService.logCriticalEvent({
                action: 'update',
                object_type: 'risk',
                object_id: selectedRisk.id,
                description: `Updated risk: ${riskData.threat}`,
                metadata: {
                    previousScore: selectedRisk.score,
                    newScore: score
                }
            });

            await logAction(user, 'UPDATE', 'Risk', `Mise à jour risque: ${riskData.threat}`);
            addToast("Risque mis à jour", "success");
            setSelectedRisk({ ...selectedRisk, ...riskData, score, history: updatedHistory } as Risk);
            setIsEditing(false);
            refreshRisks();
        } catch (error) {
            if (error instanceof z.ZodError) {
                addToast((error as unknown as { errors: { message: string }[] }).errors[0].message, "error");
            } else {
                ErrorLogger.handleErrorWithToast(error, 'Risks.handleUpdate', 'UPDATE_FAILED');
            }
        }
    };

    const openCreationDrawer = () => {
        if (!canEdit) return;
        setSelectedRisk(null);
        setCreationMode(true);
    };

    const handleDuplicate = async () => {
        if (!selectedRisk || !canEdit || !user?.organizationId) return;
        try {
            const newRiskData = { ...selectedRisk, threat: `${selectedRisk.threat} (Copie)`, createdAt: new Date().toISOString() };
            await addDoc(collection(db, 'risks'), { ...newRiskData, organizationId: user.organizationId });
            await logAction(user, 'CREATE', 'Risk', `Duplication Risque: ${newRiskData.threat}`);
            addToast("Risque dupliqué", "success");
            refreshRisks();
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Risks.handleDuplicate', 'CREATE_FAILED'); }
    };

    const initiateDelete = async (id: string, threat: string) => {
        if (!canDeleteResource(user, 'Risk')) return;
        const incQ = query(collection(db, 'incidents'), where('organizationId', '==', user?.organizationId), where('relatedRiskId', '==', id));
        const projQ = query(collection(db, 'projects'), where('organizationId', '==', user?.organizationId), where('relatedRiskIds', 'array-contains', id));

        try {
            const [incSnap, projSnap] = await Promise.all([getDocs(incQ), getDocs(projQ)]);

            if (!incSnap.empty || !projSnap.empty) {
                addToast(`Impossible de supprimer : Lié à ${incSnap.size} incidents et ${projSnap.size} projets.`, "error");
                return;
            }
            setConfirmData({ isOpen: true, title: "Supprimer le risque ?", message: `Cette action est irréversible.`, onConfirm: () => handleDeleteRisk(id, threat) });
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Risks.initiateDelete', 'FETCH_FAILED'); }
    };

    const handleDeleteRisk = async (id: string, threat: string) => {
        try {
            await deleteDoc(doc(db, 'risks', id));

            // Centralized Audit Logging (SecNumCloud)
            await hybridService.logCriticalEvent({
                action: 'delete',
                object_type: 'risk',
                object_id: id,
                description: `Deleted risk: ${threat}`
            });

            await logAction(user, 'DELETE', 'Risk', `Suppression risque: ${threat}`);
            if (selectedRisk?.id === id) setSelectedRisk(null);
            addToast("Risque supprimé", "info");
            refreshRisks();
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Risks.handleDeleteRisk', 'DELETE_FAILED'); }
    };

    const handleStatusChange = async (risk: Risk, newStatus: Risk['status']) => {
        if (!canEdit) return;
        try {
            await updateDoc(doc(db, 'risks', risk.id), { status: newStatus });

            // Centralized Audit Logging
            await hybridService.logCriticalEvent({
                action: 'update_status',
                object_type: 'risk',
                object_id: risk.id,
                description: `Risk status changed to ${newStatus}`,
                metadata: { oldStatus: risk.status, newStatus }
            });

            await logAction(user, 'UPDATE', 'Risk', `Statut risque changé vers ${newStatus}`);
            refreshRisks();
            if (selectedRisk?.id === risk.id) setSelectedRisk({ ...selectedRisk, status: newStatus });
            addToast(`Statut changé`, "success");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Risks.handleStatusChange', 'UPDATE_FAILED'); }
    };

    const handleStrategyChange = async (risk: Risk, newStrategy: Risk['strategy']) => {
        if (!canEdit) return;
        try {
            await updateDoc(doc(db, 'risks', risk.id), { strategy: newStrategy });

            // Centralized Audit Logging
            await hybridService.logCriticalEvent({
                action: 'update_strategy',
                object_type: 'risk',
                object_id: risk.id,
                description: `Risk strategy changed to ${newStrategy}`,
                metadata: { oldStrategy: risk.strategy, newStrategy }
            });

            await logAction(user, 'UPDATE', 'Risk', `Stratégie risque changée vers ${newStrategy}`);
            refreshRisks();
            if (selectedRisk?.id === risk.id) setSelectedRisk({ ...selectedRisk, strategy: newStrategy });
            addToast(`Stratégie changée`, "success");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Risks.handleStrategyChange', 'UPDATE_FAILED'); }
    };

    const handleReview = async () => {
        if (!canEdit || !selectedRisk) return;
        const today = new Date().toISOString();
        try {
            await updateDoc(doc(db, 'risks', selectedRisk.id), { lastReviewDate: today });
            await logAction(user, 'REVIEW', 'Risk', `Revue validée: ${selectedRisk.threat}`);
            // setRisks(prev => prev.map(r => r.id === selectedRisk.id ? { ...r, lastReviewDate: today } : r)); // Removed manual state update, relying on refresh
            setSelectedRisk({ ...selectedRisk, lastReviewDate: today });
            addToast("Revue du risque validée", "success");
            refreshRisks();
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Risks.handleReview', 'UPDATE_FAILED'); }
    };

    const handleImportTemplate = async (template: RiskTemplate, owner: string) => {
        if (!canEdit || !user?.organizationId) return;
        try {
            const risksToImport = createRisksFromTemplate(template, user.organizationId, owner);

            const batch = writeBatch(db);
            risksToImport.forEach(risk => {
                const newRiskRef = doc(collection(db, 'risks'));
                // Try to resolve ownerId
                const ownerUser = usersList.find(u => u.displayName === owner || u.email === owner);
                batch.set(newRiskRef, { ...risk, ownerId: ownerUser?.uid || '' });
            });

            await batch.commit();
            await logAction(user, 'CREATE', 'Risk', `Import de ${risksToImport.length} risques depuis template ${template.name}`);
            addToast(`${risksToImport.length} risques importés avec succès`, "success");
            setShowTemplateModal(false);
            refreshRisks();
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Risks.handleImportTemplate', 'CREATE_FAILED');
        }
    };



    const handleExportCSV = () => {
        const headers = ["Menace", "Vulnérabilité", "Actif", "Score Brut", "Score Résiduel", "Stratégie", "Statut", "Propriétaire"];
        const rows = filteredRisks.map(r => [r.threat, r.vulnerability, getAssetName(r.assetId), r.score.toString(), (r.residualScore || r.score).toString(), r.strategy, r.status, r.owner || '']);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
        const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })); link.download = `risks.csv`; link.click();
    };

    const exportPDF = () => {
        const data = risks.map(r => [
            r.threat,
            `${r.probability}x${r.impact} (${r.score})`,
            r.strategy,
            r.status,
            r.residualScore ? `${r.residualScore}` : '-'
        ]);

        PdfService.generateTableReport(
            {
                title: 'Registre des Risques',
                subtitle: `Exporté le ${new Date().toLocaleDateString()}`,
                filename: 'risques.pdf'
            },
            ['Menace', 'Brut', 'Stratégie', 'Statut', 'Résiduel'],
            data
        );
    };

    const generateRTP = async () => {
        addToast("Génération du RTP avec analyse IA...", "info");
        try {
            const summary = await aiService.generateRTPSummary(
                filteredRisks.map(r => ({ threat: r.threat, score: r.score, strategy: r.strategy, status: r.status }))
            );

            PdfService.generateExecutiveReport(
                {
                    title: 'Plan de Traitement des Risques (RTP)',
                    subtitle: `ISO 27001 | ${new Date().toLocaleDateString()}`,
                    filename: 'RTP.pdf',
                    organizationName: user?.email?.split('@')[1] || 'Sentinel GRC',
                    author: user?.displayName || 'RSSI',
                    summary: summary
                },
                (doc, startY) => {
                    let y = startY;

                    doc.setFontSize(14); doc.setTextColor(79, 70, 229); doc.setFont('helvetica', 'bold');
                    doc.text("Tableau de Traitement", 14, y);
                    y += 8;

                    const data = filteredRisks.map(r => [
                        r.threat,
                        r.score.toString(),
                        r.strategy,
                        r.status,
                        (r.residualScore || r.score).toString()
                    ]);

                    (doc as unknown as { autoTable: (options: unknown) => void }).autoTable({
                        startY: y,
                        head: [['Menace', 'Brut', 'Stratégie', 'Statut', 'Résiduel']],
                        body: data,
                        theme: 'striped',
                        headStyles: { fillColor: [79, 70, 229] },
                        styles: { fontSize: 9 }
                    });
                }
            );
            addToast("RTP généré avec succès", "success");
        } catch (error) {
            ErrorLogger.error(error, 'Risks.generateRTP');
            addToast("Erreur lors de la génération du RTP", "error");
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!canEdit || !user?.organizationId) return;
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) return;
            const lines = text.split('\n').slice(1).filter(line => line.trim() !== '');
            if (lines.length === 0) { addToast("Fichier CSV vide", "error"); return; }
            setImporting(true);
            try {
                const batch = writeBatch(db);
                let count = 0;
                lines.forEach(line => {
                    const cols = line.split(',');
                    if (cols.length >= 3) {
                        const newRef = doc(collection(db, 'risks'));
                        const prob = Math.min(Math.max(parseInt(cols[3]?.trim()) || 3, 1), 5) as Risk['probability'];
                        const imp = Math.min(Math.max(parseInt(cols[4]?.trim()) || 3, 1), 5) as Risk['impact'];
                        batch.set(newRef, {
                            organizationId: user.organizationId,
                            threat: cols[0]?.trim() || 'Menace importée',
                            vulnerability: cols[1]?.trim() || '',
                            assetId: '',
                            probability: prob,
                            impact: imp,
                            score: prob * imp,
                            residualScore: prob * imp,
                            strategy: 'Atténuer',
                            status: 'Ouvert',
                            owner: '',
                            createdAt: new Date().toISOString()
                        });
                        count++;
                    }
                });
                await batch.commit();
                await logAction(user, 'IMPORT', 'Risk', `Import CSV de ${count} risques`);
                addToast(`${count} risques importés`, "success");
                refreshRisks();

            } catch (error) { ErrorLogger.handleErrorWithToast(error, 'Risks.handleFileUpload', 'FILE_UPLOAD_FAILED'); } finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
        };
        reader.readAsText(file);
    };

    const getAssetName = (id?: string) => assets.find(a => a.id === id)?.name || 'Actif inconnu';

    const filteredRisks = risks.filter(r => {
        const matchesSearch = r.threat.toLowerCase().includes(filter.toLowerCase()) || r.vulnerability.toLowerCase().includes(filter.toLowerCase());
        // Matrix filtering logic: Only show if no filter set OR if matches specific probability AND impact
        const matchesMatrix = matrixFilter ? (r.probability === matrixFilter.p && r.impact === matrixFilter.i) : true;
        return matchesSearch && matchesMatrix;
    });

    const getRisksForCell = (prob: number, impact: number) => risks.filter(r => r.probability === prob && r.impact === impact);

    const getCellColor = (prob: number, impact: number) => { const score = prob * impact; if (score >= 15) return 'bg-rose-500 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]'; if (score >= 10) return 'bg-orange-500 shadow-[inset_0_0_10px_rgba(0,0,0,0.1)]'; if (score >= 5) return 'bg-amber-400'; return 'bg-emerald-500'; };

    const getRiskLevel = (score: number) => { if (score >= 15) return { label: 'Critique', color: 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 border-rose-400' }; if (score >= 10) return { label: 'Élevé', color: 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 border-orange-400' }; if (score >= 5) return { label: 'Moyen', color: 'bg-amber-400 text-white shadow-lg shadow-amber-400/30 border-amber-300' }; return { label: 'Faible', color: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 border-emerald-400' }; };

    const handleGenerateReport = async () => {
        try {
            addToast("Génération du rapport PDF en cours...", "info");
            // Reuse the exportPDF logic but maybe with a different title or format if needed
            // For now, we'll use the same robust frontend generator
            exportPDF();
            addToast("Rapport téléchargé avec succès", "success");

            // Centralized Audit Logging
            await hybridService.logCriticalEvent({
                action: 'export',
                object_type: 'report',
                object_id: 'risk_register',
                description: 'Generated Risk Register PDF'
            });
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Risks.handleGenerateReport', 'UNKNOWN_ERROR');
        }
    };

    const handleAIAnalysis = async () => {
        try {
            setAnalyzing(true);
            setShowRecommendations(true);

            // Use local AI Service instead of backend
            const graphData = {
                assets: assets,
                risks: risks,
                projects: [], // We don't have these loaded globally here, passing empty for now
                audits: [],
                incidents: [],
                suppliers: suppliers
            };

            const response = await aiService.analyzeGraph(graphData);

            // Map AI insights to recommendations format
            // The AI service returns 'insights', we need to adapt them to 'RiskRecommendation'
            // or update the modal to accept insights.
            // For now, we'll map them to a compatible structure if possible, 
            // or just use the insights as recommendations.

            // RiskRecommendation interface: { id, riskId, title, description, type, impact, suggestedAction }
            // AIInsight interface: { id, type, title, description, relatedIds, severity }

            const mappedRecommendations: RiskRecommendation[] = response.insights.map(insight => ({
                title: insight.title,
                description: insight.description,
                priority: insight.severity === 'critical' ? 'urgent' : insight.severity === 'high' ? 'high' : 'medium',
                suggested_actions: [{ action: insight.description, priority: 'high' }],
                confidence_score: 0.85
            }));

            setRecommendations(mappedRecommendations);

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Risks.handleAIAnalysis', 'UNKNOWN_ERROR');
            setShowRecommendations(false);
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6 relative">
            <RiskTemplateModal
                isOpen={showTemplateModal}
                onClose={() => setShowTemplateModal(false)}
                onSelectTemplate={handleImportTemplate}
                owners={usersList.map(u => u.displayName || u.email)}
            />

            <RiskRecommendationsModal
                isOpen={showRecommendations}
                onClose={() => setShowRecommendations(false)}
                recommendations={recommendations}
                isLoading={analyzing}
            />

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <PageHeader
                title="Gestion des Risques"
                subtitle="Analyse et traitement des risques selon ISO 27005."
                breadcrumbs={[
                    { label: 'Risques' }
                ]}
                icon={<ShieldAlert className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={canEdit && (
                    <>
                        <button
                            onClick={() => setShowTemplateModal(true)}
                            className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Importer Template
                        </button>

                        <button
                            onClick={handleGenerateReport}
                            className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                        >
                            <FileText className="h-4 w-4 mr-2 text-red-500" />
                            Rapport PDF
                        </button>

                        <button
                            onClick={handleAIAnalysis}
                            className="flex items-center px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                        >
                            <BrainCircuit className="h-4 w-4 mr-2" />
                            Analyse IA
                        </button>
                        <button onClick={openCreationDrawer} className="flex items-center space-x-2 px-4 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20">
                            <Plus className="w-5 h-5" />
                            <span>Nouveau Risque</span>
                        </button>
                    </>
                )}
            />

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Risques</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p></div><div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600"><ShieldAlert className="h-6 w-6" /></div></div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">Critiques / Élevés</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.critical}</p></div><div className="p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600"><Flame className="h-6 w-6" /></div></div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">Atténués</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.mitigated}</p></div><div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"><TrendingUp className="h-6 w-6" /></div></div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-1">Revues en retard</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.reviewDue}</p></div><div className="p-3 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-600"><Clock className="h-6 w-6" /></div></div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex items-center space-x-4 glass-panel p-1.5 pl-4 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 transition-all flex-1 border border-slate-200 dark:border-white/5"><Search className="h-5 w-5 text-gray-400" /><input type="text" placeholder="Rechercher une menace ou une vulnérabilité..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white py-2.5 font-medium placeholder-gray-400" value={filter} onChange={e => setFilter(e.target.value)} /></div>
                <div className="flex gap-2">
                    <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <button onClick={generateRTP} className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-all shadow-sm text-slate-700 dark:text-white"><Download className="h-4 w-4 mr-2" /> RTP (PDF)</button>
                    <button onClick={exportPDF} className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-all shadow-sm text-slate-700 dark:text-white"><FileText className="h-4 w-4 mr-2" /> Registre (PDF)</button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm" title="Importer CSV"><Upload className="h-4 w-4" /></button>
                    <button onClick={handleExportCSV} className="p-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"><FileSpreadsheet className="h-4 w-4" /></button>
                    <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm ml-2"><button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Liste</button><button onClick={() => setViewMode('matrix')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${viewMode === 'matrix' ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}><LayoutDashboard className="h-4 w-4 mr-2" /> Matrice</button></div>
                </div>
            </div>

            {/* Filter Feedback */}
            {matrixFilter && (
                <div className="flex items-center justify-between bg-brand-50 dark:bg-brand-900/20 p-4 rounded-2xl border border-brand-100 dark:border-brand-900/30 animate-slide-up shadow-sm">
                    <div className="flex items-center gap-3">
                        <Filter className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                        <span className="text-sm font-bold text-brand-900 dark:text-brand-100">
                            Filtrage actif : <span className="bg-white dark:bg-black/20 px-2 py-0.5 rounded-lg shadow-sm">Probabilité {matrixFilter.p}</span> × <span className="bg-white dark:bg-black/20 px-2 py-0.5 rounded-lg shadow-sm">Impact {matrixFilter.i}</span>
                        </span>
                    </div>
                    <button onClick={() => setMatrixFilter(null)} className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center bg-white dark:bg-black/20 px-3 py-1.5 rounded-lg shadow-sm transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"><RefreshCw className="h-3 w-3 mr-1.5" /> Réinitialiser</button>
                </div>
            )}

            {viewMode === 'matrix' ? (
                <div className="glass-panel p-8 rounded-[2.5rem] shadow-xl overflow-x-auto animate-fade-in border border-white/50 dark:border-white/5">
                    <div className="min-w-[700px]">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Matrice de Criticité</h3>
                            <div className="flex gap-2 text-xs font-medium">
                                <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-rose-500 mr-2"></span>Critique</span>
                                <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-orange-500 mr-2"></span>Élevé</span>
                                <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-amber-400 mr-2"></span>Moyen</span>
                                <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span>Faible</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-6">
                            <div className="flex items-center justify-center -rotate-90 font-bold text-xs text-slate-400 uppercase tracking-widest h-[500px] w-8">Probabilité</div>
                            <div className="grid grid-rows-5 grid-cols-5 gap-3 h-[500px]">
                                {[5, 4, 3, 2, 1].map(prob => (
                                    <React.Fragment key={prob}>
                                        {[1, 2, 3, 4, 5].map(impact => {
                                            const cellRisks = getRisksForCell(prob, impact);
                                            const hasRisks = cellRisks.length > 0;
                                            const isSelected = matrixFilter?.p === prob && matrixFilter?.i === impact;

                                            return (
                                                <CustomTooltip key={`${prob}-${impact}`} content={`Prob: ${prob}, Impact: ${impact}, Risques: ${cellRisks.length}`} position="top">
                                                    <div
                                                        onClick={() => hasRisks && setMatrixFilter(isSelected ? null : { p: prob, i: impact })}
                                                        className={`
                                                  relative rounded-2xl flex items-center justify-center transition-all duration-300 border cursor-pointer border-white/20 dark:border-black/10 group
                                                  ${getCellColor(prob, impact)}
                                                  ${hasRisks ? 'hover:scale-[1.02] hover:z-10 hover:shadow-xl cursor-pointer' : 'opacity-40 scale-95 grayscale cursor-default'}
                                                  ${isSelected ? 'ring-4 ring-slate-900 dark:ring-white scale-[1.05] z-20 shadow-2xl opacity-100 animate-pulse' : matrixFilter && hasRisks ? 'opacity-40' : ''}
                                              `}
                                                    >
                                                        {hasRisks && (
                                                            <>
                                                                <span className="text-3xl font-black text-white drop-shadow-md">{cellRisks.length}</span>
                                                                <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                            </>
                                                        )}
                                                    </div>
                                                </CustomTooltip>
                                            )
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-6 mt-4">
                            <div className="w-8"></div>
                            <div className="text-center font-bold text-xs text-slate-400 uppercase tracking-widest">Impact</div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 animate-fade-in">
                    {loading ? (
                        <div className="col-span-full"><CardSkeleton count={3} /></div>
                    ) : filteredRisks.length === 0 ? (
                        <div className="col-span-full">
                            <EmptyState
                                icon={ShieldAlert}
                                title="Aucun risque identifié"
                                description={filter ? "Aucun risque ne correspond à votre recherche." : "Identifiez et évaluez les risques pour protéger votre organisation."}
                                actionLabel={filter ? undefined : "Nouveau Risque"}
                                onAction={filter ? undefined : openCreationDrawer}
                            />
                        </div>
                    ) : filteredRisks.map(risk => {
                        const level = getRiskLevel(risk.score);
                        const residualScore = risk.residualScore || risk.score;
                        const isMitigated = residualScore < risk.score;
                        const trend = risk.previousScore && risk.score > risk.previousScore ? 'up' : risk.previousScore && risk.score < risk.previousScore ? 'down' : 'stable';

                        return (
                            <div key={risk.id} onClick={() => openInspector(risk)} className="group glass-panel p-6 rounded-[2rem] card-hover flex flex-col h-full relative cursor-pointer border border-white/50 dark:border-white/5">
                                <div className="flex justify-between items-start mb-5">
                                    <div className="flex items-center gap-2">
                                        <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm flex items-center border ${level.color}`}>{level.label} {risk.score}</div>
                                        {trend === 'up' && <span className="text-red-500" title="En hausse"><TrendingUp className="h-4 w-4" /></span>}
                                        {trend === 'down' && <span className="text-emerald-500" title="En baisse"><TrendingDown className="h-4 w-4" /></span>}
                                        {isMitigated && (<><ArrowRight className="w-3 h-3 text-gray-400" /><div className="px-2.5 py-1 text-[10px] font-bold rounded-full border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800">Résiduel: {residualScore}</div></>)}
                                    </div>
                                </div>
                                <div className="mb-4 flex-1">
                                    <div className="flex items-center mb-3">
                                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 mr-2.5"><Server className="w-3.5 h-3.5" /></div>
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{getAssetName(risk.assetId)}</span>
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white leading-snug mb-2 line-clamp-2">{risk.threat}</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-900/50 p-3 rounded-xl inline-block w-full border border-slate-100 dark:border-white/5">
                                        <span className="font-bold text-xs uppercase text-slate-400 block mb-1">Vulnérabilité</span>{risk.vulnerability}
                                    </p>
                                </div>
                                <div className="space-y-3 pt-4 border-t border-dashed border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">{risk.strategy}</span>
                                        <div className="flex items-center gap-2">
                                            {risk.treatment?.slaStatus && risk.treatment.status !== 'Terminé' && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${risk.treatment.slaStatus === 'Breached' ? 'bg-red-100 text-red-700 border-red-200' :
                                                    risk.treatment.slaStatus === 'At Risk' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                        'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                    }`}>
                                                    SLA: {risk.treatment.slaStatus}
                                                </span>
                                            )}
                                            <span className={`text-xs font-bold ${risk.status === 'Ouvert' ? 'text-rose-500' : risk.status === 'En cours' ? 'text-amber-500' : 'text-emerald-500'}`}>{risk.status}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>)
                    })}</div>
            )}

            {/* Inspector & Creation Drawer */}
            <Drawer
                isOpen={!!selectedRisk || creationMode}
                onClose={() => { setSelectedRisk(null); setCreationMode(false); setIsEditing(false); }}
                title={creationMode ? 'Nouveau Risque' : selectedRisk?.threat}
                subtitle={
                    creationMode ? 'Création' : (
                        <div className="flex items-center gap-2">
                            <Server className="h-3.5 w-3.5" /> {getAssetName(selectedRisk?.assetId)}
                        </div>
                    )
                }
                width={creationMode || isEditing ? "max-w-4xl" : "max-w-6xl"}
                actions={
                    !creationMode && (
                        <>
                            {canEdit && selectedRisk && (
                                <>
                                    <button onClick={handleDuplicate} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm" title="Dupliquer" aria-label="Dupliquer le risque">
                                        <Copy className="h-5 w-5" />
                                    </button>
                                    <button onClick={() => setIsEditing(true)} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm" title="Modifier" aria-label="Modifier le risque">
                                        <Edit className="h-5 w-5" />
                                    </button>
                                    <button onClick={() => initiateDelete(selectedRisk.id, selectedRisk.threat)} className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm" aria-label="Supprimer le risque">
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </>
                            )}
                        </>
                    )
                }
            >
                {creationMode ? (
                    <RiskForm
                        onSubmit={onSubmit}
                        onCancel={() => setCreationMode(false)}
                        assets={assets}
                        usersList={usersList}
                        processes={rawProcesses}
                        suppliers={suppliers}
                        controls={controls}
                    />
                ) : selectedRisk && (
                    <div className="flex flex-col h-full">
                        {isEditing ? (
                            <div className="p-6">
                                <RiskForm
                                    onSubmit={handleUpdate}
                                    onCancel={() => setIsEditing(false)}
                                    initialData={selectedRisk}
                                    existingRisk={selectedRisk}
                                    assets={assets}
                                    usersList={usersList}
                                    processes={rawProcesses}
                                    suppliers={suppliers}
                                    controls={controls}
                                    isEditing={true}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="px-8 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-transparent">
                                    <ScrollableTabs
                                        tabs={[
                                            { id: 'details', label: 'Détails', icon: ShieldAlert },
                                            { id: 'treatment', label: 'Traitement', icon: CheckCircle2 },
                                            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                                            { id: 'projects', label: 'Projets', icon: FolderKanban },
                                            { id: 'audits', label: 'Audits', icon: CheckCircle2 },
                                            { id: 'history', label: 'Historique', icon: History },
                                            { id: 'comments', label: 'Discussion', icon: MessageSquare },
                                            { id: 'graph', label: 'Graphe', icon: Network },
                                            { id: 'threats', label: 'Menaces', icon: ShieldAlert }
                                        ]}
                                        activeTab={inspectorTab}
                                        onTabChange={(id) => setInspectorTab(id as typeof inspectorTab)}
                                    />
                                </div>

                                <div className="p-8 space-y-8">
                                    {inspectorTab === 'details' && (
                                        <div className="space-y-8">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="p-6 bg-red-50/80 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30 shadow-sm">
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-red-600/80 mb-4">Risque Brut</h4>
                                                    <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">{selectedRisk.score}</div>
                                                    <div className="text-xs font-medium text-slate-500">Prob: {selectedRisk.probability} × Impact: {selectedRisk.impact}</div>
                                                </div>
                                                <div className="p-6 bg-emerald-50/80 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-600/80 mb-4">Risque Résiduel</h4>
                                                    <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">{selectedRisk.residualScore || selectedRisk.score}</div>
                                                    <div className="text-xs font-medium text-slate-500">Prob: {selectedRisk.residualProbability || selectedRisk.probability} × Impact: {selectedRisk.residualImpact || selectedRisk.impact}</div>
                                                </div>
                                            </div>

                                            <RiskAIAssistant
                                                risk={selectedRisk}
                                                onUpdate={(updates) => handleUpdate({ ...selectedRisk, ...updates } as unknown as RiskFormData)}
                                            />

                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Stratégie de Traitement</h4>
                                                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 text-sm font-medium text-slate-700 dark:text-slate-200">{selectedRisk.strategy}</div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Propriétaire</h4>
                                                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 text-sm font-medium text-slate-700 dark:text-slate-200">{selectedRisk.owner || 'Non assigné'}</div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Statut Actuel</h4>
                                                <div className="flex justify-between items-center">
                                                    {canEdit ? (
                                                        <div className="flex gap-3">
                                                            {['Ouvert', 'En cours', 'Fermé'].map(s => (
                                                                <button key={s} onClick={() => handleStatusChange(selectedRisk, s as Risk['status'])} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${selectedRisk.status === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-md' : 'bg-transparent border-gray-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-gray-50'}`}>{s}</button>
                                                            ))}
                                                        </div>
                                                    ) : <span className="px-4 py-2 bg-gray-100 dark:bg-slate-700 rounded-xl text-sm font-bold">{selectedRisk.status}</span>}
                                                    {canEdit && (<button onClick={handleReview} className="flex items-center px-4 py-2 text-xs font-bold bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors"><CalendarDays className="h-3.5 w-3.5 mr-2" /> Valider la revue</button>)}
                                                </div>
                                                {selectedRisk.lastReviewDate && (<p className="text-xs text-slate-400 mt-3 text-right">Dernière revue le : {new Date(selectedRisk.lastReviewDate).toLocaleDateString()}</p>)}
                                            </div>
                                        </div>
                                    )}

                                    {inspectorTab === 'treatment' && (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Mesures de sécurité (Contrôles ISO)</h3>
                                                <span className="text-xs font-medium bg-brand-50 dark:bg-brand-900/20 text-brand-600 px-2.5 py-1 rounded-full">{selectedRisk.mitigationControlIds?.length || 0} mesures</span>
                                            </div>

                                            <div className="space-y-4">
                                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Stratégie de traitement</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {['Accepter', 'Atténuer', 'Transférer', 'Éviter'].map(s => (
                                                        <button
                                                            key={s}
                                                            type="button"
                                                            onClick={() => handleStrategyChange(selectedRisk, s as Risk['strategy'])}
                                                            className={`
                                                        px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200
                                                        ${selectedRisk.strategy === s
                                                                    ? 'bg-brand-500 text-white border-brand-500 shadow-lg shadow-brand-500/20'
                                                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand-500/50 hover:bg-brand-50 dark:hover:bg-brand-900/10'}
                                                    `}
                                                        >
                                                            {s}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* SLA & Treatment Plan Details */}
                                            {selectedRisk.strategy !== 'Accepter' && (
                                                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm space-y-6">
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center"><Clock className="h-4 w-4 mr-2" /> Plan de Traitement (SLA)</h4>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Échéance (Due Date)</label>
                                                            <input
                                                                type="date"
                                                                className="w-full px-4 py-3 rounded-xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm"
                                                                value={selectedRisk.treatment?.dueDate || ''}
                                                                onChange={async (e) => {
                                                                    if (!canEdit) return;
                                                                    const newDate = e.target.value;
                                                                    const treatment = { ...selectedRisk.treatment, dueDate: newDate };

                                                                    // Calculate SLA Status
                                                                    let slaStatus: 'On Track' | 'At Risk' | 'Breached' = 'On Track';
                                                                    if (newDate) {
                                                                        const due = new Date(newDate);
                                                                        const now = new Date();
                                                                        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                                                                        if (diffDays < 0) slaStatus = 'Breached';
                                                                        else if (diffDays < 7) slaStatus = 'At Risk';
                                                                    }
                                                                    treatment.slaStatus = slaStatus;

                                                                    try {
                                                                        await updateDoc(doc(db, 'risks', selectedRisk.id), { treatment });
                                                                        setSelectedRisk({ ...selectedRisk, treatment });
                                                                        refreshRisks();
                                                                        addToast("Échéance mise à jour", "success");
                                                                    } catch (err) { ErrorLogger.handleErrorWithToast(err, 'Risks.updateDueDate', 'UPDATE_FAILED'); }
                                                                }}
                                                                disabled={!canEdit}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Responsable du traitement</label>
                                                            <CustomSelect
                                                                options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                                                                value={selectedRisk.treatment?.ownerId || ''}
                                                                onChange={async (val) => {
                                                                    if (!canEdit) return;
                                                                    const treatment = { ...selectedRisk.treatment, ownerId: val as string };
                                                                    try {
                                                                        await updateDoc(doc(db, 'risks', selectedRisk.id), { treatment });
                                                                        setSelectedRisk({ ...selectedRisk, treatment });
                                                                        refreshRisks();
                                                                        addToast("Responsable mis à jour", "success");
                                                                    } catch (err) { ErrorLogger.handleErrorWithToast(err, 'Risks.updateOwner', 'UPDATE_FAILED'); }
                                                                }}
                                                                placeholder="Sélectionner un responsable..."
                                                                disabled={!canEdit}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Avancement</label>
                                                        <div className="flex items-center gap-4">
                                                            <select
                                                                className="flex-1 px-4 py-3 rounded-xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm appearance-none"
                                                                value={selectedRisk.treatment?.status || 'Planifié'}
                                                                onChange={async (e) => {
                                                                    if (!canEdit) return;
                                                                    const newStatus = e.target.value as RiskTreatment['status'];
                                                                    const treatment = {
                                                                        ...selectedRisk.treatment,
                                                                        status: newStatus,
                                                                        completedDate: newStatus === 'Terminé' ? new Date().toISOString() : undefined
                                                                    };
                                                                    try {
                                                                        await updateDoc(doc(db, 'risks', selectedRisk.id), { treatment });
                                                                        setSelectedRisk({ ...selectedRisk, treatment });
                                                                        refreshRisks();
                                                                        addToast("Statut d'avancement mis à jour", "success");
                                                                    } catch (err) { ErrorLogger.handleErrorWithToast(err, 'Risks.updateTreatmentStatus', 'UPDATE_FAILED'); }
                                                                }}
                                                                disabled={!canEdit}
                                                            >
                                                                <option value="Planifié">Planifié</option>
                                                                <option value="En cours">En cours</option>
                                                                <option value="Terminé">Terminé</option>
                                                                <option value="Retard">Retard</option>
                                                            </select>

                                                            {/* SLA Badge */}
                                                            {selectedRisk.treatment?.slaStatus && selectedRisk.treatment.status !== 'Terminé' && (
                                                                <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border ${selectedRisk.treatment.slaStatus === 'Breached' ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400' :
                                                                    selectedRisk.treatment.slaStatus === 'At Risk' ? 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400' :
                                                                        'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400'
                                                                    }`}>
                                                                    SLA: {selectedRisk.treatment.slaStatus}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Affected Processes Section */}
                                            <div className="space-y-4">
                                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Processus Impactés</label>
                                                <CustomSelect
                                                    options={rawProcesses.map(p => ({ value: p.id, label: p.name, subLabel: `RTO: ${p.rto}` }))}
                                                    value={selectedRisk.affectedProcessIds || []}
                                                    onChange={async (val) => {
                                                        if (!selectedRisk || !canEdit) return;
                                                        const newIds = Array.isArray(val) ? val : [val];
                                                        try {
                                                            await updateDoc(doc(db, 'risks', selectedRisk.id), { affectedProcessIds: newIds });
                                                            setSelectedRisk({ ...selectedRisk, affectedProcessIds: newIds });
                                                            refreshRisks();
                                                            addToast("Processus mis à jour", "success");
                                                        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Risks.updateProcesses', 'UPDATE_FAILED'); }
                                                    }}
                                                    placeholder="Sélectionner les processus impactés..."
                                                    multiple
                                                    disabled={!canEdit}
                                                />
                                            </div>

                                            {/* Related Suppliers Section (Combined Direct & Reverse) */}
                                            <div className="space-y-4">
                                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Fournisseurs Concernés</label>
                                                <CustomSelect
                                                    options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.category }))}
                                                    value={selectedRisk.relatedSupplierIds || []}
                                                    onChange={async (val) => {
                                                        if (!selectedRisk || !canEdit) return;
                                                        const newIds = Array.isArray(val) ? val : [val];
                                                        try {
                                                            await updateDoc(doc(db, 'risks', selectedRisk.id), { relatedSupplierIds: newIds });
                                                            setSelectedRisk({ ...selectedRisk, relatedSupplierIds: newIds });
                                                            refreshRisks();
                                                            addToast("Fournisseurs mis à jour", "success");
                                                        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Risks.updateSuppliers', 'UPDATE_FAILED'); }
                                                    }}
                                                    placeholder="Sélectionner les fournisseurs concernés..."
                                                    multiple
                                                    disabled={!canEdit}
                                                />

                                                {/* Display Reverse Linked Suppliers (if any are not already in direct links) */}
                                                {(() => {
                                                    const directIds = selectedRisk.relatedSupplierIds || [];
                                                    const reverseLinked = suppliers.filter(s => s.relatedRiskIds?.includes(selectedRisk.id) && !directIds.includes(s.id));

                                                    if (reverseLinked.length > 0) {
                                                        return (
                                                            <div className="mt-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                                                <h5 className="text-xs font-bold uppercase text-slate-400 mb-2">Liés depuis la fiche Fournisseur</h5>
                                                                <div className="space-y-2">
                                                                    {reverseLinked.map(s => (
                                                                        <div key={s.id} className="flex justify-between items-center">
                                                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.name}</span>
                                                                            <span className="text-xs text-slate-500">{s.category}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>

                                            {selectedRisk.mitigationControlIds && selectedRisk.mitigationControlIds.length > 0 ? (
                                                <div className="space-y-3">
                                                    {selectedRisk.mitigationControlIds.map(cid => {
                                                        const ctrl = controls.find(c => c.id === cid);
                                                        return ctrl ? (
                                                            <div key={cid} className="flex items-start p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all">
                                                                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-xl mr-4 text-green-600"><CheckCircle2 className="h-5 w-5" /></div>
                                                                <div>
                                                                    <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">{ctrl.code}</div>
                                                                    <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{ctrl.name}</div>
                                                                </div>
                                                            </div>
                                                        ) : null;
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-center py-12 text-gray-400 bg-white dark:bg-slate-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
                                                    <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                                    Aucun contrôle d'atténuation lié.
                                                </div>
                                            )}
                                        </div>

                                    )}

                                    {inspectorTab === 'dashboard' && (
                                        <div className="space-y-6">
                                            <RiskDashboard risks={[selectedRisk]} />
                                        </div>
                                    )}

                                    {inspectorTab === 'projects' && (
                                        <div className="space-y-8">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center"><FolderKanban className="h-4 w-4 mr-2" /> Projets de Traitement ({linkedProjects.length})</h3>
                                            {linkedProjects.length === 0 ? (
                                                <p className="text-sm text-gray-400 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun projet associé à ce risque.</p>
                                            ) : (
                                                <div className="grid gap-4">
                                                    {linkedProjects.map(proj => (
                                                        <div key={proj.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{proj.name}</span>
                                                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${proj.status === 'En cours' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{proj.status}</span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{proj.description}</p>
                                                            <div className="flex items-center justify-between">
                                                                <div className="w-full bg-slate-200 rounded-full h-1.5 mr-4 max-w-[100px]">
                                                                    <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${proj.progress}%` }}></div>
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{proj.progress}%</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {inspectorTab === 'audits' && (
                                        <div className="space-y-8">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center"><CheckCircle2 className="h-4 w-4 mr-2" /> Audits Liés ({linkedAudits.length})</h3>
                                            {linkedAudits.length === 0 ? (
                                                <p className="text-sm text-gray-400 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun audit associé à ce risque.</p>
                                            ) : (
                                                <div className="grid gap-4">
                                                    {linkedAudits.map(audit => (
                                                        <div key={audit.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{audit.name}</span>
                                                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${audit.status === 'Terminé' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{audit.status}</span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Auditeur: {audit.auditor}</p>
                                                            <div className="flex items-center text-xs text-slate-500">
                                                                <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                                                                {new Date(audit.dateScheduled).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {inspectorTab === 'graph' && (
                                        <div className="h-[500px]">
                                            <RelationshipGraph rootId={selectedRisk.id} rootType="Risk" />
                                        </div>
                                    )}

                                    {inspectorTab === 'history' && (
                                        <div className="space-y-8">
                                            <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Évolution du Score</h4>
                                                {riskScoreHistory.length === 0 ? <p className="text-sm text-gray-400 italic">Aucun changement de score enregistré.</p> : riskScoreHistory.map((h, i) => (
                                                    <div key={i} className="relative">
                                                        <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-900">
                                                            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                                        </span>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{new Date(h.date).toLocaleString()}</span>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-sm font-bold text-slate-500">Score:</span>
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{h.previousScore} ➔ {h.newScore}</span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Par: {h.changedBy}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Journal d'Audit</h4>
                                                {riskHistory.map((log, i) => (
                                                    <div key={i} className="relative">
                                                        <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-brand-100 dark:border-brand-900">
                                                            <div className="h-2 w-2 rounded-full bg-brand-500"></div>
                                                        </span>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                                            <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.details}</p>
                                                            <div className="mt-2 inline-flex items-center px-2 py-1 rounded-lg bg-gray-50 dark:bg-white/5 text-[10px] font-medium text-gray-500">{log.userEmail}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {inspectorTab === 'comments' && (
                                        <div className="h-full flex flex-col">
                                            <Comments collectionName="risks" documentId={selectedRisk.id} />
                                        </div>
                                    )}

                                    {inspectorTab === 'threats' && (
                                        <div className="space-y-6">
                                            {/* Linked Techniques */}
                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center">
                                                    Techniques Liées ({selectedRisk.mitreTechniques?.length || 0})
                                                </h3>
                                                {!selectedRisk.mitreTechniques || selectedRisk.mitreTechniques.length === 0 ? (
                                                    <p className="text-sm text-slate-400 italic">Aucune technique liée.</p>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {selectedRisk.mitreTechniques.map((tech) => (
                                                            <div key={tech.id} className="flex justify-between items-start p-3 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5">
                                                                <div>
                                                                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                                                                        {tech.name} <span className="text-slate-400 font-mono text-xs ml-2">({tech.id})</span>
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{tech.description}</p>
                                                                </div>
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!canEdit) return;
                                                                        const updatedTechniques = selectedRisk.mitreTechniques?.filter(t => t.id !== tech.id) || [];
                                                                        try {
                                                                            await updateDoc(doc(db, 'risks', selectedRisk.id), { mitreTechniques: updatedTechniques });
                                                                            setSelectedRisk({ ...selectedRisk, mitreTechniques: updatedTechniques });
                                                                            refreshRisks();
                                                                            addToast("Technique retirée", "success");
                                                                        } catch (err) { ErrorLogger.handleErrorWithToast(err, 'Risks.removeMitreTechnique'); }
                                                                    }}
                                                                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                                                    title="Retirer"
                                                                    disabled={!canEdit}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Search & Add */}
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5">
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                                                    <ShieldAlert className="w-5 h-5 mr-2 text-red-500" />
                                                    Rechercher MITRE ATT&CK
                                                </h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                                                    Recherchez des techniques pour les lier à ce risque.
                                                </p>

                                                <div className="flex gap-2 mb-6">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type="text"
                                                            placeholder="Rechercher une technique (ex: Phishing, T1566)..."
                                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 focus:ring-2 focus:ring-brand-500 outline-none"
                                                            value={mitreQuery}
                                                            onChange={(e) => setMitreQuery(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && integrationService.getMitreTechniques(mitreQuery).then(setMitreResults)}
                                                        />
                                                        <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                                                    </div>
                                                    <button
                                                        onClick={() => integrationService.getMitreTechniques(mitreQuery).then(setMitreResults)}
                                                        className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity"
                                                    >
                                                        Rechercher
                                                    </button>
                                                </div>

                                                <div className="space-y-4">
                                                    {mitreResults.length > 0 ? (
                                                        mitreResults.map((technique) => {
                                                            const isLinked = selectedRisk.mitreTechniques?.some(t => t.id === technique.id);
                                                            return (
                                                                <div key={technique.id} className="p-4 bg-white dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5 hover:border-brand-500 dark:hover:border-brand-500 transition-colors group">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-brand-500 transition-colors">
                                                                            {technique.name} <span className="text-slate-400 font-mono text-xs ml-2">({technique.id})</span>
                                                                        </h4>
                                                                        <button
                                                                            onClick={async () => {
                                                                                if (!canEdit || isLinked) return;
                                                                                const currentTechniques = selectedRisk.mitreTechniques || [];
                                                                                const updatedTechniques = [...currentTechniques, technique];
                                                                                try {
                                                                                    await updateDoc(doc(db, 'risks', selectedRisk.id), { mitreTechniques: updatedTechniques });
                                                                                    setSelectedRisk({ ...selectedRisk, mitreTechniques: updatedTechniques });
                                                                                    refreshRisks();
                                                                                    addToast("Technique ajoutée", "success");
                                                                                } catch (err) { ErrorLogger.handleErrorWithToast(err, 'Risks.addMitreTechnique'); }
                                                                            }}
                                                                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${isLinked
                                                                                    ? 'bg-green-100 text-green-700 cursor-default'
                                                                                    : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm hover:shadow'
                                                                                }`}
                                                                            disabled={!canEdit || isLinked}
                                                                        >
                                                                            {isLinked ? 'Lié' : 'Ajouter'}
                                                                        </button>
                                                                    </div>
                                                                    <p className="text-sm text-slate-500 dark:text-slate-400">{technique.description}</p>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="text-center py-8 text-slate-400 italic">
                                                            Aucun résultat. Essayez de rechercher "Phishing" ou "Exploit".
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )
                }
            </Drawer >
        </div >
    );
};
