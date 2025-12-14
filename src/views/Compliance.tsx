import React, { useEffect, useState, useMemo } from 'react';
// import { Helmet } from 'react-helmet-async'; // Replaced by SEO component
import { SlideUp } from '../components/ui/Animations'; // Added Layout Animations
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, writeBatch, arrayUnion, query, where, limit, addDoc } from 'firebase/firestore';
import { RiskFormData, riskSchema } from '../schemas/riskSchema';
import { ProjectFormData } from '../schemas/projectSchema';
import { AuditFormData } from '../schemas/auditSchema';
import { db } from '../firebase';
import { toast } from 'sonner';
import { analyticsService } from '../services/analyticsService';
import { Control, Document, Risk, Finding, UserProfile, SystemLog, Asset, Supplier, Project, Audit, BusinessProcess, AutomatedEvidence, Framework } from '../types';
import { FileText, AlertTriangle, Download, Paperclip, Link, ExternalLink, ShieldAlert, AlertOctagon, Search, X, Save, File, ShieldCheck, Plus, ChevronRight, Filter, ChevronDown, User, FolderKanban, FileSpreadsheet, RefreshCw, Loader2, CheckCircle2, XCircle, Plug, MessageSquare } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { Skeleton } from '../components/ui/Skeleton';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ComplianceDashboard } from '../components/compliance/ComplianceDashboard';
import { ComplianceAIAssistant } from '../components/compliance/ComplianceAIAssistant';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorLogger } from '../services/errorLogger';
import { Drawer } from '../components/ui/Drawer';
import { getPlanLimits } from '../config/plans';
import { Comments } from '../components/ui/Comments';
import { CustomSelect } from '../components/ui/CustomSelect';
import { NotificationService } from '../services/notificationService';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { RiskForm } from '../components/risks/RiskForm';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { AuditForm } from '../components/audits/AuditForm';
import { ProjectForm } from '../components/projects/ProjectForm';
import { sanitizeData } from '../utils/dataSanitizer';


import { ISO_DOMAINS, ISO_SEED_CONTROLS, NIS2_DOMAINS, NIS2_SEED_CONTROLS, DORA_DOMAINS, DORA_SEED_CONTROLS, GDPR_DOMAINS, GDPR_SEED_CONTROLS, SOC2_DOMAINS, SOC2_SEED_CONTROLS, HDS_DOMAINS, HDS_SEED_CONTROLS, PCI_DSS_DOMAINS, PCI_DSS_SEED_CONTROLS, NIST_CSF_DOMAINS, NIST_CSF_SEED_CONTROLS, ISO22301_DOMAINS, ISO22301_SEED_CONTROLS } from '../data/complianceData';
import { FRAMEWORKS } from '../data/frameworks';
import { integrationService, IntegrationProvider } from '../services/integrationService';
import { Globe } from '../components/ui/Icons';






import { canEditResource, hasPermission } from '../utils/permissions';

import { SEO } from '../components/SEO';

