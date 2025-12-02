import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { collection, getDocs, doc, updateDoc, writeBatch, arrayUnion, query, where, limit, addDoc } from 'firebase/firestore';
import { RiskFormData } from '../schemas/riskSchema';
import { ProjectFormData } from '../schemas/projectSchema';
import { AuditFormData } from '../schemas/auditSchema';
import { db } from '../firebase';
import { Control, Document, Risk, Finding, UserProfile, SystemLog, Asset, Supplier, Project, Audit, BusinessProcess } from '../types';
import { FileText, AlertTriangle, Download, Paperclip, Link, ExternalLink, ShieldAlert, AlertOctagon, Search, X, Save, File, ShieldCheck, Plus, ChevronRight, Filter, ChevronDown, User, FolderKanban, FileSpreadsheet } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { PdfService } from '../services/PdfService';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ComplianceDashboard } from '../components/compliance/ComplianceDashboard';
import { ComplianceAIAssistant } from '../components/compliance/ComplianceAIAssistant';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorLogger } from '../services/errorLogger';
import { Drawer } from '../components/ui/Drawer';
import { Comments } from '../components/ui/Comments';
import { CustomSelect } from '../components/ui/CustomSelect';
import { NotificationService } from '../services/notificationService';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { RiskForm } from '../components/risks/RiskForm';
import { AuditForm } from '../components/audits/AuditForm';
import { ProjectForm } from '../components/projects/ProjectForm';


import { ISO_DOMAINS, ISO_SEED_CONTROLS, NIS2_DOMAINS, NIS2_SEED_CONTROLS, DORA_DOMAINS, DORA_SEED_CONTROLS, GDPR_DOMAINS, GDPR_SEED_CONTROLS, SOC2_DOMAINS, SOC2_SEED_CONTROLS, HDS_DOMAINS, HDS_SEED_CONTROLS, PCI_DSS_DOMAINS, PCI_DSS_SEED_CONTROLS, NIST_CSF_DOMAINS, NIST_CSF_SEED_CONTROLS } from '../data/complianceData';
import { integrationService } from '../services/integrationService';
import { Globe } from '../components/ui/Icons';







import { canEditResource, hasPermission } from '../utils/permissions';