export const Compliance: React.FC = () => {
    const { user, addToast, organization, demoMode } = useStore();
    const navigate = useNavigate();

    const canEdit = canEditResource(user, 'Control');

    // UI State
    const [selectedControl, setSelectedControl] = useState<Control | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [inspectorTab, setInspectorTab] = useState<'details' | 'evidence' | 'comments' | 'history' | 'linkedItems'>('details');
    const [controlHistory, setControlHistory] = useState<SystemLog[]>([]);

    const [editJustification, setEditJustification] = useState('');
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [showMissingEvidence, setShowMissingEvidence] = useState(false);
    const [currentFramework, setCurrentFramework] = useState<Framework>('ISO27001');
    const [expandedDomains, setExpandedDomains] = useState<string[]>([]); // Default empty, open first on load

    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    // Creation Mode State
    const [creationMode, setCreationMode] = useState<'risk' | 'project' | 'audit' | null>(null);
    const [modalInitialData, setModalInitialData] = useState<Partial<Risk> | Partial<Project> | Partial<Audit> | null>(null);
    const [viewMode, setViewMode] = useState<'compliance' | 'watch'>('compliance');

    // EUR-Lex State
    const [eurLexQuery, setEurLexQuery] = useState('');
    const [eurLexResult, setEurLexResult] = useState<string | null>(null);
    const [isSearchingEurLex, setIsSearchingEurLex] = useState(false);

    // Automated Evidence State
    const [providers, setProviders] = useState<IntegrationProvider[]>([]);
    const [loadingProviders, setLoadingProviders] = useState(false);
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    const [selectedResourceId, setSelectedResourceId] = useState<string>('');
    const [isLinkingEvidence, setIsLinkingEvidence] = useState(false);
    const [syncingEvidenceId, setSyncingEvidenceId] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);

    // Linking State
    const [linkingToProjectId, setLinkingToProjectId] = useState<string | null>(null);
    const [linkingToProjectName, setLinkingToProjectName] = useState<string | null>(null);
    const location = useLocation();

    // Filter FRAMEWORKS for Compliance only
    const complianceFrameworks = FRAMEWORKS.filter(f => f.type === 'Compliance').map(f => ({ value: f.id, label: f.label }));

    // ... (rest of imports/logic until the return) ...
    // Note: I will only replace the top section to add import and the render section to fix width and usage.
    // I need to split this into two replacements or one big one if I copy enough context.
    // Actually, I can just replace the import and then the render. 
    // First tool call: Import


    useEffect(() => {
        const state = (location.state || {}) as { createForProject?: string; projectName?: string };
        if (state.createForProject) {
            setLinkingToProjectId(state.createForProject);
            setLinkingToProjectName(state.projectName || 'Projet');
            addToast(`Mode liaison actif: Sélectionnez un contrôle pour le lier au projet ${state.projectName || ''}`, 'info');
        }
    }, [location.state, addToast]);

    useEffect(() => {
        const loadProviders = async () => {
            setLoadingProviders(true);
            try {
                const data = await integrationService.getProviders();
                setProviders(data.filter(p => p.status === 'connected'));
            } catch (error) {
                ErrorLogger.error(error, 'Compliance.loadProviders');
            } finally {
                setLoadingProviders(false);
            }
        };
        if (isDrawerOpen) {
            loadProviders();
        }
    }, [isDrawerOpen]);

    // Safe Constraints
    const orgId = user?.organizationId;
    const orgConstraints = useMemo(() => {
        return orgId ? [where('organizationId', '==', orgId)] : [];
    }, [orgId]);

    // Data Fetching with Hooks
    const { data: rawControls, loading: controlsLoading, refresh: refreshControls } = useFirestoreCollection<Control>(
        'controls',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: documents, loading: docsLoading } = useFirestoreCollection<Document>(
        'documents',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: risks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: findings, loading: findingsLoading } = useFirestoreCollection<Finding>(
        'findings',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: usersList, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: assets, loading: assetsLoading } = useFirestoreCollection<Asset>(
        'assets',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: suppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>(
        'suppliers',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: projects, loading: projectsLoading } = useFirestoreCollection<Project>(
        'projects',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: audits, loading: auditsLoading } = useFirestoreCollection<Audit>(
        'audits',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: processes, loading: processesLoading } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const loading = controlsLoading || docsLoading || risksLoading || findingsLoading || usersLoading || assetsLoading || suppliersLoading || projectsLoading || auditsLoading || processesLoading;

    // Derived State and Seeding Logic
    const [controls, setControls] = useState<Control[]>([]);

    useEffect(() => {
        if (controlsLoading || !user?.organizationId) return;

        const seedData = async () => {
            const currentControls = rawControls.filter(c =>
                (c.framework === currentFramework) ||
                (!c.framework && currentFramework === 'ISO27001')
            );

            let seedControls: { code: string; name: string }[] = [];
            switch (currentFramework) {
                case 'ISO27001': seedControls = ISO_SEED_CONTROLS; break;
                case 'ISO22301': seedControls = ISO22301_SEED_CONTROLS; break;
                case 'NIS2': seedControls = NIS2_SEED_CONTROLS; break;
                case 'DORA': seedControls = DORA_SEED_CONTROLS; break;
                case 'GDPR': seedControls = GDPR_SEED_CONTROLS; break;
                case 'SOC2': seedControls = SOC2_SEED_CONTROLS; break;
                case 'HDS': seedControls = HDS_SEED_CONTROLS; break;
                case 'PCI_DSS': seedControls = PCI_DSS_SEED_CONTROLS; break;
                case 'NIST_CSF': seedControls = NIST_CSF_SEED_CONTROLS; break;
            }

            if (currentControls.length < seedControls.length) {
                const existingCodes = currentControls.map(d => d.code);
                const batch = writeBatch(db);
                let addedCount = 0;

                seedControls.forEach(c => {
                    if (!existingCodes.includes(c.code)) {
                        const docRef = doc(collection(db, 'controls'));
                        batch.set(docRef, {
                            organizationId: user.organizationId,
                            code: c.code,
                            name: c.name,
                            framework: currentFramework,
                            applicability: 'Applicable',
                            status: 'Non commencé',
                            lastUpdated: new Date().toISOString(),
                            evidenceIds: []
                        });
                        addedCount++;
                    }
                });

                if (addedCount > 0) {
                    await batch.commit();
                    refreshControls();
                    return; // Will re-run effect after refresh
                }
            }

            setControls(sortControls(currentControls));
        };

        seedData();
    }, [rawControls, currentFramework, user?.organizationId, controlsLoading, refreshControls]);

    // Open first domain by default
    useEffect(() => {
        let domains: { id: string }[] = [];
        switch (currentFramework) {
            case 'ISO27001': domains = ISO_DOMAINS; break;
            case 'ISO22301': domains = ISO22301_DOMAINS; break;
            case 'NIS2': domains = NIS2_DOMAINS; break;
            case 'DORA': domains = DORA_DOMAINS; break;
            case 'GDPR': domains = GDPR_DOMAINS; break;
            case 'SOC2': domains = SOC2_DOMAINS; break;
            case 'HDS': domains = HDS_DOMAINS; break;
            case 'PCI_DSS': domains = PCI_DSS_DOMAINS; break;
            case 'NIST_CSF': domains = NIST_CSF_DOMAINS; break;
        }

        if (domains.length > 0 && expandedDomains.length === 0) {
            setExpandedDomains([domains[0].id]);
        }
    }, [currentFramework, expandedDomains.length]);

    const sortControls = (data: Control[]) => {
        return [...data].sort((a, b) => {
            const partsA = a.code.split('.').map(Number);
            const partsB = b.code.split('.').map(Number);
            if (partsA[1] !== partsB[1]) return (partsA[1] || 0) - (partsB[1] || 0);
            return (partsA[2] || 0) - (partsB[2] || 0);
        });
    }

    const toggleDomain = (domainId: string) => {
        setExpandedDomains(prev => prev.includes(domainId) ? prev.filter(d => d !== domainId) : [...prev, domainId]);
    };

    const openInspector = async (control: Control) => {
        setSelectedControl(control);
        setEditJustification(control.justification || '');
        setIsDrawerOpen(true);
        setInspectorTab('details');

        // Fetch history
        try {
            const q = query(
                collection(db, 'system_logs'),
                where('organizationId', '==', user?.organizationId),
                where('resource', '==', 'Control'),
                limit(50)
            );
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => d.data() as SystemLog);
            // Filter client-side for specific control code/name matches since we don't store controlId in logs yet
            const relevantLogs = logs.filter(l => l.details?.includes(control.code));
            relevantLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setControlHistory(relevantLogs);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.fetchHistory', 'FETCH_FAILED');
        }
    };

    const handleAssign = async (assigneeId: string) => {
        if (!selectedControl || !user?.organizationId || !canEdit) return;
        setUpdating(true);
        try {
            await updateDoc(doc(db, 'controls', selectedControl.id), sanitizeData({ assigneeId }));

            // Notify assignee
            if (assigneeId) {
                await NotificationService.notifyControlAssigned(selectedControl, assigneeId);
            }

            // Log action
            const assignee = usersList.find(u => u.uid === assigneeId);
            await logAction(user, 'UPDATE', 'Control', `Contrôle ${selectedControl.code} assigné à ${assignee?.displayName || assignee?.email}`);

            // Update local state
            const updatedControl = { ...selectedControl, assigneeId };
            setSelectedControl(updatedControl);
            refreshControls();

            addToast("Assignation mise à jour", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleAssign', 'UPDATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const handleStatusChange = async (control: Control, newStatus: Control['status']) => {
        if (!user?.organizationId || !canEdit) return;
        setUpdating(true);
        try {
            const applicability: 'Applicable' | 'Non applicable' =
                (newStatus === 'Non applicable' || newStatus === 'Exclu') ? 'Non applicable' : 'Applicable';

            await updateDoc(doc(db, 'controls', control.id), sanitizeData({
                status: newStatus,
                applicability,
                lastUpdated: new Date().toISOString()
            }));
            await logAction(user, 'UPDATE', 'Control', `Statut ${control.code} changé à ${newStatus}`);

            const updatedControl = { ...control, status: newStatus, applicability, lastUpdated: new Date().toISOString() };
            if (selectedControl?.id === control.id) setSelectedControl(updatedControl);
            refreshControls();

            addToast("Statut mis à jour", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleStatusChange', 'UPDATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const handleJustificationSave = async () => {
        if (!selectedControl || !user?.organizationId || !canEdit) return;
        setUpdating(true);
        try {
            await updateDoc(doc(db, 'controls', selectedControl.id), sanitizeData({
                justification: editJustification,
                lastUpdated: new Date().toISOString()
            }));
            await logAction(user, 'UPDATE', 'Control', `Justification mise à jour pour ${selectedControl.code}`);

            const updatedControl = { ...selectedControl, justification: editJustification, lastUpdated: new Date().toISOString() };
            setSelectedControl(updatedControl);
            refreshControls();

            addToast("Justification enregistrée", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleJustificationSave', 'UPDATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const linkDocument = async (docId: string) => {
        if (!selectedControl || !canEdit) return;
        setUpdating(true);
        try {
            if (selectedControl.evidenceIds?.includes(docId)) return;
            await updateDoc(doc(db, 'controls', selectedControl.id), { evidenceIds: arrayUnion(docId) });
            const newEvidence = [...(selectedControl.evidenceIds || []), docId];
            refreshControls();
            setSelectedControl({ ...selectedControl, evidenceIds: newEvidence });
            await logAction(user, 'LINK', 'Compliance', `Preuve liée au contrôle ${selectedControl.code}`);
            addToast("Preuve ajoutée", "success");
        } catch (e) {
            ErrorLogger.error(e, 'Compliance.linkDocument');
            addToast("Erreur lors de la liaison", "error");
        } finally {
            setUpdating(false);
        }
    };

    const initiateUnlinkDocument = (docId: string) => {
        if (!selectedControl || !canEdit) return;
        setConfirmData({
            isOpen: true,
            title: "Retirer la preuve ?",
            message: "Ce document ne sera plus lié à ce contrôle.",
            onConfirm: () => unlinkDocument(docId)
        });
    };

    const unlinkDocument = async (docId: string) => {
        if (!selectedControl || !canEdit) return;
        setUpdating(true);
        try {
            const newEvidence = (selectedControl.evidenceIds || []).filter(id => id !== docId);
            await updateDoc(doc(db, 'controls', selectedControl.id), { evidenceIds: newEvidence });
            refreshControls();
            setSelectedControl({ ...selectedControl, evidenceIds: newEvidence });
            addToast("Preuve retirée", "info");
        } catch (e) {
            ErrorLogger.error(e, 'Compliance.unlinkDocument');
            addToast("Erreur suppression lien", "error");
        } finally {
            setUpdating(false);
        }
    };

    const handleLinkAsset = async (assetId: string) => {
        if (!selectedControl || !user?.organizationId || !canEdit) return;
        setUpdating(true);
        try {
            if (selectedControl.relatedAssetIds?.includes(assetId)) return;
            await updateDoc(doc(db, 'controls', selectedControl.id), { relatedAssetIds: arrayUnion(assetId) });
            const newAssets = [...(selectedControl.relatedAssetIds || []), assetId];
            refreshControls();
            setSelectedControl({ ...selectedControl, relatedAssetIds: newAssets });
            await logAction(user, 'LINK', 'Compliance', `Actif lié au contrôle ${selectedControl.code}`);
            addToast("Actif lié", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleLinkAsset', 'UPDATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const handleUnlinkAsset = async (assetId: string) => {
        if (!selectedControl || !user?.organizationId || !canEdit) return;
        setUpdating(true);
        try {
            const newAssets = (selectedControl.relatedAssetIds || []).filter(id => id !== assetId);
            await updateDoc(doc(db, 'controls', selectedControl.id), { relatedAssetIds: newAssets });
            refreshControls();
            setSelectedControl({ ...selectedControl, relatedAssetIds: newAssets });
            addToast("Lien actif retiré", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleUnlinkAsset', 'UPDATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const handleLinkSupplier = async (supplierId: string) => {
        if (!selectedControl || !user?.organizationId || !canEdit) return;
        setUpdating(true);
        try {
            if (selectedControl.relatedSupplierIds?.includes(supplierId)) return;
            await updateDoc(doc(db, 'controls', selectedControl.id), { relatedSupplierIds: arrayUnion(supplierId) });
            const newSuppliers = [...(selectedControl.relatedSupplierIds || []), supplierId];
            refreshControls();
            setSelectedControl({ ...selectedControl, relatedSupplierIds: newSuppliers });
            await logAction(user, 'LINK', 'Compliance', `Fournisseur lié au contrôle ${selectedControl.code}`);
            addToast("Fournisseur lié", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleLinkSupplier', 'UPDATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const handleUnlinkSupplier = async (supplierId: string) => {
        if (!selectedControl || !user?.organizationId || !canEdit) return;
        setUpdating(true);
        try {
            const newSuppliers = (selectedControl.relatedSupplierIds || []).filter(id => id !== supplierId);
            await updateDoc(doc(db, 'controls', selectedControl.id), { relatedSupplierIds: newSuppliers });
            refreshControls();
            setSelectedControl({ ...selectedControl, relatedSupplierIds: newSuppliers });
            addToast("Lien fournisseur retiré", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleUnlinkSupplier', 'UPDATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };


    const handleLinkRisk = async (riskId: string) => {
        if (!selectedControl || !user?.organizationId) return;
        setUpdating(true);
        try {
            const risk = risks.find(r => r.id === riskId);
            if (!risk) return;

            const newControlIds = [...(risk.mitigationControlIds || []), selectedControl.id];
            await updateDoc(doc(db, 'risks', riskId), { mitigationControlIds: newControlIds });
            await logAction(user, 'UPDATE', 'Control', `Lien risque ${risk.threat} -> Contrôle ${selectedControl.code}`);
            addToast("Risque lié", "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Compliance.handleLinkRisk', 'UPDATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const handleUnlinkRisk = async (riskId: string) => {
        if (!selectedControl || !user?.organizationId) return;
        setUpdating(true);
        try {
            const risk = risks.find(r => r.id === riskId);
            if (!risk) return;

            const newControlIds = (risk.mitigationControlIds || []).filter(id => id !== selectedControl.id);
            await updateDoc(doc(db, 'risks', riskId), { mitigationControlIds: newControlIds });

            await logAction(user, 'UPDATE', 'Control', `Délié risque ${risk.threat} de Contrôle ${selectedControl.code}`);
            addToast("Risque délié", "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Compliance.handleUnlinkRisk', 'UPDATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const handleCreateRisk = async (data: RiskFormData) => {
        if (!selectedControl || !user?.organizationId || !hasPermission(user, 'Risk', 'create')) return;
        setUpdating(true);
        try {
            const validatedData = riskSchema.parse(data);

            const probability = validatedData.probability;
            const impact = validatedData.impact;
            const residualProbability = validatedData.residualProbability ?? probability;
            const residualImpact = validatedData.residualImpact ?? impact;

            const score = probability * impact;
            const residualScore = residualProbability * residualImpact;

            if (residualScore > score) {
                addToast("Le score résiduel ne peut pas être supérieur au score brut. Ajustez la probabilité ou l'impact résiduel.", "error");
                return;
            }

            if (validatedData.strategy === 'Accepter' && residualScore >= 15 && !validatedData.justification?.trim()) {
                addToast("Pour accepter un risque critique (score résiduel >= 15), une justification détaillée est requise.", "error");
                return;
            }

            const nowIso = new Date().toISOString();

            await addDoc(collection(db, 'risks'), sanitizeData({
                ...validatedData,
                organizationId: user.organizationId,
                mitigationControlIds: [selectedControl.id],
                createdAt: nowIso,
                updatedAt: nowIso,
                status: 'Ouvert',
                score,
                residualScore,
                lastReviewDate: nowIso
            }));
            setCreationMode(null);
            addToast("Nouveau risque créé et lié", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleCreateRisk', 'CREATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const handleLinkProject = async (projectId: string) => {
        if (!selectedControl || !user?.organizationId || !canEditResource(user, 'Project')) return;
        setUpdating(true);
        try {
            await updateDoc(doc(db, 'projects', projectId), {
                relatedControlIds: arrayUnion(selectedControl.id)
            });
            // Bi-directional update
            await updateDoc(doc(db, 'controls', selectedControl.id), {
                relatedProjectIds: arrayUnion(projectId)
            });

            // Update local state
            const newProjects = [...(selectedControl.relatedProjectIds || []), projectId];
            setSelectedControl({ ...selectedControl, relatedProjectIds: newProjects });
            refreshControls();

            addToast("Projet lié avec succès", "success");

            if (projectId === linkingToProjectId) {
                setLinkingToProjectId(null);
                setLinkingToProjectName(null);
                addToast("Liaison terminée, retour au projet...", "success");
                setTimeout(() => navigate('/projects'), 1500);
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleLinkProject', 'UPDATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const handleCreateProject = async (data: ProjectFormData) => {
        if (!selectedControl || !user?.organizationId || !hasPermission(user, 'Project', 'create')) return;
        setUpdating(true);
        try {
            const docRef = await addDoc(collection(db, 'projects'), sanitizeData({
                ...data,
                organizationId: user.organizationId,
                relatedControlIds: [selectedControl.id],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'En cours'
            }));

            // Bi-directional update
            await updateDoc(doc(db, 'controls', selectedControl.id), {
                relatedProjectIds: arrayUnion(docRef.id)
            });
            // Update local state
            const newProjects = [...(selectedControl.relatedProjectIds || []), docRef.id];
            setSelectedControl({ ...selectedControl, relatedProjectIds: newProjects });
            refreshControls();

            setCreationMode(null);
            addToast("Nouveau projet créé et lié", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleCreateProject', 'CREATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const handleLinkAudit = async (auditId: string) => {
        if (!selectedControl || !user?.organizationId || !canEditResource(user, 'Audit')) return;
        setUpdating(true);
        try {
            await updateDoc(doc(db, 'audits', auditId), {
                relatedControlIds: arrayUnion(selectedControl.id)
            });
            addToast("Audit lié avec succès", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleLinkAudit', 'UPDATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const handleCreateAudit = async (data: AuditFormData) => {
        if (!selectedControl || !user?.organizationId || !hasPermission(user, 'Audit', 'create')) return;
        setUpdating(true);
        try {
            await addDoc(collection(db, 'audits'), sanitizeData({
                ...data,
                organizationId: user.organizationId,
                relatedControlIds: [selectedControl.id],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'Planifié'
            }));
            setCreationMode(null);
            addToast("Nouvel audit créé et lié", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleCreateAudit', 'CREATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const handleLinkAutomatedEvidence = async () => {
        if (!selectedControl || !selectedProviderId || !selectedResourceId || !canEdit) return;
        setIsLinkingEvidence(true);
        try {
            const provider = providers.find(p => p.id === selectedProviderId);
            if (!provider) return;

            const newEvidence: AutomatedEvidence = {
                id: crypto.randomUUID(),
                providerId: selectedProviderId,
                resourceType: 'check', // Mocked for now
                resourceId: selectedResourceId,
                status: 'pass', // Mocked initial status
                lastSync: new Date().toISOString(),
                details: `Automated check from ${provider.name}`
            };

            await updateDoc(doc(db, 'controls', selectedControl.id), {
                automatedEvidence: arrayUnion(newEvidence)
            });

            const updatedEvidence = [...(selectedControl.automatedEvidence || []), newEvidence];
            setSelectedControl({ ...selectedControl, automatedEvidence: updatedEvidence });
            refreshControls();

            await logAction(user, 'LINK', 'Compliance', `Preuve automatisée liée: ${provider.name}`);
            analyticsService.logEvent('link_evidence', {
                provider: provider.name,
                control_id: selectedControl.id
            });
            addToast("Preuve automatisée liée", "success");
            setSelectedProviderId('');
            setSelectedResourceId('');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleLinkAutomatedEvidence', 'UPDATE_FAILED');
        } finally {
            setIsLinkingEvidence(false);
        }
    };



    const handleUnlinkAutomatedEvidence = async (evidenceId: string) => {
        if (!selectedControl || !canEdit) return;
        setUpdating(true);
        try {
            const evidenceToRemove = selectedControl.automatedEvidence?.find(e => e.id === evidenceId);
            if (!evidenceToRemove) return;

            // Correct approach for object array removal in Firestore is usually reading and writing back the filtered array
            // But since we have selectedControl, we can just filter and set.
            const updatedEvidence = (selectedControl.automatedEvidence || []).filter(e => e.id !== evidenceId);
            await updateDoc(doc(db, 'controls', selectedControl.id), sanitizeData({
                automatedEvidence: updatedEvidence
            }));

            setSelectedControl({ ...selectedControl, automatedEvidence: updatedEvidence });
            refreshControls();
            addToast("Preuve automatisée retirée", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleUnlinkAutomatedEvidence', 'UPDATE_FAILED');
        } finally {
            setUpdating(false);
        }
    };

    const handleSyncEvidence = async (evidence: AutomatedEvidence) => {
        if (!selectedControl || !user?.organizationId) return;
        setSyncingEvidenceId(evidence.id);
        const toastId = toast.loading("Synchronisation...");
        try {
            const result = await integrationService.fetchEvidence(evidence.providerId, evidence.resourceId, user.organizationId, demoMode);

            const updatedEvidenceItem = {
                ...evidence,
                lastSync: result.lastSync,
                status: result.status as 'pass' | 'fail' | 'error',
                details: result.details
            } as AutomatedEvidence;

            const updatedEvidenceList = (selectedControl.automatedEvidence || []).map(e =>
                e.id === evidence.id ? updatedEvidenceItem : e
            );

            await updateDoc(doc(db, 'controls', selectedControl.id), sanitizeData({
                automatedEvidence: updatedEvidenceList
            }));

            setSelectedControl({ ...selectedControl, automatedEvidence: updatedEvidenceList });
            refreshControls();
            toast.success("Synchronisation réussie", { id: toastId });
        } catch {
            toast.error("Erreur de synchronisation", { id: toastId });
        } finally {
            setSyncingEvidenceId(null);
        }
    };

    const handleEurLexSearch = async () => {
        if (!eurLexQuery) return;
        setIsSearchingEurLex(true);
        const toastId = toast.loading("Recherche EUR-Lex en cours...");
        try {
            const result = await integrationService.searchEurLex(eurLexQuery, demoMode);
            setEurLexResult(result);
            toast.dismiss(toastId);
        } catch {
            toast.error("Erreur lors de la recherche EUR-Lex", { id: toastId });
        } finally {
            setIsSearchingEurLex(false);
        }
    };

    // ... rest of the file
    const getDomainStats = (prefix: string) => {
        const domainControls = controls.filter(c => c.code.startsWith(prefix));
        const total = domainControls.length;
        const implemented = domainControls.filter(c => c.status === 'Implémenté').length;
        const partial = domainControls.filter(c => c.status === 'Partiel').length;
        return { total, implemented, partial, progress: total > 0 ? Math.round(((implemented + (partial * 0.5)) / total) * 100) : 0 };
    };

    const generateSoAReport = () => {
        void (async () => {
            const { PdfService } = await import('../services/PdfService');

            const data = controls.map(c => {
                const applicability = c.applicability || ((c.status === 'Non applicable' || c.status === 'Exclu') ? 'Non applicable' : 'Applicable');
                const justification = c.justification || ((c.status === 'Exclu' || applicability === 'Non applicable') ? 'Non justifié' : '-');
                return [c.code, c.name, applicability, c.status, justification];
            });

            const limits = getPlanLimits(organization?.subscription?.planId || 'discovery');
            const canWhiteLabel = limits.features.whiteLabelReports;

            PdfService.generateTableReport(
                {
                    title: `Déclaration d'Applicabilité (SoA) - ${currentFramework}`,
                    subtitle: `${currentFramework} | Généré le ${new Date().toLocaleDateString()} | ${user?.organizationName || 'Organisation'}`,
                    filename: `SoA_${currentFramework}_${new Date().toISOString().split('T')[0]}.pdf`,
                    headerText: `${currentFramework} Compliance Report`,
                    footerText: 'Sentinel GRC by Cyber Threat Consulting - Document Confidentiel',
                    organizationName: canWhiteLabel ? organization?.name : undefined,
                    organizationLogo: canWhiteLabel ? organization?.logoUrl : undefined
                },
                ['Code', 'Contrôle', 'Applicabilité', 'Statut', 'Justification / Commentaire'],
                data,
                {
                    0: { fontStyle: 'bold', cellWidth: 20 },
                    1: { cellWidth: 50 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 30 },
                    4: { cellWidth: 'auto' }
                }
            );
        })().catch((error) => {
            ErrorLogger.error(error, 'Compliance.generateSoAReport');
            addToast("Erreur lors de l'export PDF", 'error');
        });
    };

    const filteredControls = controls.filter(c => {
        const code = c.code?.toLowerCase() || '';
        const name = c.name?.toLowerCase() || '';
        const searchLower = filter.toLowerCase();

        const matchesSearch = code.includes(searchLower) || name.includes(searchLower);
        const matchesMissing = showMissingEvidence ? (c.status === 'Implémenté' && (!c.evidenceIds || c.evidenceIds.length === 0)) : true;
        const matchesStatus = statusFilter ? c.status === statusFilter : true;
        return matchesSearch && matchesMissing && matchesStatus;
    });

    const getBreadcrumbs = () => {
        const crumbs: { label: string; onClick?: () => void }[] = [{ label: 'Conformité', onClick: () => { setIsDrawerOpen(false); setCreationMode(null); } }];

        if (creationMode) {
            crumbs.push({ label: 'Création' });
            return crumbs;
        }

        if (selectedControl) {
            crumbs.push({ label: currentFramework, onClick: () => { setIsDrawerOpen(false); } });

            const domains = currentFramework === 'ISO27001' ? ISO_DOMAINS :
                currentFramework === 'ISO22301' ? ISO22301_DOMAINS :
                    currentFramework === 'NIS2' ? NIS2_DOMAINS :
                        currentFramework === 'DORA' ? DORA_DOMAINS :
                            currentFramework === 'GDPR' ? GDPR_DOMAINS :
                                currentFramework === 'SOC2' ? SOC2_DOMAINS :
                                    currentFramework === 'HDS' ? HDS_DOMAINS :
                                        currentFramework === 'PCI_DSS' ? PCI_DSS_DOMAINS :
                                            NIST_CSF_DOMAINS;

            const domain = domains.find(d => selectedControl.code.startsWith(d.id));
            if (domain) {
                crumbs.push({ label: domain.title.length > 30 ? domain.title.substring(0, 30) + '...' : domain.title });
            }

            crumbs.push({ label: selectedControl.code });
        }

        return crumbs;
    };

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <div className="space-y-8 animate-fade-in pb-10 relative px-4 sm:px-6 lg:px-8 w-full">
            <SEO
                title={selectedControl ? `${selectedControl.code} - Conformité` : 'Conformité & Standards'}
                description="Suivez votre conformité aux normes ISO 27001, NIS 2, DORA et gérez vos audits."
                keywords="Conformité, Audit, ISO 27001, NIS 2, DORA, Réglementation, Preuves, Contrôles"
            />
            {/* Confirm Modal */}
            <ConfirmModal isOpen={confirmData.isOpen} onClose={() => setConfirmData({ ...confirmData, isOpen: false })} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} />

            <SlideUp>
                <PageHeader
                    title={
                        currentFramework === 'ISO27001' ? "Déclaration d'Applicabilité" :
                            currentFramework === 'ISO22301' ? "Continuité d'Activité" :
                                currentFramework === 'NIS2' ? "Conformité NIS2" :
                                    currentFramework === 'DORA' ? "Conformité DORA" :
                                        currentFramework === 'GDPR' ? "Conformité RGPD" :
                                            currentFramework === 'SOC2' ? "Conformité SOC 2" :
                                                currentFramework === 'HDS' ? "Conformité HDS" :
                                                    currentFramework === 'PCI_DSS' ? "Conformité PCI DSS" :
                                                        "Conformité NIST CSF"
                    }
                    subtitle={
                        currentFramework === 'ISO27001' ? "Pilotage de la conformité ISO 27001:2022." :
                            currentFramework === 'ISO22301' ? "Système de Management de la Continuité d'Activité (SMCA)." :
                                currentFramework === 'NIS2' ? "Suivi de la directive NIS2." :
                                    currentFramework === 'DORA' ? "Règlement sur la résilience opérationnelle numérique." :
                                        currentFramework === 'GDPR' ? "Règlement Général sur la Protection des Données." :
                                            currentFramework === 'SOC2' ? "Service Organization Control 2." :
                                                currentFramework === 'HDS' ? "Hébergement de Données de Santé." :
                                                    currentFramework === 'PCI_DSS' ? "Payment Card Industry Data Security Standard." :
                                                        "NIST Cybersecurity Framework 2.0."
                    }
                    breadcrumbs={[
                        { label: 'Conformité' }
                    ]}
                    icon={<ShieldCheck className="h-6 w-6 text-white" strokeWidth={2.5} />}
                    trustType="general"
                    actions={
                        <div className="flex flex-wrap items-center gap-3">
                            {/* View Switcher */}
                            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center border border-slate-200 dark:border-white/10">
                                <button
                                    onClick={() => setViewMode('compliance')}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 text-center whitespace-nowrap ${viewMode === 'compliance' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-700'}`}
                                >
                                    Conformité
                                </button>
                                <button
                                    onClick={() => setViewMode('watch')}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 text-center whitespace-nowrap ${viewMode === 'watch' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-700'}`}
                                >
                                    Veille
                                </button>
                            </div>

                            {viewMode === 'compliance' && (
                                <button
                                    onClick={generateSoAReport}
                                    className="hidden md:flex p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-600 transition-colors"
                                    title="Générer SoA"
                                >
                                    <Download className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    }
                />
            </SlideUp>

            {viewMode === 'compliance' && (
                <SlideUp delay={0.1}>
                    <div className="border-b border-slate-200 dark:border-white/10 -mt-2">
                        <ScrollableTabs
                            tabs={complianceFrameworks.map(f => ({ id: f.value, label: f.label }))}
                            activeTab={currentFramework}
                            onTabChange={(id) => setCurrentFramework(id as Framework)}
                        />
                    </div>
                </SlideUp>
            )}

            {
                viewMode === 'compliance' && (
                    <>
                        {/* Dashboard Integration */}
                        <SlideUp>
                            <ComplianceDashboard controls={controls} onFilterChange={setStatusFilter} />
                        </SlideUp>

                        {/* Filter Bar - Clean Style */}
                        <SlideUp>
                            <div className="glass-panel p-1.5 pl-4 rounded-2xl flex flex-col md:flex-row gap-4 shadow-sm">
                                <div className="flex-1 relative group flex items-center">
                                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-500 group-focus-within:text-brand-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Rechercher un contrôle (ex: A.5.1, Accès)..."
                                        className="w-full pl-12 pr-4 py-3 bg-transparent border-none focus:ring-0 text-sm font-medium transition-all placeholder:text-slate-500 text-slate-700 dark:text-white"
                                        value={filter}
                                        onChange={e => setFilter(e.target.value)}
                                    />
                                </div>

                                <div className="flex gap-2 p-2 pt-0 md:p-0 overflow-x-auto no-scrollbar">
                                    {/* Status Filter Badge */}
                                    {statusFilter && (
                                        <button onClick={() => setStatusFilter(null)} className="flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-800 animate-fade-in hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors whitespace-nowrap shrink-0">
                                            <span className="mr-2 opacity-70 hidden sm:inline">Filtre:</span> {statusFilter} <X className="h-4 w-4 ml-2" />
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setShowMissingEvidence(!showMissingEvidence)}
                                        className={`flex items-center px-5 py-3 rounded-xl text-sm font-bold border transition-all shadow-sm whitespace-nowrap shrink-0 ${showMissingEvidence ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                    >
                                        <Filter className={`h-4 w-4 mr-2 ${showMissingEvidence ? 'fill-current' : ''}`} />
                                        Preuves <span className="hidden sm:inline ml-1">manquantes</span>
                                    </button>
                                </div>
                            </div>
                        </SlideUp>

                        {/* Accordion List - Clean Card Style */}
                        <SlideUp>
                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 flex items-center gap-4">
                                            <Skeleton className="w-12 h-12 rounded-xl" />
                                            <div className="space-y-2 flex-1">
                                                <Skeleton className="h-5 w-48" />
                                                <Skeleton className="h-4 w-full max-w-md" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : filteredControls.length === 0 ? (
                                <EmptyState
                                    icon={ShieldCheck}
                                    title="Aucun contrôle trouvé"
                                    description={filter ? "Aucun contrôle ne correspond à votre recherche." : "Les contrôles n'ont pas été chargés."}
                                />
                            ) : (
                                <div className="space-y-4">
                                    {(() => {
                                        let domains: { id: string, title: string, description: string }[] = [];
                                        switch (currentFramework) {
                                            case 'ISO27001': domains = ISO_DOMAINS; break;
                                            case 'ISO22301': domains = ISO22301_DOMAINS; break;
                                            case 'NIS2': domains = NIS2_DOMAINS; break;
                                            case 'DORA': domains = DORA_DOMAINS; break;
                                            case 'GDPR': domains = GDPR_DOMAINS; break;
                                            case 'SOC2': domains = SOC2_DOMAINS; break;
                                            case 'HDS': domains = HDS_DOMAINS; break;
                                            case 'PCI_DSS': domains = PCI_DSS_DOMAINS; break;
                                            case 'NIST_CSF': domains = NIST_CSF_DOMAINS; break;
                                        }
                                        return domains.map(domain => {
                                            const domainControls = filteredControls.filter(c => c.code.startsWith(domain.id));
                                            if (domainControls.length === 0) return null;
                                            const stats = getDomainStats(domain.id);
                                            const isExpanded = expandedDomains.includes(domain.id) || filter.length > 0;

                                            return (
                                                <div key={domain.id} className="glass-panel rounded-[2.5rem] shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                                                    <div
                                                        onClick={() => toggleDomain(domain.id)}
                                                        className={`p-6 flex flex-col md:flex-row md:items-center justify-between cursor-pointer transition-colors gap-4 ${isExpanded ? 'bg-slate-50/80 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                                    >
                                                        <div className="flex items-center gap-5 flex-1 min-w-0">
                                                            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-lg border border-slate-200 dark:border-white/10 shrink-0">
                                                                {domain.id.split('.')[1]}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate pr-2">{domain.title}</h3>
                                                                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-1 truncate">{domain.description} • <span className="text-slate-700 dark:text-slate-300">{stats.total} contrôles</span></p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between md:justify-end gap-3 md:gap-8 w-full md:w-auto pl-[4.25rem] md:pl-0">
                                                            <div className="w-full md:w-40">
                                                                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                                                    <span>Progression</span>
                                                                    <span className="text-slate-900 dark:text-white">{stats.progress}%</span>
                                                                </div>
                                                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                                                    <div className={`h-full rounded-full transition-all duration-500 ${stats.progress === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${stats.progress}%` }}></div>
                                                                </div>
                                                            </div>
                                                            <div className={`p-2 rounded-full transition-all duration-300 shrink-0 ${isExpanded ? 'bg-white dark:bg-white/10 shadow-sm rotate-180 text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                                                                <ChevronDown className="h-5 w-5" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="border-t border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
                                                            {domainControls.map(control => {
                                                                const riskCount = risks.filter(r => r.mitigationControlIds?.includes(control.id)).length;
                                                                const findingsCount = findings.filter(f => f.relatedControlId === control.id && f.status === 'Ouvert').length;
                                                                return (
                                                                    <CustomTooltip key={control.id} content={`Cliquez pour voir les détails de ${control.code}`} position="top" className="w-full">
                                                                        <div onClick={() => openInspector(control)} className="p-4 sm:p-5 hover:bg-gray-50/80 dark:hover:bg-white/5 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-4 sm:pl-8 active:scale-[0.99] duration-200">
                                                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5 flex-1 min-w-0">
                                                                                <div className="min-w-[50px]"><span className="text-xs font-black text-slate-500 group-hover:text-brand-600 transition-colors">{control.code}</span></div>
                                                                                <div className="flex-1 min-w-0"><h4 className="text-[14px] font-semibold text-slate-800 dark:text-slate-200 truncate pr-4">{control.name}</h4>
                                                                                    <div className="flex flex-wrap items-center mt-2 gap-2 text-xs">
                                                                                        {control.evidenceIds && control.evidenceIds.length > 0 ? (<span className="flex items-center text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-md text-[11px]"><Paperclip className="h-3 w-3 mr-1.5" /> {control.evidenceIds.length} preuve(s)</span>) : (control.status === 'Implémenté') ? (<span className="flex items-center text-orange-500 font-medium bg-orange-50 dark:bg-orange-900/10 px-2.5 py-1 rounded-md text-[11px]"><AlertTriangle className="h-3 w-3 mr-1.5" /> Preuve manquante</span>) : null}
                                                                                        {riskCount > 0 && (<span className="flex items-center text-blue-500 font-medium bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-md text-[11px]"><ShieldAlert className="h-3 w-3 mr-1.5" /> {riskCount} risques</span>)}
                                                                                        {findingsCount > 0 && (<span className="flex items-center text-red-500 font-medium bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-md text-[11px]"><AlertOctagon className="h-3 w-3 mr-1.5" /> {findingsCount} écarts</span>)}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                                                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm whitespace-nowrap ${control.status === 'Implémenté' ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : control.status === 'Partiel' ? 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' : 'text-slate-600 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>{control.status}</span>
                                                                                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors hidden sm:block" />
                                                                            </div>
                                                                        </div>
                                                                    </CustomTooltip>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            )}
                        </SlideUp>

                    </>
                )
            }

            {
                viewMode === 'watch' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-8 rounded-3xl border border-slate-200 dark:border-white/5 text-center">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-slate-900/20 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <Globe className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Veille Réglementaire EUR-Lex</h2>
                            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8">
                                Recherchez les dernières réglementations européennes (Directives, Règlements) directement depuis la source officielle EUR-Lex.
                            </p>


                            <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1 text-left">
                                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Ex: Intelligence Artificielle, DORA, NIS2..."
                                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
                                        value={eurLexQuery}
                                        onChange={(e) => setEurLexQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleEurLexSearch()}
                                    />
                                </div>
                                <button
                                    onClick={handleEurLexSearch}
                                    disabled={isSearchingEurLex}
                                    className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSearchingEurLex ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                                    {isSearchingEurLex ? "Recherche..." : "Rechercher"}
                                </button>
                            </div>
                        </div>

                        {eurLexResult && (
                            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center">
                                        <Globe className="w-4 h-4 mr-2 text-blue-500" />
                                        Résultats EUR-Lex
                                    </h3>
                                    <a
                                        href={eurLexResult}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center"
                                    >
                                        Ouvrir dans un nouvel onglet <ExternalLink className="w-3 h-3 ml-1" />
                                    </a>
                                </div>
                                <div className="p-12 text-center bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center min-h-[300px]">
                                    <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full mb-4">
                                        <Globe className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Résultats disponibles sur EUR-Lex</h4>
                                    <p className="text-slate-600 dark:text-slate-400 max-w-md mb-6">
                                        Pour des raisons de sécurité, le portail EUR-Lex ne permet pas l'affichage direct dans cette fenêtre.
                                    </p>
                                    <a
                                        href={eurLexResult}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                                    >
                                        Consulter les résultats <ExternalLink className="w-4 h-4 ml-2" />
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {/* Drawer Inspector */}
            <Drawer
                isOpen={isDrawerOpen}
                onClose={() => { setIsDrawerOpen(false); setCreationMode(null); }}
                title={creationMode ? (creationMode === 'risk' ? 'Nouveau Risque' : creationMode === 'project' ? 'Nouveau Projet' : 'Nouvel Audit') : (selectedControl ? `${selectedControl.code} - ${selectedControl.name}` : '')}
                breadcrumbs={getBreadcrumbs()}
                subtitle={creationMode ? 'Création' : (selectedControl?.framework || currentFramework)}
                width={creationMode ? "max-w-4xl" : "max-w-6xl"}
            >
                {creationMode ? (
                    <div className="h-full bg-slate-50 dark:bg-slate-900/50">
                        {creationMode === 'risk' && (
                            <RiskForm
                                onSubmit={handleCreateRisk}
                                onCancel={() => setCreationMode(null)}
                                assets={assets}
                                usersList={usersList}
                                processes={processes}
                                suppliers={suppliers}
                                controls={controls}
                                initialData={modalInitialData as Partial<RiskFormData> || undefined}
                            />
                        )}
                        {creationMode === 'project' && (
                            <ProjectForm
                                onSubmit={handleCreateProject}
                                onCancel={() => setCreationMode(null)}
                                availableUsers={usersList.map(u => u.displayName || u.email || '')}
                                availableRisks={risks}
                                availableControls={controls}
                                availableAssets={assets}
                                initialData={modalInitialData as Partial<ProjectFormData> || undefined}
                            />
                        )}
                        {creationMode === 'audit' && (
                            <AuditForm
                                onSubmit={handleCreateAudit}
                                onCancel={() => setCreationMode(null)}
                                assets={assets}
                                risks={risks}
                                controls={controls}
                                usersList={usersList}
                                projects={projects}
                                initialData={modalInitialData as Partial<AuditFormData> || undefined}
                            />
                        )}
                    </div>
                ) : (selectedControl && (
                    <div className="h-full flex flex-col">
                        {/* Tabs */}
                        <div className="bg-white/50 dark:bg-white/5 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100 dark:border-white/5">
                            {linkingToProjectId && (
                                <div className="bg-brand-50/50 dark:bg-brand-900/10 px-6 py-3 border-b border-brand-100 dark:border-brand-900/30 flex items-center justify-between animate-fade-in">
                                    <div className="flex items-center text-sm text-brand-700 dark:text-brand-300">
                                        <Link className="h-4 w-4 mr-2" />
                                        <span className="font-medium">Lier ce contrôle au projet <strong>{linkingToProjectName}</strong> ?</span>
                                    </div>
                                    <button
                                        onClick={() => handleLinkProject(linkingToProjectId)}
                                        disabled={updating || (selectedControl?.relatedProjectIds || []).includes(linkingToProjectId)}
                                        className="text-xs bg-brand-600 hover:bg-brand-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center shadow-sm"
                                    >
                                        {updating ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Link className="h-3 w-3 mr-1.5" />}
                                        {(selectedControl?.relatedProjectIds || []).includes(linkingToProjectId) ? 'Déjà lié' : 'Lier maintenant'}
                                    </button>
                                </div>
                            )}

                            <ScrollableTabs
                                tabs={[
                                    { id: 'details', label: 'Détails', icon: FileText },
                                    { id: 'evidence', label: `Preuves (${selectedControl.evidenceIds?.length || 0})`, icon: Paperclip },
                                    { id: 'linkedItems', label: 'Éléments Liés', icon: Link },
                                    { id: 'comments', label: 'Discussion', icon: MessageSquare },
                                    { id: 'history', label: 'Historique', icon: RefreshCw },
                                ]}
                                activeTab={inspectorTab}
                                onTabChange={(id) => setInspectorTab(id as any)}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {inspectorTab === 'details' && (
                                <div className="space-y-8 max-w-3xl mx-auto">
                                    {/* AI Assistant */}
                                    <ComplianceAIAssistant control={selectedControl} onApplyPolicy={(policy) => setEditJustification(prev => prev ? prev + '\n\n' + policy : policy)} />

                                    {/* Status & Assignment */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Statut d'implémentation</h3>
                                            {canEdit ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {(['Non commencé', 'Partiel', 'Implémenté', 'En revue', 'Non applicable', 'Exclu'] as Control['status'][]).map((s) => (
                                                        <button
                                                            key={s}
                                                            onClick={() => handleStatusChange(selectedControl, s)}
                                                            disabled={updating}
                                                            className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all duration-200 flex items-center justify-center ${selectedControl.status === s
                                                                ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                                                                : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
                                                                } ${updating ? 'opacity-50 cursor-wait' : ''}`}
                                                        >
                                                            {updating && selectedControl.status === s ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                                            {s}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className={`px-4 py-2 rounded-xl text-sm font-bold border uppercase tracking-wide inline-block`}>{selectedControl.status}</span>
                                            )}
                                        </div>

                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Responsable</h3>
                                            {canEdit ? (
                                                <CustomSelect
                                                    label="Assigné à"
                                                    value={selectedControl.assigneeId || ''}
                                                    onChange={(val) => handleAssign(val as string)}
                                                    options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                                                    placeholder="Sélectionner un responsable..."
                                                    disabled={updating}
                                                />
                                            ) : (
                                                <div className="flex items-center p-3 bg-slate-50 dark:bg-black/20 rounded-xl">
                                                    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 mr-3">
                                                        <User className="h-4 w-4" />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                        {usersList.find(u => u.uid === selectedControl.assigneeId)?.displayName || 'Non assigné'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Linked Resources */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Actifs Liés</h3>
                                            <div className="space-y-2 mb-4">
                                                {selectedControl.relatedAssetIds?.map(assetId => {
                                                    const asset = assets.find(a => a.id === assetId);
                                                    return asset ? (
                                                        <div key={assetId} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-white/5 rounded-lg text-sm">
                                                            <span className="truncate flex-1 font-medium text-slate-700 dark:text-slate-200">{asset.name}</span>
                                                            {canEdit && <button onClick={() => handleUnlinkAsset(assetId)} disabled={updating} className="text-slate-500 hover:text-red-500 disabled:opacity-50"><X className="h-3.5 w-3.5" /></button>}
                                                        </div>
                                                    ) : null;
                                                })}
                                                {(!selectedControl.relatedAssetIds || selectedControl.relatedAssetIds.length === 0) && <p className="text-xs text-slate-500 italic">Aucun actif lié.</p>}
                                            </div>
                                            {canEdit && (
                                                <CustomSelect
                                                    label=""
                                                    value=""
                                                    onChange={(val) => handleLinkAsset(val as string)}
                                                    options={assets.filter(a => !selectedControl.relatedAssetIds?.includes(a.id)).map(a => ({ value: a.id, label: a.name }))}
                                                    placeholder="Lier un actif..."
                                                    disabled={updating}
                                                />
                                            )}
                                        </div>
                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Fournisseurs Liés</h3>
                                            <div className="space-y-2 mb-4">
                                                {selectedControl.relatedSupplierIds?.map(supplierId => {
                                                    const supplier = suppliers.find(s => s.id === supplierId);
                                                    return supplier ? (
                                                        <div key={supplierId} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-white/5 rounded-lg text-sm">
                                                            <span className="truncate flex-1 font-medium text-slate-700 dark:text-slate-200">{supplier.name}</span>
                                                            {canEdit && <button onClick={() => handleUnlinkSupplier(supplierId)} disabled={updating} className="text-slate-500 hover:text-red-500 disabled:opacity-50"><X className="h-3.5 w-3.5" /></button>}
                                                        </div>
                                                    ) : null;
                                                })}
                                                {(!selectedControl.relatedSupplierIds || selectedControl.relatedSupplierIds.length === 0) && <p className="text-xs text-slate-500 italic">Aucun fournisseur lié.</p>}
                                            </div>
                                            {canEdit && (
                                                <CustomSelect
                                                    label=""
                                                    value=""
                                                    onChange={(val) => handleLinkSupplier(val as string)}
                                                    options={suppliers.filter(s => !selectedControl.relatedSupplierIds?.includes(s.id)).map(s => ({ value: s.id, label: s.name }))}
                                                    placeholder="Lier un fournisseur..."
                                                    disabled={updating}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Justification */}
                                    <div>
                                        <div className="flex justify-between items-end mb-3 px-2">
                                            <h3 className="text-xs font-bold uppercase text-slate-500 flex items-center tracking-widest"><FileText className="h-3.5 w-3.5 mr-2" /> Justification SoA</h3>
                                            {selectedControl.status === 'Exclu' && <span className="text-[10px] text-red-500 font-bold uppercase bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">Obligatoire</span>}
                                        </div>
                                        {canEdit ? (
                                            <div className="relative group">
                                                <textarea
                                                    className="w-full p-5 text-sm bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-white/10 rounded-3xl text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-brand-500 outline-none shadow-sm font-medium leading-relaxed"
                                                    rows={6}
                                                    placeholder="Décrivez comment ce contrôle est implémenté, ou justifiez son exclusion..."
                                                    value={editJustification}
                                                    onChange={e => setEditJustification(e.target.value)}
                                                />
                                                <button
                                                    onClick={handleJustificationSave}
                                                    disabled={updating}
                                                    className={`absolute bottom-4 right-4 p-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl shadow-lg transition-all hover:scale-110 ${updating ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                    title="Sauvegarder"
                                                >
                                                    {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="p-5 bg-white dark:bg-slate-800/80 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm">
                                                <p className="text-sm text-slate-600 dark:text-slate-300 italic font-medium leading-relaxed">{selectedControl.justification || "Aucune justification saisie."}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {
                                inspectorTab === 'evidence' && (
                                    <div className="space-y-6 max-w-3xl mx-auto">
                                        {/* Automated Evidence Section */}
                                        <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 flex items-center tracking-widest"><Plug className="h-3.5 w-3.5 mr-2" /> Preuves Automatisées</h3>

                                            <div className="space-y-3 mb-6">
                                                {selectedControl.automatedEvidence && selectedControl.automatedEvidence.length > 0 ? (
                                                    selectedControl.automatedEvidence.map(evidence => {
                                                        const provider = providers.find(p => p.id === evidence.providerId) || { name: evidence.providerId, icon: 'default' };
                                                        return (
                                                            <div key={evidence.id} className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`p-2 rounded-xl ${evidence.status === 'pass' ? 'bg-emerald-100 text-emerald-600' : evidence.status === 'fail' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                                                        {evidence.status === 'pass' ? <CheckCircle2 className="h-5 w-5" /> : evidence.status === 'fail' ? <XCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-bold text-slate-900 dark:text-white text-sm">{provider.name}</div>
                                                                        <div className="text-xs text-slate-600 font-medium">{evidence.details}</div>
                                                                        <div className="text-[10px] text-slate-500 mt-1">Dernière synchro: {new Date(evidence.lastSync).toLocaleString()}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => handleSyncEvidence(evidence)}
                                                                        disabled={syncingEvidenceId === evidence.id}
                                                                        className="p-2 text-slate-500 hover:text-brand-600 hover:bg-white dark:hover:bg-white/10 rounded-lg transition-all"
                                                                        title="Synchroniser maintenant"
                                                                    >
                                                                        {syncingEvidenceId === evidence.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                                                    </button>
                                                                    {canEdit && (
                                                                        <button
                                                                            onClick={() => handleUnlinkAutomatedEvidence(evidence.id)}
                                                                            className="p-2 text-slate-500 hover:text-red-500 hover:bg-white dark:hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
                                                                            title="Délier"
                                                                            disabled={updating}
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="text-xs text-slate-500 italic text-center py-4 border border-dashed border-gray-200 dark:border-slate-700 rounded-xl">Aucune preuve automatisée liée.</p>
                                                )}
                                            </div>

                                            {canEdit && (
                                                <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                                                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">Ajouter une source</h4>
                                                    <div className="flex flex-col sm:flex-row gap-3">
                                                        <select
                                                            value={selectedProviderId}
                                                            onChange={(e) => setSelectedProviderId(e.target.value)}
                                                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-500"
                                                        >
                                                            <option value="">Sélectionner un fournisseur...</option>
                                                            {providers.map(p => (
                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="text"
                                                            placeholder="ID de la ressource (ex: bucket-name)"
                                                            value={selectedResourceId}
                                                            onChange={(e) => setSelectedResourceId(e.target.value)}
                                                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-500"
                                                        />
                                                        <button
                                                            onClick={handleLinkAutomatedEvidence}
                                                            disabled={!selectedProviderId || !selectedResourceId || isLinkingEvidence}
                                                            className="bg-brand-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center min-w-[100px]"
                                                        >
                                                            {isLinkingEvidence ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lier'}
                                                        </button>
                                                    </div>
                                                    {providers.length === 0 && !loadingProviders && (
                                                        <p className="text-[10px] text-amber-500 mt-2 flex items-center">
                                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                                            Aucune intégration connectée. Allez dans "Intégrations" pour en configurer.
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 flex items-center tracking-widest"><Link className="h-3.5 w-3.5 mr-2" /> Preuves Documentaires</h3>
                                            <div className="space-y-2 mb-4">
                                                {selectedControl.evidenceIds && selectedControl.evidenceIds.length > 0 ? selectedControl.evidenceIds.map(docId => {
                                                    const docObj = documents.find(d => d.id === docId);
                                                    return docObj ? (
                                                        <div key={docId} className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm group transition-all hover:bg-white dark:hover:bg-white/5">
                                                            <div className="flex items-center overflow-hidden">
                                                                <div className="p-2 bg-blue-50 dark:bg-slate-900 dark:bg-slate-900/20 rounded-lg mr-3 text-blue-500"><File className="h-4 w-4" /></div>
                                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{docObj.title}</span>
                                                            </div>
                                                            <div className="flex gap-2 items-center">
                                                                {docObj.nextReviewDate && new Date(docObj.nextReviewDate) < new Date() && (
                                                                    <CustomTooltip content="Document expiré / à revoir" position="top">
                                                                        <div className="text-red-500"><AlertTriangle className="h-4 w-4" /></div>
                                                                    </CustomTooltip>
                                                                )}
                                                                {docObj.url && <a href={docObj.url} target="_blank" rel="noreferrer" className="p-2 text-slate-500 hover:text-brand-600 bg-white dark:bg-slate-800 rounded-lg transition-colors shadow-sm"><ExternalLink className="h-3.5 w-3.5" /></a>}
                                                                {canEdit && <button onClick={() => initiateUnlinkDocument(docId)} disabled={updating} className="p-2 text-slate-500 hover:text-red-500 bg-white dark:bg-slate-800 rounded-lg transition-colors shadow-sm disabled:opacity-50"><X className="h-3.5 w-3.5" /></button>}
                                                            </div>
                                                        </div>
                                                    ) : null;
                                                }) : <p className="text-xs text-slate-500 italic text-center py-4 border border-dashed border-gray-200 dark:border-slate-700 rounded-xl">Aucune preuve liée.</p>}
                                            </div>
                                            {canEdit && (
                                                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5">
                                                    <label className="text-[10px] font-bold text-slate-500 mb-3 block uppercase tracking-wide">Ajouter une preuve existante</label>
                                                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 bg-gray-50/50 dark:bg-black/20 p-2 rounded-2xl border border-gray-100 dark:border-white/5">
                                                        {documents.filter(d => !selectedControl.evidenceIds?.includes(d.id)).map(d => (
                                                            <button key={d.id} onClick={() => linkDocument(d.id)} disabled={updating} className="w-full text-left text-xs p-2.5 hover:bg-white dark:hover:bg-white/10 rounded-xl flex items-center text-slate-600 dark:text-slate-300 transition-all font-medium disabled:opacity-50">
                                                                {updating ? <Loader2 className="h-3 w-3 mr-2 animate-spin text-brand-500" /> : <Plus className="h-3 w-3 mr-2 text-brand-500" />} {d.title}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            }

                            {inspectorTab === 'linkedItems' && (
                                <div className="space-y-6 max-w-3xl mx-auto">
                                    {/* Linked Risks */}
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <div className="flex flex-wrap items-center justify-between mb-4 gap-y-2">
                                            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center"><ShieldAlert className="h-3.5 w-3.5 mr-2" /> Risques Atténués</h3>
                                            <div className="flex gap-2">
                                                {canEditResource(user, 'Risk') && (
                                                    <CustomSelect
                                                        options={risks.filter(r => !r.mitigationControlIds?.includes(selectedControl.id)).map(r => ({ value: r.id, label: r.threat }))}
                                                        value=""
                                                        onChange={(val) => handleLinkRisk(val as string)}
                                                        placeholder="Lier existant..."
                                                        className="w-40"
                                                        disabled={updating}
                                                    />
                                                )}
                                                {hasPermission(user, 'Risk', 'create') && (
                                                    <button onClick={() => { setModalInitialData({ mitigationControlIds: [selectedControl.id] }); setCreationMode('risk'); }} className="p-1.5 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors">
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {risks.filter(r => r.mitigationControlIds?.includes(selectedControl.id)).map(risk => (
                                                <div key={risk.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{risk.threat}</div>
                                                        <div className="text-xs text-slate-600">Score: {risk.score}</div>
                                                    </div>
                                                    {canEdit && (
                                                        <button onClick={() => handleUnlinkRisk(risk.id)} disabled={updating} className="p-1 px-2 text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded transition-colors">Délier</button>
                                                    )}
                                                </div>
                                            ))}
                                            {risks.filter(r => r.mitigationControlIds?.includes(selectedControl.id)).length === 0 && (
                                                <p className="text-xs text-slate-500 italic text-center py-4">Aucun risque lié via un plan de traitement.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Linked Projects (New) */}
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <div className="flex flex-wrap items-center justify-between mb-4 gap-y-2">
                                            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center"><FolderKanban className="h-3.5 w-3.5 mr-2" /> Projets de Mise en Conformité</h3>
                                        </div>
                                        <div className="space-y-2">
                                            {projects.filter(p => p.relatedControlIds?.includes(selectedControl.id)).map(proj => (
                                                <div key={proj.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" onClick={() => navigate('/projects', { state: { voxelSelectedId: proj.id, fromVoxel: true } })}>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                            {proj.name}
                                                            <Badge status={proj.status === 'Terminé' ? 'success' : proj.status === 'En cours' ? 'info' : 'neutral'} size="sm">{proj.status}</Badge>
                                                        </div>
                                                        <div className="text-xs text-slate-600">Échéance: {proj.dueDate ? new Date(proj.dueDate).toLocaleDateString() : '-'}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {projects.filter(p => p.relatedControlIds?.includes(selectedControl.id)).length === 0 && (
                                                <p className="text-xs text-slate-500 italic text-center py-4">Aucun projet lié.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Linked Projects */}
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <div className="flex flex-wrap items-center justify-between mb-4 gap-y-2">
                                            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center"><FolderKanban className="h-3.5 w-3.5 mr-2" /> Projets Liés</h3>
                                            <div className="flex gap-2">
                                                {canEditResource(user, 'Project') && (
                                                    <CustomSelect
                                                        options={projects.filter(p => !p.relatedControlIds?.includes(selectedControl.id)).map(p => ({ value: p.id, label: p.name }))}
                                                        value=""
                                                        onChange={(val) => handleLinkProject(val as string)}
                                                        placeholder="Lier existant..."
                                                        className="w-40"
                                                        disabled={updating}
                                                    />
                                                )}
                                                {hasPermission(user, 'Project', 'create') && (
                                                    <button onClick={() => { setModalInitialData({ relatedControlIds: [selectedControl.id] }); setCreationMode('project'); }} className="p-1.5 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors">
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {projects.filter(p => p.relatedControlIds?.includes(selectedControl.id)).map(project => (
                                                <div key={project.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                                    <div>
                                                        <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{project.name}</div>
                                                        <div className="text-xs text-slate-600 mt-0.5">{project.description?.substring(0, 50)}...</div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${project.status === 'En cours' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{project.status}</span>
                                                </div>
                                            ))}
                                            {projects.filter(p => p.relatedControlIds?.includes(selectedControl.id)).length === 0 && (
                                                <p className="text-sm text-slate-500 italic">Aucun projet lié.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Linked Audits */}
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <div className="flex flex-wrap items-center justify-between mb-4 gap-y-2">
                                            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center"><FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Audits Liés</h3>
                                            <div className="flex gap-2">
                                                {canEditResource(user, 'Audit') && (
                                                    <CustomSelect
                                                        options={audits.filter(a => !a.relatedControlIds?.includes(selectedControl.id)).map(a => ({ value: a.id, label: a.name }))}
                                                        value=""
                                                        onChange={(val) => handleLinkAudit(val as string)}
                                                        placeholder="Lier existant..."
                                                        className="w-40"
                                                        disabled={updating}
                                                    />
                                                )}
                                                {hasPermission(user, 'Audit', 'create') && (
                                                    <button onClick={() => { setModalInitialData({ relatedControlIds: [selectedControl.id] }); setCreationMode('audit'); }} className="p-1.5 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors">
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {audits.filter(a => a.relatedControlIds?.includes(selectedControl.id)).map(audit => (
                                                <div key={audit.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                                    <div>
                                                        <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{audit.name}</div>
                                                        <div className="text-xs text-slate-600 mt-0.5">{new Date(audit.dateScheduled).toLocaleDateString()}</div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${audit.status === 'Terminé' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{audit.status}</span>
                                                </div>
                                            ))}
                                            {audits.filter(a => a.relatedControlIds?.includes(selectedControl.id)).length === 0 && (
                                                <p className="text-sm text-slate-500 italic">Aucun audit lié.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {
                                inspectorTab === 'comments' && (
                                    <div className="h-full flex flex-col max-w-3xl mx-auto">
                                        <Comments collectionName="controls" documentId={selectedControl.id} />
                                    </div>
                                )
                            }

                            {
                                inspectorTab === 'history' && (
                                    <div className="space-y-8 max-w-3xl mx-auto">
                                        <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Journal d'Activité</h4>
                                            {controlHistory.length === 0 ? <p className="text-sm text-slate-500 italic">Aucune activité enregistrée.</p> : controlHistory.map((log, i) => (
                                                <div key={i} className="relative">
                                                    <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-brand-100 dark:border-brand-900">
                                                        <div className="h-2 w-2 rounded-full bg-brand-500"></div>
                                                    </span>
                                                    <div>
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{log.details}</p>
                                                        <div className="mt-2 inline-flex items-center px-2 py-1 rounded-lg bg-gray-50 dark:bg-white/5 text-[10px] font-medium text-slate-600">{log.userEmail}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            }
                        </div >
                    </div >
                ))}

            </Drawer >
        </div >
    );
};