export const Compliance: React.FC = () => {
    const { user, addToast } = useStore();

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
    const [currentFramework, setCurrentFramework] = useState<'ISO27001' | 'NIS2' | 'DORA' | 'GDPR' | 'SOC2' | 'HDS' | 'PCI_DSS' | 'NIST_CSF'>('ISO27001');
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

    // Data Fetching with Hooks
    const { data: rawControls, loading: controlsLoading, refresh: refreshControls } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: documents, loading: docsLoading } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: risks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: findings, loading: findingsLoading } = useFirestoreCollection<Finding>(
        'findings',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: usersList, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: assets, loading: assetsLoading } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: suppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: projects, loading: projectsLoading } = useFirestoreCollection<Project>(
        'projects',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: audits, loading: auditsLoading } = useFirestoreCollection<Audit>(
        'audits',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: processes, loading: processesLoading } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
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
        try {
            await updateDoc(doc(db, 'controls', selectedControl.id), { assigneeId });

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
        }
    };

    const handleStatusChange = async (control: Control, newStatus: Control['status']) => {
        if (!user?.organizationId || !canEdit) return;
        try {
            const applicability: 'Applicable' | 'Non applicable' =
                (newStatus === 'Non applicable' || newStatus === 'Exclu') ? 'Non applicable' : 'Applicable';

            await updateDoc(doc(db, 'controls', control.id), {
                status: newStatus,
                applicability,
                lastUpdated: new Date().toISOString()
            });
            await logAction(user, 'UPDATE', 'Control', `Statut ${control.code} changé à ${newStatus}`);

            const updatedControl = { ...control, status: newStatus, applicability, lastUpdated: new Date().toISOString() };
            if (selectedControl?.id === control.id) setSelectedControl(updatedControl);
            refreshControls();

            addToast("Statut mis à jour", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleStatusChange', 'UPDATE_FAILED');
        }
    };

    const handleJustificationSave = async () => {
        if (!selectedControl || !user?.organizationId || !canEdit) return;
        try {
            await updateDoc(doc(db, 'controls', selectedControl.id), {
                justification: editJustification,
                lastUpdated: new Date().toISOString()
            });
            await logAction(user, 'UPDATE', 'Control', `Justification mise à jour pour ${selectedControl.code}`);

            const updatedControl = { ...selectedControl, justification: editJustification, lastUpdated: new Date().toISOString() };
            setSelectedControl(updatedControl);
            refreshControls();

            addToast("Justification enregistrée", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleJustificationSave', 'UPDATE_FAILED');
        }
    };

    const linkDocument = async (docId: string) => {
        if (!selectedControl || !canEdit) return;
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
        try {
            const newEvidence = (selectedControl.evidenceIds || []).filter(id => id !== docId);
            await updateDoc(doc(db, 'controls', selectedControl.id), { evidenceIds: newEvidence });
            refreshControls();
            setSelectedControl({ ...selectedControl, evidenceIds: newEvidence });
            addToast("Preuve retirée", "info");
        } catch (e) {
            ErrorLogger.error(e, 'Compliance.unlinkDocument');
            addToast("Erreur suppression lien", "error");
        }
    };

    const handleLinkAsset = async (assetId: string) => {
        if (!selectedControl || !user?.organizationId || !canEdit) return;
        try {
            if (selectedControl.relatedAssetIds?.includes(assetId)) return;
            await updateDoc(doc(db, 'controls', selectedControl.id), { relatedAssetIds: arrayUnion(assetId) });
            const newAssets = [...(selectedControl.relatedAssetIds || []), assetId];
            refreshControls();
            setSelectedControl({ ...selectedControl, relatedAssetIds: newAssets });
            await logAction(user, 'LINK', 'Compliance', `Actif lié au contrôle ${selectedControl.code}`);
            addToast("Actif lié", "success");
        } catch (error) { ErrorLogger.handleErrorWithToast(error, 'Compliance.handleLinkAsset', 'UPDATE_FAILED'); }
    };

    const handleUnlinkAsset = async (assetId: string) => {
        if (!selectedControl || !user?.organizationId || !canEdit) return;
        try {
            const newAssets = (selectedControl.relatedAssetIds || []).filter(id => id !== assetId);
            await updateDoc(doc(db, 'controls', selectedControl.id), { relatedAssetIds: newAssets });
            refreshControls();
            setSelectedControl({ ...selectedControl, relatedAssetIds: newAssets });
            addToast("Lien actif retiré", "info");
        } catch (error) { ErrorLogger.handleErrorWithToast(error, 'Compliance.handleUnlinkAsset', 'UPDATE_FAILED'); }
    };

    const handleLinkSupplier = async (supplierId: string) => {
        if (!selectedControl || !user?.organizationId || !canEdit) return;
        try {
            if (selectedControl.relatedSupplierIds?.includes(supplierId)) return;
            await updateDoc(doc(db, 'controls', selectedControl.id), { relatedSupplierIds: arrayUnion(supplierId) });
            const newSuppliers = [...(selectedControl.relatedSupplierIds || []), supplierId];
            refreshControls();
            setSelectedControl({ ...selectedControl, relatedSupplierIds: newSuppliers });
            await logAction(user, 'LINK', 'Compliance', `Fournisseur lié au contrôle ${selectedControl.code}`);
            addToast("Fournisseur lié", "success");
        } catch (error) { ErrorLogger.handleErrorWithToast(error, 'Compliance.handleLinkSupplier', 'UPDATE_FAILED'); }
    };

    const handleUnlinkSupplier = async (supplierId: string) => {
        if (!selectedControl || !user?.organizationId || !canEdit) return;
        try {
            const newSuppliers = (selectedControl.relatedSupplierIds || []).filter(id => id !== supplierId);
            await updateDoc(doc(db, 'controls', selectedControl.id), { relatedSupplierIds: newSuppliers });
            refreshControls();
            setSelectedControl({ ...selectedControl, relatedSupplierIds: newSuppliers });
            addToast("Lien fournisseur retiré", "info");
        } catch (error) { ErrorLogger.handleErrorWithToast(error, 'Compliance.handleUnlinkSupplier', 'UPDATE_FAILED'); }
    };


    const handleLinkRisk = async (riskId: string) => {
        if (!selectedControl || !user?.organizationId || !canEditResource(user, 'Risk')) return;
        try {
            await updateDoc(doc(db, 'risks', riskId), {
                mitigationControlIds: arrayUnion(selectedControl.id)
            });
            addToast("Risque lié avec succès", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleLinkRisk', 'UPDATE_FAILED');
        }
    };

    const handleCreateRisk = async (data: RiskFormData) => {
        if (!selectedControl || !user?.organizationId || !hasPermission(user, 'Risk', 'create')) return;
        try {
            await addDoc(collection(db, 'risks'), {
                ...data,
                organizationId: user.organizationId,
                mitigationControlIds: [selectedControl.id],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'Ouvert'
            });
            setCreationMode(null);
            addToast("Nouveau risque créé et lié", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleCreateRisk', 'CREATE_FAILED');
        }
    };

    const handleLinkProject = async (projectId: string) => {
        if (!selectedControl || !user?.organizationId || !canEditResource(user, 'Project')) return;
        try {
            await updateDoc(doc(db, 'projects', projectId), {
                relatedControlIds: arrayUnion(selectedControl.id)
            });
            addToast("Projet lié avec succès", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleLinkProject', 'UPDATE_FAILED');
        }
    };

    const handleCreateProject = async (data: ProjectFormData) => {
        if (!selectedControl || !user?.organizationId || !hasPermission(user, 'Project', 'create')) return;
        try {
            await addDoc(collection(db, 'projects'), {
                ...data,
                organizationId: user.organizationId,
                relatedControlIds: [selectedControl.id],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'En cours'
            });
            setCreationMode(null);
            addToast("Nouveau projet créé et lié", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleCreateProject', 'CREATE_FAILED');
        }
    };

    const handleLinkAudit = async (auditId: string) => {
        if (!selectedControl || !user?.organizationId || !canEditResource(user, 'Audit')) return;
        try {
            await updateDoc(doc(db, 'audits', auditId), {
                relatedControlIds: arrayUnion(selectedControl.id)
            });
            addToast("Audit lié avec succès", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleLinkAudit', 'UPDATE_FAILED');
        }
    };

    const handleCreateAudit = async (data: AuditFormData) => {
        if (!selectedControl || !user?.organizationId || !hasPermission(user, 'Audit', 'create')) return;
        try {
            await addDoc(collection(db, 'audits'), {
                ...data,
                organizationId: user.organizationId,
                relatedControlIds: [selectedControl.id],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'Planifié'
            });
            setCreationMode(null);
            addToast("Nouvel audit créé et lié", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleCreateAudit', 'CREATE_FAILED');
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
        const data = controls.map(c => {
            const applicability = c.applicability || ((c.status === 'Non applicable' || c.status === 'Exclu') ? 'Non applicable' : 'Applicable');
            const justification = c.justification || ((c.status === 'Exclu' || applicability === 'Non applicable') ? 'Non justifié' : '-');
            return [c.code, c.name, applicability, c.status, justification];
        });

        PdfService.generateTableReport(
            {
                title: "Déclaration d'Applicabilité (SoA)",
                subtitle: `${currentFramework} | Généré le ${new Date().toLocaleDateString()} | ${user?.organizationName || 'Organisation'}`,
                filename: `SoA_${currentFramework}_${new Date().toISOString().split('T')[0]}.pdf`,
                headerText: `${currentFramework} Compliance Report`,
                footerText: 'Sentinel GRC by Cyber Threat Consulting - Document Confidentiel'
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
    };

    const filteredControls = controls.filter(c => {
        const matchesSearch = c.code.toLowerCase().includes(filter.toLowerCase()) || c.name.toLowerCase().includes(filter.toLowerCase());
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

    return (
        <div className="space-y-8 animate-fade-in relative pb-10">
            <Helmet>
                <title>{selectedControl ? `${selectedControl.code} - Conformité` : 'Conformité & Standards - Sentinel GRC'}</title>
            </Helmet>
            {/* Confirm Modal */}
            <ConfirmModal isOpen={confirmData.isOpen} onClose={() => setConfirmData({ ...confirmData, isOpen: false })} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} />

            <PageHeader
                title={
                    currentFramework === 'ISO27001' ? "Déclaration d'Applicabilité" :
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
                actions={
                    <div className="flex gap-3 items-center">
                        {/* View Switcher */}
                        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center border border-slate-200 dark:border-white/10 mr-2">
                            <button
                                onClick={() => setViewMode('compliance')}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${viewMode === 'compliance' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                            >
                                Conformité
                            </button>
                            <button
                                onClick={() => setViewMode('watch')}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${viewMode === 'watch' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                            >
                                Veille Réglementaire
                            </button>
                        </div>

                        {viewMode === 'compliance' && (
                            <>
                                {/* Framework Switcher - Tabs Style */}
                                <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center border border-slate-200 dark:border-white/10 overflow-x-auto max-w-[400px] custom-scrollbar">
                                    {(['ISO27001', 'NIS2', 'DORA', 'GDPR', 'SOC2', 'HDS', 'PCI_DSS', 'NIST_CSF'] as const).map(fw => (
                                        <button
                                            key={fw}
                                            onClick={() => setCurrentFramework(fw)}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap ${currentFramework === fw ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                        >
                                            {fw === 'ISO27001' ? 'ISO 27001' : fw === 'NIS2' ? 'NIS 2' : fw === 'DORA' ? 'DORA' : fw === 'GDPR' ? 'RGPD' : fw === 'SOC2' ? 'SOC 2' : fw === 'HDS' ? 'HDS' : fw === 'PCI_DSS' ? 'PCI DSS' : 'NIST CSF'}
                                        </button>
                                    ))}
                                </div>

                                <button onClick={generateSoAReport} className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm text-slate-700 dark:text-white whitespace-nowrap">
                                    <Download className="h-4 w-4 mr-2 text-slate-500" /> Rapport
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            {viewMode === 'compliance' && (
                <>
                    {/* Dashboard Integration */}
                    <ComplianceDashboard controls={controls} onFilterChange={setStatusFilter} />

                    {/* Filter Bar - Clean Style */}
                    <div className="glass-panel p-1.5 pl-4 rounded-2xl flex flex-col sm:flex-row gap-4 border border-slate-200 dark:border-white/5 shadow-sm">
                        <div className="flex-1 relative group flex items-center">
                            <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Rechercher un contrôle (ex: A.5.1, Accès)..."
                                className="w-full pl-12 pr-4 py-3 bg-transparent border-none focus:ring-0 text-sm font-medium transition-all placeholder:text-slate-400 text-slate-700 dark:text-white"
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            {/* Status Filter Badge */}
                            {statusFilter && (
                                <button onClick={() => setStatusFilter(null)} className="flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-800 animate-fade-in hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors">
                                    <span className="mr-2 opacity-70">Filtre:</span> {statusFilter} <X className="h-4 w-4 ml-2" />
                                </button>
                            )}

                            <button
                                onClick={() => setShowMissingEvidence(!showMissingEvidence)}
                                className={`flex items-center px-5 py-3 rounded-xl text-sm font-bold border transition-all shadow-sm ${showMissingEvidence ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                            >
                                <Filter className={`h-4 w-4 mr-2 ${showMissingEvidence ? 'fill-current' : ''}`} />
                                Preuves manquantes
                            </button>
                        </div>
                    </div>

                    {/* Accordion List - Clean Card Style */}
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
                                        <div key={domain.id} className="glass-panel rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                                            <div
                                                onClick={() => toggleDomain(domain.id)}
                                                className={`p-6 flex items-center justify-between cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/80 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-lg border border-slate-200 dark:border-white/10">
                                                        {domain.id.split('.')[1]}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{domain.title}</h3>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">{domain.description} • <span className="text-slate-700 dark:text-slate-300">{stats.total} contrôles</span></p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-8">
                                                    <div className="hidden md:block w-40">
                                                        <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                                                            <span>Progression</span>
                                                            <span className="text-slate-900 dark:text-white">{stats.progress}%</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                                            <div className={`h-full rounded-full transition-all duration-500 ${stats.progress === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${stats.progress}%` }}></div>
                                                        </div>
                                                    </div>
                                                    <div className={`p-2 rounded-full transition-all duration-300 ${isExpanded ? 'bg-white dark:bg-white/10 shadow-sm rotate-180 text-slate-900 dark:text-white' : 'text-slate-400'}`}>
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
                                                                <div onClick={() => openInspector(control)} className="p-5 hover:bg-gray-50/80 dark:hover:bg-white/5 transition-all cursor-pointer group flex items-center justify-between pl-8 active:scale-[0.99] duration-200">
                                                                    <div className="flex items-center space-x-5 flex-1 min-w-0">
                                                                        <div className="min-w-[50px]"><span className="text-xs font-black text-slate-400 group-hover:text-brand-600 transition-colors">{control.code}</span></div>
                                                                        <div className="flex-1 min-w-0"><h4 className="text-[14px] font-semibold text-slate-800 dark:text-slate-200 truncate pr-4">{control.name}</h4>
                                                                            <div className="flex items-center mt-1 gap-3 text-xs">
                                                                                {control.evidenceIds && control.evidenceIds.length > 0 ? (<span className="flex items-center text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded"><Paperclip className="h-3 w-3 mr-1" /> {control.evidenceIds.length} preuve(s)</span>) : (control.status === 'Implémenté') ? (<span className="flex items-center text-orange-500 font-medium"><AlertTriangle className="h-3 w-3 mr-1" /> Preuve manquante</span>) : null}
                                                                                {riskCount > 0 && (<span className="flex items-center text-blue-500 font-medium bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded"><ShieldAlert className="h-3 w-3 mr-1" /> {riskCount} risques</span>)}
                                                                                {findingsCount > 0 && (<span className="flex items-center text-red-500 font-medium bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded"><AlertOctagon className="h-3 w-3 mr-1" /> {findingsCount} écarts</span>)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-4">
                                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${control.status === 'Implémenté' ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20' : control.status === 'Partiel' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-slate-500 bg-slate-100 border-slate-200'}`}>{control.status}</span>
                                                                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
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

                </>
            )}

            {viewMode === 'watch' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200 dark:border-white/5 text-center">
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Globe className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Veille Réglementaire EUR-Lex</h2>
                        <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-8">
                            Recherchez les dernières réglementations européennes (Directives, Règlements) directement depuis la source officielle EUR-Lex.
                        </p>

                        <div className="max-w-2xl mx-auto flex gap-3">
                            <div className="relative flex-1 text-left">
                                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Ex: Intelligence Artificielle, DORA, NIS2..."
                                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
                                    value={eurLexQuery}
                                    onChange={(e) => setEurLexQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && setEurLexResult(integrationService.searchEurLex(eurLexQuery))}
                                />
                            </div>
                            <button
                                onClick={() => setEurLexResult(integrationService.searchEurLex(eurLexQuery))}
                                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                            >
                                Rechercher
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
                            <div className="aspect-[16/9] w-full bg-slate-100 dark:bg-slate-900">
                                <iframe
                                    src={eurLexResult}
                                    className="w-full h-full border-none"
                                    title="EUR-Lex Search Results"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

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
                        <div className="flex border-b border-gray-100 dark:border-white/5 px-6 bg-white/50 dark:bg-white/5 backdrop-blur-sm sticky top-0 z-10">
                            <button onClick={() => setInspectorTab('details')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${inspectorTab === 'details' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Détails</button>
                            <button onClick={() => setInspectorTab('evidence')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${inspectorTab === 'evidence' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Preuves ({selectedControl.evidenceIds?.length || 0})</button>
                            <button onClick={() => setInspectorTab('linkedItems')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${inspectorTab === 'linkedItems' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Éléments Liés</button>
                            <button onClick={() => setInspectorTab('comments')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${inspectorTab === 'comments' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Discussion</button>
                            <button onClick={() => setInspectorTab('history')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${inspectorTab === 'history' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Historique</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {inspectorTab === 'details' && (
                                <div className="space-y-8 max-w-3xl mx-auto">
                                    {/* AI Assistant */}
                                    <ComplianceAIAssistant control={selectedControl} onApplyPolicy={(policy) => setEditJustification(prev => prev ? prev + '\n\n' + policy : policy)} />

                                    {/* Status & Assignment */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 tracking-widest">Statut d'implémentation</h3>
                                            {canEdit ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {(['Non commencé', 'Partiel', 'Implémenté', 'En revue', 'Non applicable', 'Exclu'] as Control['status'][]).map((s) => (
                                                        <button
                                                            key={s}
                                                            onClick={() => handleStatusChange(selectedControl, s)}
                                                            className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all duration-200 flex items-center justify-center ${selectedControl.status === s
                                                                ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                                                                : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
                                                                }`}
                                                        >
                                                            {s}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className={`px-4 py-2 rounded-xl text-sm font-bold border uppercase tracking-wide inline-block`}>{selectedControl.status}</span>
                                            )}
                                        </div>

                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 tracking-widest">Responsable</h3>
                                            {canEdit ? (
                                                <CustomSelect
                                                    label="Assigné à"
                                                    value={selectedControl.assigneeId || ''}
                                                    onChange={(val) => handleAssign(val as string)}
                                                    options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                                                    placeholder="Sélectionner un responsable..."
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
                                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 tracking-widest">Actifs Liés</h3>
                                            <div className="space-y-2 mb-4">
                                                {selectedControl.relatedAssetIds?.map(assetId => {
                                                    const asset = assets.find(a => a.id === assetId);
                                                    return asset ? (
                                                        <div key={assetId} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-white/5 rounded-lg text-sm">
                                                            <span className="truncate flex-1 font-medium text-slate-700 dark:text-slate-200">{asset.name}</span>
                                                            {canEdit && <button onClick={() => handleUnlinkAsset(assetId)} className="text-slate-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>}
                                                        </div>
                                                    ) : null;
                                                })}
                                                {(!selectedControl.relatedAssetIds || selectedControl.relatedAssetIds.length === 0) && <p className="text-xs text-slate-400 italic">Aucun actif lié.</p>}
                                            </div>
                                            {canEdit && (
                                                <CustomSelect
                                                    label=""
                                                    value=""
                                                    onChange={(val) => handleLinkAsset(val as string)}
                                                    options={assets.filter(a => !selectedControl.relatedAssetIds?.includes(a.id)).map(a => ({ value: a.id, label: a.name }))}
                                                    placeholder="Lier un actif..."
                                                />
                                            )}
                                        </div>
                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 tracking-widest">Fournisseurs Liés</h3>
                                            <div className="space-y-2 mb-4">
                                                {selectedControl.relatedSupplierIds?.map(supplierId => {
                                                    const supplier = suppliers.find(s => s.id === supplierId);
                                                    return supplier ? (
                                                        <div key={supplierId} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-white/5 rounded-lg text-sm">
                                                            <span className="truncate flex-1 font-medium text-slate-700 dark:text-slate-200">{supplier.name}</span>
                                                            {canEdit && <button onClick={() => handleUnlinkSupplier(supplierId)} className="text-slate-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>}
                                                        </div>
                                                    ) : null;
                                                })}
                                                {(!selectedControl.relatedSupplierIds || selectedControl.relatedSupplierIds.length === 0) && <p className="text-xs text-slate-400 italic">Aucun fournisseur lié.</p>}
                                            </div>
                                            {canEdit && (
                                                <CustomSelect
                                                    label=""
                                                    value=""
                                                    onChange={(val) => handleLinkSupplier(val as string)}
                                                    options={suppliers.filter(s => !selectedControl.relatedSupplierIds?.includes(s.id)).map(s => ({ value: s.id, label: s.name }))}
                                                    placeholder="Lier un fournisseur..."
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Justification */}
                                    <div>
                                        <div className="flex justify-between items-end mb-3 px-2">
                                            <h3 className="text-xs font-bold uppercase text-slate-400 flex items-center tracking-widest"><FileText className="h-3.5 w-3.5 mr-2" /> Justification SoA</h3>
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
                                                    className="absolute bottom-4 right-4 p-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                                                    title="Sauvegarder"
                                                >
                                                    <Save className="h-4 w-4" />
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
                                        <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 flex items-center tracking-widest"><Link className="h-3.5 w-3.5 mr-2" /> Preuves Documentaires</h3>
                                            <div className="space-y-2 mb-4">
                                                {selectedControl.evidenceIds && selectedControl.evidenceIds.length > 0 ? selectedControl.evidenceIds.map(docId => {
                                                    const docObj = documents.find(d => d.id === docId);
                                                    return docObj ? (
                                                        <div key={docId} className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm group transition-all hover:bg-white dark:hover:bg-white/5">
                                                            <div className="flex items-center overflow-hidden">
                                                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg mr-3 text-blue-500"><File className="h-4 w-4" /></div>
                                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{docObj.title}</span>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                {docObj.url && <a href={docObj.url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-brand-600 bg-white dark:bg-slate-800 rounded-lg transition-colors shadow-sm"><ExternalLink className="h-3.5 w-3.5" /></a>}
                                                                {canEdit && <button onClick={() => initiateUnlinkDocument(docId)} className="p-2 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-lg transition-colors shadow-sm"><X className="h-3.5 w-3.5" /></button>}
                                                            </div>
                                                        </div>
                                                    ) : null;
                                                }) : <p className="text-xs text-gray-400 italic text-center py-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">Aucune preuve liée.</p>}
                                            </div>
                                            {canEdit && (
                                                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5">
                                                    <label className="text-[10px] font-bold text-slate-400 mb-3 block uppercase tracking-wide">Ajouter une preuve existante</label>
                                                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 bg-gray-50/50 dark:bg-black/20 p-2 rounded-2xl border border-gray-100 dark:border-white/5">
                                                        {documents.filter(d => !selectedControl.evidenceIds?.includes(d.id)).map(d => (
                                                            <button key={d.id} onClick={() => linkDocument(d.id)} className="w-full text-left text-xs p-2.5 hover:bg-white dark:hover:bg-white/10 rounded-xl flex items-center text-slate-600 dark:text-slate-300 transition-all font-medium">
                                                                <Plus className="h-3 w-3 mr-2 text-brand-500" /> {d.title}
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
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest flex items-center"><ShieldAlert className="h-3.5 w-3.5 mr-2" /> Risques Atténués</h3>
                                            <div className="flex gap-2">
                                                {canEditResource(user, 'Risk') && (
                                                    <CustomSelect
                                                        options={risks.filter(r => !r.mitigationControlIds?.includes(selectedControl.id)).map(r => ({ value: r.id, label: r.threat }))}
                                                        value=""
                                                        onChange={(val) => handleLinkRisk(val as string)}
                                                        placeholder="Lier existant..."
                                                        className="w-40"
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
                                                        <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{risk.threat}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5">Score: {risk.score} → {risk.residualScore}</div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${risk.status === 'Ouvert' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{risk.status}</span>
                                                </div>
                                            ))}
                                            {risks.filter(r => r.mitigationControlIds?.includes(selectedControl.id)).length === 0 && (
                                                <p className="text-sm text-slate-400 italic">Aucun risque lié.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Linked Projects */}
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest flex items-center"><FolderKanban className="h-3.5 w-3.5 mr-2" /> Projets Liés</h3>
                                            <div className="flex gap-2">
                                                {canEditResource(user, 'Project') && (
                                                    <CustomSelect
                                                        options={projects.filter(p => !p.relatedControlIds?.includes(selectedControl.id)).map(p => ({ value: p.id, label: p.name }))}
                                                        value=""
                                                        onChange={(val) => handleLinkProject(val as string)}
                                                        placeholder="Lier existant..."
                                                        className="w-40"
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
                                                        <div className="text-xs text-slate-500 mt-0.5">{project.description?.substring(0, 50)}...</div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${project.status === 'En cours' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{project.status}</span>
                                                </div>
                                            ))}
                                            {projects.filter(p => p.relatedControlIds?.includes(selectedControl.id)).length === 0 && (
                                                <p className="text-sm text-slate-400 italic">Aucun projet lié.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Linked Audits */}
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest flex items-center"><FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Audits Liés</h3>
                                            <div className="flex gap-2">
                                                {canEditResource(user, 'Audit') && (
                                                    <CustomSelect
                                                        options={audits.filter(a => !a.relatedControlIds?.includes(selectedControl.id)).map(a => ({ value: a.id, label: a.name }))}
                                                        value=""
                                                        onChange={(val) => handleLinkAudit(val as string)}
                                                        placeholder="Lier existant..."
                                                        className="w-40"
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
                                                        <div className="text-xs text-slate-500 mt-0.5">{new Date(audit.dateScheduled).toLocaleDateString()}</div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${audit.status === 'Terminé' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{audit.status}</span>
                                                </div>
                                            ))}
                                            {audits.filter(a => a.relatedControlIds?.includes(selectedControl.id)).length === 0 && (
                                                <p className="text-sm text-slate-400 italic">Aucun audit lié.</p>
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
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Journal d'Activité</h4>
                                            {controlHistory.length === 0 ? <p className="text-sm text-gray-400 italic">Aucune activité enregistrée.</p> : controlHistory.map((log, i) => (
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
                                )
                            }
                        </div >
                    </div >
                ))}

            </Drawer >
        </div >
    );
};

