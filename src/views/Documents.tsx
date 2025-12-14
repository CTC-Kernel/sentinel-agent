import React, { useDeferredValue, useEffect, useMemo, useState, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, limit, increment, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Document, UserProfile, SystemLog, Control, Asset, Audit, DocumentFolder, DocumentVersion, Risk } from '../types';
import { canEditResource } from '../utils/permissions';
import { sanitizeData } from '../utils/dataSanitizer';
import { Plus, Search, File, ExternalLink, Trash2, Link as LinkIcon, Edit, Users, Bell, FileText, X, History, MessageSquare, Eye, FileSpreadsheet, ShieldCheck, CheckCircle2, LayoutGrid, List, Loader2 } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { sendEmail } from '../services/emailService';
import { getDocumentReviewTemplate } from '../services/emailTemplates';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Comments } from '../components/ui/Comments';
import { AddToCalendar } from '../components/ui/AddToCalendar';
import { CardSkeleton, TableSkeleton } from '../components/ui/Skeleton';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { FilePreview } from '../components/ui/FilePreview';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorLogger } from '../services/errorLogger';
import { DocumentForm } from '../components/documents/DocumentForm';
import { SafeHTML } from '../components/ui/SafeHTML';
import { FolderTree } from '../components/documents/FolderTree';
import { DocumentFormData } from '../schemas/documentSchema';
import { getPlanLimits } from '../config/plans';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';

import { useFirestoreCollection } from '../hooks/useFirestore';
import { EncryptionService } from '../services/encryptionService';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import CryptoJS from 'crypto-js';
import SignatureCanvas from 'react-signature-canvas';


export const Documents: React.FC = () => {
    const { user, organization, addToast } = useStore();
    const location = useLocation();
    const canCreate = canEditResource(user, 'Document');

    // Data Fetching with Hooks
    const { data: rawDocuments, loading: loadingDocuments } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: usersList, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: rawControls, loading: loadingControls } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: rawAudits, loading: loadingAudits } = useFirestoreCollection<Audit>(
        'audits',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: rawFolders, loading: loadingFolders } = useFirestoreCollection<DocumentFolder>(
        'document_folders',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    // Derived State
    const documents = React.useMemo(() => {
        return [...rawDocuments]
            .sort((a, b) => a.title.localeCompare(b.title))
            .map(doc => ({
                ...doc,
                // Transparently decrypt description for UI display
                description: EncryptionService.decrypt(doc.description || '')
            }));
    }, [rawDocuments]);
    const controls = React.useMemo(() => [...rawControls].sort((a, b) => a.code.localeCompare(b.code)), [rawControls]);
    const assets = React.useMemo(() => [...rawAssets].sort((a, b) => a.name.localeCompare(b.name)), [rawAssets]);
    const audits = React.useMemo(() => [...rawAudits].sort((a, b) => new Date(b.dateScheduled).getTime() - new Date(a.dateScheduled).getTime()), [rawAudits]);
    const risks = React.useMemo(() => [...rawRisks].sort((a, b) => b.score - a.score), [rawRisks]);
    const folders = React.useMemo(() => [...rawFolders].sort((a, b) => a.name.localeCompare(b.name)), [rawFolders]);

    const loading = loadingDocuments || loadingUsers || loadingControls || loadingAssets || loadingAudits || loadingFolders || loadingRisks;

    const limits = user?.organizationId ? getPlanLimits(organization?.subscription?.planId || 'discovery') : null;
    const storageLimitBytes = (limits?.maxStorageGB || 1) * 1024 * 1024 * 1024;
    const storageUsed = organization?.storageUsed || 0;
    const isStorageFull = storageUsed >= storageLimitBytes;

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filter, setFilter] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [isDigitalSafeMode, setIsDigitalSafeMode] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);

    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [docHistory, setDocHistory] = useState<SystemLog[]>([]);
    const [versions, setVersions] = useState<DocumentVersion[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || documents.length === 0) return;
        const doc = documents.find(d => d.id === state.voxelSelectedId);
        if (doc && selectedDocument?.id !== doc.id) {

            setSelectedDocument(doc);
        }
    }, [location.state, loading, documents, selectedDocument]);

    const [isEditing, setIsEditing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);

    // Metrics for Summary Card
    const totalDocs = documents.length;
    const publishedDocs = documents.filter(d => d.status === 'Publié' || d.status === 'Approuvé').length;
    const inReviewDocs = documents.filter(d => d.status === 'En revue').length;
    const draftDocs = documents.filter(d => d.status === 'Brouillon').length;
    const expiredDocs = documents.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < new Date()).length;

    const validationRate = totalDocs > 0 ? (publishedDocs / totalDocs) * 100 : 0;

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; loading?: boolean; closeOnConfirm?: boolean }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    // Signature Modal
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const signaturePadRef = useRef<SignatureCanvas>(null);

    type InspectorTab = 'details' | 'versions' | 'history' | 'comments';
    const [inspectorTab, setInspectorTab] = useState<InspectorTab>('details');

    const handleSignatureSubmit = async () => {
        if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
            addToast("Veuillez signer avant de valider", "info");
            return;
        }

        const signatureImage = signaturePadRef.current.toDataURL(); // base64 png
        await handleWorkflowAction('sign', signatureImage);
        setShowSignatureModal(false);
    };

    const openInspector = async (docItem: Document) => {
        setSelectedDocument(docItem);
        setInspectorTab('details');
        setIsEditing(false);
        setIsEditing(false);
    };

    useEffect(() => {
        if (!selectedDocument) {
            setDocHistory([]);
            setVersions([]);
            return;
        }

        // Fetch System Logs
        const qLogs = query(
            collection(db, 'system_logs'),
            where('targetId', '==', selectedDocument.id),
            orderBy('timestamp', 'desc'),
            limit(20)
        );
        const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
            setDocHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemLog)));
        });

        // Fetch Versions
        const qVersions = query(
            collection(db, 'document_versions'),
            where('documentId', '==', selectedDocument.id),
            orderBy('uploadedAt', 'desc')
        );
        const unsubscribeVersions = onSnapshot(qVersions, (snapshot) => {
            setVersions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DocumentVersion)));
        });

        return () => {
            unsubscribeLogs();
            unsubscribeVersions();
        };
    }, [selectedDocument]);

    const handleUploadSuccess = async (size: number) => {
        if (size && user?.organizationId) {
            const orgRef = doc(db, 'organizations', user.organizationId);
            updateDoc(orgRef, {
                storageUsed: increment(size)
            }).catch(e => ErrorLogger.error(e, "Documents.handleUploadSuccess"));
        }
    };

    const handleWorkflowAction = async (action: 'submit' | 'approve' | 'reject' | 'sign', signatureImage?: string) => {
        if (!selectedDocument || !user) return;

        const isOwnerOrAdmin = canEditResource(user, 'Document', selectedDocument.ownerId || selectedDocument.owner);
        const isApprover = selectedDocument.approvers?.includes(user.uid);

        if (action === 'submit' && !isOwnerOrAdmin) return;
        if ((action === 'approve' || action === 'reject') && (!isApprover && !isOwnerOrAdmin)) return;
        if (action === 'sign' && (!isApprover && !isOwnerOrAdmin)) return;

        // If signing and no image, open modal
        if (action === 'sign' && !signatureImage) {
            setShowSignatureModal(true);
            return;
        }

        let updates: Partial<Document> = {};
        let logMsg = '';

        if (action === 'submit') {
            updates = { status: 'En revue', workflowStatus: 'Review' };
            logMsg = 'Document soumis pour revue';
        } else if (action === 'approve') {
            updates = { status: 'Approuvé', workflowStatus: 'Approved' };
            logMsg = 'Document approuvé';
        } else if (action === 'reject') {
            updates = { status: 'Rejeté', workflowStatus: 'Rejected' };
            logMsg = 'Document rejeté';
        } else if (action === 'sign') {
            const newSignature = {
                userId: user.uid,
                date: new Date().toISOString(),
                role: user.role,
                signatureImage: signatureImage
            };
            const currentSignatures = selectedDocument.signatures || [];
            updates = {
                status: 'Publié',
                workflowStatus: 'Approved',
                signatures: [...currentSignatures, newSignature]
            };
            logMsg = 'Document signé et publié';
        }

        try {
            await updateDoc(doc(db, 'documents', selectedDocument.id), { ...updates, updatedAt: new Date().toISOString() });
            await logAction(user, 'WORKFLOW', 'Document', `${logMsg}: ${selectedDocument.title}`);

            setSelectedDocument({ ...selectedDocument, ...updates });
            addToast(logMsg, "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleWorkflowAction', 'UPDATE_FAILED');
        }
    };

    const handleSecureView = async (docItem: Document) => {
        if (!docItem.url) return;
        addToast("Préparation du document sécurisé...", "info");

        try {
            // 1. Fetch the file
            const response = await fetch(docItem.url);
            if (!response.ok) throw new Error(`Erreur lors du téléchargement (${response.status})`);

            const mimeType = response.headers.get('content-type') || 'application/octet-stream';
            const arrayBuffer = await response.arrayBuffer();

            // 2. Verify Integrity (Hash)
            if (docItem.hash) {
                const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
                const currentHash = CryptoJS.SHA256(wordArray).toString();
                if (currentHash !== docItem.hash) {
                    addToast("ALERTE : L'intégrité du document est compromise ! Le hash ne correspond pas.", "error");
                    // We allow viewing but with a warning, or blocking could be an option.
                } else {
                    addToast("Intégrité du document vérifiée.", "success");
                }
            }

            // 3. Watermark & Certificate (if PDF)
            // Use mimeType check instead of just url extension if possible, or fallback to extension
            const isPdf = mimeType.includes('pdf') || docItem.url.toLowerCase().includes('.pdf');

            if (isPdf) {
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                const pages = pdfDoc.getPages();
                const { height } = pages[0].getSize();
                const watermarkText = `CONFIDENTIEL - ${user?.displayName} - ${new Date().toLocaleDateString()}`;

                // Add Watermark
                if (docItem.watermarkEnabled) {
                    pages.forEach(page => {
                        page.drawText(watermarkText, {
                            x: 50, y: height / 2, size: 30,
                            color: rgb(0.95, 0.1, 0.1), opacity: 0.3, rotate: degrees(45),
                        });
                    });
                }

                // Add Certificate Page if Signed
                if (docItem.signatures && docItem.signatures.length > 0) {
                    const page = pdfDoc.addPage();
                    const { height } = page.getSize();
                    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

                    page.drawText('CERTIFICAT DE SIGNATURE ÉLECTRONIQUE', { x: 50, y: height - 50, size: 20, font: font, color: rgb(0, 0, 0.5) });

                    let yOffset = height - 100;
                    page.drawText(`Document : ${docItem.title}`, { x: 50, y: yOffset, size: 12, font: fontRegular });
                    yOffset -= 20;
                    page.drawText(`Hash (SHA-256) : ${docItem.hash || 'N/A'}`, { x: 50, y: yOffset, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
                    yOffset -= 40;

                    for (const sig of docItem.signatures) {
                        page.drawText(`Signataire : ${usersList.find(u => u.uid === sig.userId)?.displayName || sig.userId}`, { x: 50, y: yOffset, size: 14, font: font });
                        yOffset -= 20;
                        page.drawText(`Date : ${new Date(sig.date).toLocaleString()}`, { x: 50, y: yOffset, size: 12, font: fontRegular });
                        yOffset -= 20;
                        page.drawText(`Rôle : ${sig.role}`, { x: 50, y: yOffset, size: 12, font: fontRegular });
                        yOffset -= 20;

                        if (sig.signatureImage) {
                            try {
                                const imageBytes = await fetch(sig.signatureImage).then(res => res.arrayBuffer());
                                const pngImage = await pdfDoc.embedPng(imageBytes);
                                const pngDims = pngImage.scale(0.5);
                                page.drawImage(pngImage, {
                                    x: 50,
                                    y: yOffset - pngDims.height,
                                    width: pngDims.width,
                                    height: pngDims.height,
                                });
                                yOffset -= (pngDims.height + 20);
                            } catch (e) {
                                ErrorLogger.error(e, "Documents.handleSecureView.embedSignature");
                            }
                        }
                        yOffset -= 40;
                    }

                    page.drawText('Ce document a été signé électroniquement via Sentinel GRC.', { x: 50, y: 50, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
                }

                const pdfBytes = await pdfDoc.save();
                const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            } else {
                // Non-PDF
                const blob = new Blob([arrayBuffer], { type: mimeType });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            }

            await logAction(user, 'VIEW', 'Document', `Consultation sécurisée: ${docItem.title}`);

        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Documents.handleSecureView');
        }
    };

    const handleCreate = async (data: DocumentFormData & { fileUrl?: string; fileHash?: string; isSecure?: boolean }) => {
        if (!canCreate || !user?.organizationId) return;
        setIsSubmitting(true);

        try {
            const docData = {
                ...data,
                url: data.storageProvider !== 'firebase' ? data.externalUrl : (data.fileUrl || ''),
                hash: data.fileHash || '',
                isSecure: data.isSecure || false,
                // Encrypt description if Secure Mode is on
                description: (data.isSecure || false) ? EncryptionService.encrypt(data.description || '') : (data.description || ''),
                watermarkEnabled: data.isSecure || false,
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const docRef = await addDoc(collection(db, 'documents'), sanitizeData(docData));

            // Create initial version
            if (docData.url) {
                await addDoc(collection(db, 'document_versions'), {
                    documentId: docRef.id,
                    version: data.version,
                    url: docData.url,
                    hash: docData.hash,
                    uploadedBy: user.uid,
                    uploadedAt: new Date().toISOString(),
                    changeLog: 'Création initiale'
                });
            }

            await logAction(user, 'CREATE', 'Document', `Nouveau document: ${data.title}`);
            addToast("Document ajouté", "success");
            setShowCreateModal(false);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Documents.handleCreate');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async (data: DocumentFormData & { fileUrl?: string; fileHash?: string; isSecure?: boolean }) => {
        if (!canEditResource(user, 'Document', selectedDocument?.ownerId || selectedDocument?.owner) || !selectedDocument) return;
        setIsSubmitting(true);
        try {
            const newUrl = data.storageProvider !== 'firebase' ? data.externalUrl : (data.fileUrl || selectedDocument.url);

            const updates = {
                ...data,
                url: newUrl,
                hash: data.fileHash || selectedDocument.hash,
                isSecure: data.isSecure ?? selectedDocument.isSecure,
                // Encrypt description if Secure Mode is ON (either new or existing)
                description: (data.isSecure ?? selectedDocument.isSecure)
                    ? EncryptionService.encrypt(data.description || '')
                    : (data.description || ''),
                watermarkEnabled: (data.isSecure ?? selectedDocument.isSecure) || false,
                updatedAt: new Date().toISOString()
            };

            await updateDoc(doc(db, 'documents', selectedDocument.id), sanitizeData(updates));

            // Create new version if version number or file changed
            if (data.version !== selectedDocument.version || newUrl !== selectedDocument.url) {
                await addDoc(collection(db, 'document_versions'), {
                    documentId: selectedDocument.id,
                    version: data.version,
                    url: newUrl || '',
                    hash: updates.hash || '',
                    uploadedBy: user?.uid,
                    uploadedAt: new Date().toISOString(),
                    changeLog: 'Mise à jour'
                });
            }

            await logAction(user, 'UPDATE', 'Document', `MAJ document: ${data.title}`);
            setSelectedDocument({ ...selectedDocument, ...updates });
            setIsEditing(false);
            addToast("Document mis à jour", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleUpdate', 'UPDATE_FAILED');
        } finally {
            setIsSubmitting(false);
        }
    };

    const initiateDelete = async (id: string, title: string) => {
        // Check permissions
        if (!canEditResource(user, 'Document', selectedDocument?.ownerId || selectedDocument?.owner)) return;

        // Check for dependencies (Data Integrity)
        try {
            // Check Controls (evidence)
            const linkedControls = controls.filter(c => c.evidenceIds?.includes(id));

            // Check Suppliers (contracts)
            const suppliersQ = query(collection(db, 'suppliers'), where('organizationId', '==', user?.organizationId), where('contractDocumentId', '==', id));

            // Check Business Processes (DRP)
            const bcpQ = query(collection(db, 'business_processes'), where('organizationId', '==', user?.organizationId), where('drpDocumentId', '==', id));

            // Check Findings (evidence)
            const findingsQ = query(collection(db, 'findings'), where('organizationId', '==', user?.organizationId), where('evidenceIds', 'array-contains', id));

            const [suppliersSnap, bcpSnap, findingsSnap] = await Promise.all([
                getDocs(suppliersQ),
                getDocs(bcpQ),
                getDocs(findingsQ)
            ]);

            if (linkedControls.length > 0 || !suppliersSnap.empty || !bcpSnap.empty || !findingsSnap.empty) {
                const controlNames = linkedControls.map(c => c.code).join(', ');
                const supplierNames = suppliersSnap.docs.map(d => d.data().name).join(', ');
                const bcpNames = bcpSnap.docs.map(d => d.data().name).join(', ');

                let msg = "Impossible de supprimer ce document car il est utilisé :";
                if (linkedControls.length > 0) msg += `\n- Preuve pour ${linkedControls.length} contrôle(s) (${controlNames})`;
                if (!suppliersSnap.empty) msg += `\n- Contrat pour ${suppliersSnap.size} fournisseur(s) (${supplierNames})`;
                if (!bcpSnap.empty) msg += `\n- DRP pour ${bcpSnap.size} processus (${bcpNames})`;
                if (!findingsSnap.empty) msg += `\n- Preuve pour ${findingsSnap.size} constat(s) d'audit`;

                addToast(msg, "error");
                return;
            }

            setConfirmData({
                isOpen: true,
                title: "Supprimer le document ?",
                message: "Cette action est définitive.",
                onConfirm: () => handleDelete(id, title),
                closeOnConfirm: false
            });
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Documents.initiateDelete');
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!canEditResource(user, 'Document', selectedDocument?.ownerId || selectedDocument?.owner)) return;
        setConfirmData(prev => ({ ...prev, loading: true }));
        try {
            await deleteDoc(doc(db, 'documents', id));
            setSelectedDocument(null);
            await logAction(user, 'DELETE', 'Document', `Suppression: ${title}`);
            addToast("Document supprimé", "info");
            setConfirmData(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleDelete', 'DELETE_FAILED');
        } finally {
            setConfirmData(prev => ({ ...prev, loading: false }));
        }
    };

    const sendReviewReminder = async () => {
        if (!selectedDocument || !user) return;
        try {
            const link = `${window.location.origin}/#/documents`;
            const html = getDocumentReviewTemplate(selectedDocument.title, selectedDocument.owner, selectedDocument.nextReviewDate || new Date().toISOString(), link);

            await sendEmail(user, {
                to: usersList.find(u => u.displayName === selectedDocument.owner)?.email || selectedDocument.owner,
                subject: `Rappel de révision : ${selectedDocument.title}`,
                type: 'DOCUMENT_REVIEW',
                html
            });
            addToast("Rappel envoyé au propriétaire", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.sendReviewReminder', 'EMAIL_SEND_FAILED');
        }
    };

    const handleExportCSV = async () => {
        if (isExportingCSV) return;
        setIsExportingCSV(true);
        try {
            const headers = ["Titre", "Type", "Version", "Statut", "Propriétaire", "Prochaine Révision", "Fichier Joint"];
            const rows = filteredDocuments.map(d => [
                d.title,
                d.type,
                d.version,
                d.status,
                d.owner,
                d.nextReviewDate ? new Date(d.nextReviewDate).toLocaleDateString() : '',
                d.url ? 'Oui' : 'Non'
            ]);
            const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))].join('\n');
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
            link.download = `documents_export_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
        } finally {
            setTimeout(() => setIsExportingCSV(false), 0);
        }
    };

    const handleCreateFolder = async (name: string, parentId?: string) => {
        if (!user?.organizationId) return;
        try {
            await addDoc(collection(db, 'document_folders'), {
                organizationId: user.organizationId,
                name,
                parentId: parentId || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            addToast('Dossier créé', 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleCreateFolder', 'CREATE_FAILED');
        }
    };

    const handleUpdateFolder = async (id: string, name: string) => {
        try {
            await updateDoc(doc(db, 'document_folders', id), {
                name,
                updatedAt: new Date().toISOString()
            });
            addToast('Dossier renommé', 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleUpdateFolder', 'UPDATE_FAILED');
        }
    };

    const handleDeleteFolder = async (id: string) => {
        try {
            // Delete folder
            await deleteDoc(doc(db, 'document_folders', id));

            // Delete subfolders (recursive deletion would be better but for now flat check)
            const subfolders = rawFolders.filter(f => f.parentId === id);
            for (const sub of subfolders) {
                await deleteDoc(doc(db, 'document_folders', sub.id));
            }

            // Move documents to root (or delete them? Plan said move to root)
            const docsInFolder = documents.filter(d => d.folderId === id);
            for (const d of docsInFolder) {
                await updateDoc(doc(db, 'documents', d.id), { folderId: null });
            }

            if (selectedFolderId === id) setSelectedFolderId(null);
            addToast('Dossier supprimé', 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleDeleteFolder', 'DELETE_FAILED');
        }
    };

    const deferredFilter = useDeferredValue(filter);
    const filteredDocuments = useMemo(() => documents.filter(doc => {
        const needle = (deferredFilter || '').toLowerCase().trim();
        const matchesSearch = !needle || doc.title.toLowerCase().includes(needle) ||
            doc.type.toLowerCase().includes(needle) ||
            doc.owner.toLowerCase().includes(needle);
        const matchesFolder = selectedFolderId === null || doc.folderId === selectedFolderId;
        const matchesCategory = categoryFilter === 'all' || doc.type === categoryFilter;
        const matchesDigitalSafe = !isDigitalSafeMode || !!doc.isSecure;

        return matchesSearch && matchesFolder && matchesCategory && matchesDigitalSafe;
    }), [documents, deferredFilter, selectedFolderId, categoryFilter, isDigitalSafeMode]);

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'Publié': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50';
            case 'Approuvé': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50';
            case 'En revue': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/50';
            case 'Rejeté': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50';
            case 'Obsolète': return 'bg-gray-100 text-slate-700 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
            default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
        }
    };

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <div className="space-y-8 animate-fade-in pb-10 relative">
            <Helmet>
                <title>Gestion Documentaire - Sentinel GRC</title>
                <meta name="description" content="Centralisez et gérez le cycle de vie de vos politiques et procédures de sécurité." />
            </Helmet>
            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
                loading={confirmData.loading}
                closeOnConfirm={confirmData.closeOnConfirm}
            />

            <PageHeader
                title="Gestion Documentaire"
                subtitle="Politiques, procédures et preuves (ISO 27001 A.5.37)."
                breadcrumbs={[
                    { label: 'Documents' }
                ]}
                icon={<FileText className="h-6 w-6 text-white" strokeWidth={2.5} />}
                trustType="storage"
                actions={canCreate && (
                    <button
                        onClick={() => {
                            setShowCreateModal(true);
                        }}
                        className="flex items-center px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="h-4 w-4 mr-2" /> Nouveau Document
                    </button>
                )}
            />

            {/* Summary Card */}
            <div className="glass-panel p-6 md:p-7 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group min-w-0">
                <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>
                </div>

                {/* Global Score */}
                <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <svg className="w-24 h-24 transform -rotate-90" style={{ overflow: 'visible' }}>
                            <circle
                                className="text-slate-100 dark:text-slate-800"
                                strokeWidth="8"
                                stroke="currentColor"
                                fill="transparent"
                                r="44"
                                cx="48"
                                cy="48"
                            />
                            <circle
                                className={`${validationRate >= 80 ? 'text-emerald-500' : validationRate >= 50 ? 'text-blue-500' : 'text-amber-500'} transition-all duration-1000 ease-out`}
                                strokeWidth="8"
                                strokeDasharray={276}
                                strokeDashoffset={276 - (276 * validationRate) / 100}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="44"
                                cx="48"
                                cy="48"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-xl font-black text-slate-900 dark:text-white">{Math.round(validationRate)}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Documents Validés</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[200px]">
                            Pourcentage de documents publiés ou approuvés.
                        </p>
                    </div>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:border-l sm:border-r border-slate-200 dark:border-white/10 sm:px-6 sm:mx-2">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-slate-500" />
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{totalDocs}</div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-slate-500" />
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Publiés</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{publishedDocs}</div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Edit className="h-4 w-4 text-slate-500" />
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Brouillons</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{draftDocs}</div>
                    </div>
                </div>

                {/* Alerts/Status */}
                <div className="flex flex-col gap-3 w-full md:min-w-[180px]">
                    <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">En Revue</span>
                        </div>
                        <span className="text-sm font-black text-amber-700 dark:text-amber-400">{inReviewDocs}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-red-600 dark:text-red-400" />
                            <span className="text-xs font-bold text-red-700 dark:text-red-300">Expirés</span>
                        </div>
                        <span className="text-sm font-black text-red-700 dark:text-red-400">{expiredDocs}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 lg:min-h-[calc(100vh-200px)] min-h-0">
                {/* Sidebar - Folder Tree */}
                <div className="w-full lg:w-64 flex-shrink-0 glass-panel rounded-2xl border border-white/50 dark:border-white/5 shadow-sm overflow-hidden flex flex-col min-w-0">
                    <FolderTree
                        folders={folders}
                        selectedFolderId={selectedFolderId}
                        onSelectFolder={setSelectedFolderId}
                        onCreateFolder={handleCreateFolder}
                        onUpdateFolder={handleUpdateFolder}
                        onDeleteFolder={handleDeleteFolder}
                    />
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 flex flex-col gap-6 overflow-hidden">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        {/* Search & Filters */}
                        <div className="flex-1 w-full glass-panel p-1.5 pl-4 rounded-2xl flex flex-wrap items-center gap-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all border border-slate-200 dark:border-white/5 min-w-0">
                            <Search className="h-5 w-5 text-slate-500" />
                            <input type="text" placeholder="Rechercher un document..." className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 text-sm dark:text-white py-2.5 font-medium placeholder-gray-400"
                                value={filter} onChange={e => setFilter(e.target.value)} />
                            {filter && (
                                <button
                                    type="button"
                                    onClick={() => setFilter('')}
                                    className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"
                                    title="Effacer la recherche"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                            <div className="px-3 py-2 bg-gray-50 dark:bg-white/5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                                {filteredDocuments.length}
                            </div>
                            <button
                                onClick={handleExportCSV}
                                disabled={isExportingCSV}
                                className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Exporter CSV"
                            >
                                {isExportingCSV ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                            </button>
                        </div>

                        {/* View Toggles & Digital Safe */}
                        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <button
                                onClick={() => setIsDigitalSafeMode(!isDigitalSafeMode)}
                                className={`flex items-center px-3 py-2 rounded-xl text-sm font-bold transition-all ${isDigitalSafeMode ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-slate-600 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                            >
                                <ShieldCheck className={`h-4 w-4 mr-2 ${isDigitalSafeMode ? 'text-emerald-600' : ''}`} />
                                Coffre-fort
                            </button>
                            <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />
                            <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                                >
                                    <List className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Categories Tabs */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                        {['all', 'Politique', 'Procédure', 'Preuve', 'Rapport', 'Autre'].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${categoryFilter === cat
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-white/5'
                                    }`}
                            >
                                {cat === 'all' ? 'Tous' : cat}
                            </button>
                        ))}
                    </div>

                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {loading ? (
                                <div className="col-span-full"><CardSkeleton count={3} /></div>
                            ) : filteredDocuments.length === 0 ? (
                                <div className="col-span-full">
                                    <EmptyState
                                        icon={FileText}
                                        title="Aucun document"
                                        description={filter ? "Aucun document ne correspond à votre recherche." : "Centralisez vos politiques et procédures de sécurité."}
                                        actionLabel={filter ? undefined : "Nouveau Document"}
                                        onAction={filter ? undefined : () => {
                                            setShowCreateModal(true);
                                        }}
                                    />
                                </div>
                            ) : (
                                filteredDocuments.map(docItem => (
                                    <div key={docItem.id} onClick={() => openInspector(docItem)} className="glass-panel rounded-[2.5rem] p-7 shadow-sm card-hover cursor-pointer border border-white/50 dark:border-white/5 group flex flex-col">
                                        <div className="flex justify-between items-start mb-5">
                                            <div className="p-3 bg-blue-50 dark:bg-slate-900 dark:bg-slate-800 rounded-2xl text-blue-600 shadow-inner">
                                                <FileText className="h-6 w-6" />
                                            </div>
                                            <div className="flex gap-2">
                                                {docItem.isSecure && (
                                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50 flex items-center">
                                                        <ShieldCheck className="h-3 w-3 mr-1" /> Sécurisé
                                                    </span>
                                                )}
                                                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getStatusColor(docItem.status)}`}>{docItem.status}</span>
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight line-clamp-2">{docItem.title}</h3>
                                        <div className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-400 mb-6">
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md mr-2">v{docItem.version}</span>
                                            <span>{docItem.type}</span>
                                        </div>
                                        <div className="mt-auto pt-4 border-t border-dashed border-gray-200 dark:border-white/10 flex justify-between items-center">
                                            <div className="flex items-center text-xs text-slate-500 font-medium" title="Propriétaire">
                                                <Users className="h-3.5 w-3.5 mr-1.5" /> {docItem.owner}
                                            </div>
                                            {docItem.url && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (docItem.isSecure) {
                                                            handleSecureView(docItem);
                                                        } else {
                                                            window.open(docItem.url, '_blank');
                                                        }
                                                    }}
                                                    className="p-1 text-slate-300 hover:text-blue-500 transition-colors"
                                                >
                                                    {docItem.isSecure ? <ShieldCheck className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="glass-panel rounded-3xl overflow-hidden border border-slate-200 dark:border-white/5 shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-600">Titre</th>
                                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-600">Type</th>
                                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-600">Version</th>
                                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-600">Statut</th>
                                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-600">Propriétaire</th>
                                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-600 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={6}>
                                                    <TableSkeleton rows={5} columns={6} />
                                                </td>
                                            </tr>
                                        ) : filteredDocuments.length === 0 ? (
                                            <tr>
                                                <td colSpan={6}>
                                                    <EmptyState
                                                        icon={FileText}
                                                        title="Aucun document"
                                                        description={filter ? "Aucun document ne correspond à votre recherche." : "Centralisez vos politiques et procédures de sécurité."}
                                                        actionLabel={filter ? undefined : "Nouveau Document"}
                                                        onAction={filter ? undefined : () => {
                                                            setShowCreateModal(true);
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredDocuments.map(docItem => (
                                                <tr key={docItem.id} onClick={() => openInspector(docItem)} className="hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors group">
                                                    <td className="p-4">
                                                        <div className="flex items-center">
                                                            <div className="p-2 bg-blue-50 dark:bg-slate-900 dark:bg-slate-800 rounded-lg text-blue-600 mr-3">
                                                                <FileText className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 dark:text-white text-sm">{docItem.title}</div>
                                                                {docItem.isSecure && (
                                                                    <div className="flex items-center text-[10px] text-emerald-600 font-bold mt-0.5">
                                                                        <ShieldCheck className="h-3 w-3 mr-1" /> Sécurisé
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{docItem.type}</td>
                                                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">v{docItem.version}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(docItem.status)}`}>{docItem.status}</span>
                                                    </td>
                                                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                                                        <div className="flex items-center">
                                                            <Users className="h-3 w-3 mr-1.5 text-slate-500" />
                                                            {docItem.owner}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {docItem.url && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (docItem.isSecure) {
                                                                        handleSecureView(docItem);
                                                                    } else {
                                                                        window.open(docItem.url, '_blank');
                                                                    }
                                                                }}
                                                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                            >
                                                                {docItem.isSecure ? <ShieldCheck className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Inspector */}
            {
                selectedDocument && createPortal(
                    <div className="fixed inset-0 z-[9999] overflow-hidden">
                        <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setSelectedDocument(null)} />
                        <div className="absolute inset-y-0 right-0 left-0 sm:left-auto sm:pl-10 max-w-full flex pointer-events-none min-w-0">
                            <div className="w-full max-w-6xl pointer-events-auto min-w-0">
                                <div className="h-full flex flex-col bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border-l border-white/20 dark:border-white/5 animate-slide-up min-w-0">
                                    <div className="px-4 sm:px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-start justify-between bg-white/50 dark:bg-white/5">
                                        <div>
                                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">{selectedDocument.title}</h2>
                                            <p className="text-sm font-medium text-slate-600 mt-1">v{selectedDocument.version} • {selectedDocument.type}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {selectedDocument.isSecure && (
                                                <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50 flex items-center">
                                                    <ShieldCheck className="h-3 w-3 mr-1" /> Sécurisé
                                                </span>
                                            )}
                                            {selectedDocument.url && (
                                                <button
                                                    onClick={() => selectedDocument.isSecure ? handleSecureView(selectedDocument) : window.open(selectedDocument.url, '_blank')}
                                                    className="p-2.5 text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"
                                                    title={selectedDocument.isSecure ? "Consultation Sécurisée" : "Ouvrir"}
                                                >
                                                    {selectedDocument.isSecure ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <Eye className="h-5 w-5" />}
                                                </button>
                                            )}
                                            {canEditResource(user, 'Document', selectedDocument.ownerId || selectedDocument.owner) && !isEditing && (
                                                <button onClick={() => setIsEditing(true)} className="p-2.5 text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button>
                                            )}
                                            {canEditResource(user, 'Document', selectedDocument.ownerId || selectedDocument.owner) && isEditing && (
                                                <button onClick={() => setIsEditing(false)} className="p-2.5 text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><X className="h-5 w-5" /></button>
                                            )}
                                            {canEditResource(user, 'Document', selectedDocument.ownerId || selectedDocument.owner) && (
                                                <button onClick={() => initiateDelete(selectedDocument.id, selectedDocument.title)} className="p-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button>
                                            )}
                                            <button onClick={() => setSelectedDocument(null)} className="p-2.5 text-slate-500 hover:text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors"><X className="h-5 w-5" /></button>
                                        </div>
                                    </div>

                                    <div className="px-4 sm:px-8 border-b border-gray-100 dark:border-white/5 bg-white/30 dark:bg-white/5">
                                        <ScrollableTabs
                                            tabs={[
                                                { id: 'details', label: 'Détails', icon: File },
                                                { id: 'versions', label: 'Versions', icon: History },
                                                { id: 'history', label: 'Activité', icon: List },
                                                { id: 'comments', label: 'Discussion', icon: MessageSquare },
                                            ]}
                                            activeTab={inspectorTab}
                                            onTabChange={(id) => setInspectorTab(id as InspectorTab)}
                                        />
                                    </div>

                                    <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar">
                                        {inspectorTab === 'details' && (
                                            <div className="space-y-8">
                                                {isEditing ? (
                                                    <DocumentForm
                                                        onSubmit={handleUpdate}
                                                        onCancel={() => setIsEditing(false)}
                                                        initialData={selectedDocument}
                                                        users={usersList}
                                                        controls={controls}
                                                        assets={assets}
                                                        audits={audits}
                                                        risks={risks}
                                                        folders={rawFolders}
                                                        isLoading={isSubmitting}
                                                        isStorageFull={isStorageFull}
                                                        onUploadComplete={handleUploadSuccess}
                                                    />
                                                ) : (
                                                    <>
                                                        <div className="grid grid-cols-2 gap-6">
                                                            <div className="p-5 bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm">
                                                                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1 tracking-wide">Propriétaire</span>
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedDocument.owner}</span>
                                                            </div>
                                                            <div className="p-5 bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm">
                                                                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1 tracking-wide">Dernière MAJ</span>
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{new Date(selectedDocument.updatedAt).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>

                                                        {/* Description / Content */}
                                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                                                <FileText className="h-5 w-5 text-blue-500" />
                                                                Contenu / Description
                                                            </h3>
                                                            {selectedDocument.content ? (
                                                                <SafeHTML content={selectedDocument.content} />
                                                            ) : (
                                                                <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                                    {selectedDocument.description || "Aucune description."}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Workflow Actions */}
                                                        <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Workflow de Validation</h4>

                                                            {/* Status Steps */}
                                                            <div className="flex items-center justify-between mb-6 relative">
                                                                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-200 dark:bg-gray-700 -z-10" />
                                                                {['Brouillon', 'En revue', 'Approuvé', 'Publié'].map((step, idx) => {
                                                                    const isCompleted = ['Brouillon', 'En revue', 'Approuvé', 'Publié'].indexOf(selectedDocument.status) >= idx;
                                                                    const isCurrent = selectedDocument.status === step;
                                                                    return (
                                                                        <div key={step} className="flex flex-col items-center bg-white dark:bg-slate-900 px-2">
                                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isCompleted ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-slate-300'}`}>
                                                                                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                                                                            </div>
                                                                            <span className={`text-[10px] font-bold mt-2 uppercase tracking-wide ${isCurrent ? 'text-blue-600' : 'text-slate-500'}`}>{step}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <div className="flex flex-wrap gap-3">
                                                                {selectedDocument.status === 'Brouillon' && canEditResource(user, 'Document', selectedDocument.ownerId || selectedDocument.owner) && (
                                                                    <button onClick={() => handleWorkflowAction('submit')} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
                                                                        Soumettre pour revue
                                                                    </button>
                                                                )}
                                                                {selectedDocument.status === 'En revue' && (
                                                                    <>
                                                                        <button onClick={() => handleWorkflowAction('approve')} disabled={!canEditResource(user, 'Document', selectedDocument.ownerId || selectedDocument.owner) && !(user?.uid && selectedDocument.approvers?.includes(user.uid))} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                                                                            <CheckCircle2 className="h-4 w-4 mr-2" /> Approuver
                                                                        </button>
                                                                        <button onClick={() => handleWorkflowAction('reject')} disabled={!canEditResource(user, 'Document', selectedDocument.ownerId || selectedDocument.owner) && !(user?.uid && selectedDocument.approvers?.includes(user.uid))} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                                                                            <X className="h-4 w-4 mr-2" /> Rejeter
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {selectedDocument.status === 'Approuvé' && (
                                                                    <button onClick={() => handleWorkflowAction('sign')} disabled={!canEditResource(user, 'Document', selectedDocument.ownerId || selectedDocument.owner) && !(user?.uid && selectedDocument.approvers?.includes(user.uid))} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/20 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                                                                        <ShieldCheck className="h-4 w-4 mr-2" /> Signer & Publier
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {selectedDocument.signatures && selectedDocument.signatures.length > 0 && (
                                                                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-white/10">
                                                                    <h5 className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wide">Signatures</h5>
                                                                    <div className="space-y-2">
                                                                        {selectedDocument.signatures.map((sig, i) => (
                                                                            <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-white/5">
                                                                                <div className="flex items-center">
                                                                                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center mr-3">
                                                                                        <ShieldCheck className="h-4 w-4" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-xs font-bold text-slate-900 dark:text-white">Signé par {usersList.find(u => u.uid === sig.userId)?.displayName || 'Utilisateur inconnu'}</p>
                                                                                        <p className="text-[10px] text-slate-600">{new Date(sig.date).toLocaleString()}</p>
                                                                                    </div>
                                                                                </div>
                                                                                <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded text-slate-600">{sig.role}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Révision</h4>
                                                                {selectedDocument.nextReviewDate && (
                                                                    <span className={`text-xs font-bold ${new Date(selectedDocument.nextReviewDate) < new Date() ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                        {new Date(selectedDocument.nextReviewDate).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button onClick={sendReviewReminder} className="w-full py-3 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center border border-slate-200 dark:border-white/5">
                                                                <Bell className="h-3.5 w-3.5 mr-2" /> Envoyer rappel de révision
                                                            </button>
                                                            <div className="w-full mt-2">
                                                                {selectedDocument.nextReviewDate && (
                                                                    <AddToCalendar
                                                                        event={{
                                                                            title: `Révision : ${selectedDocument.title}`,
                                                                            description: `Révision du document ${selectedDocument.title} (v${selectedDocument.version})`,
                                                                            start: new Date(selectedDocument.nextReviewDate),
                                                                            end: new Date(new Date(selectedDocument.nextReviewDate).getTime() + 60 * 60 * 1000),
                                                                            location: 'Sentinel GRC'
                                                                        }}
                                                                        className="w-full [&>button]:w-full [&>button]:justify-center"
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="p-6 bg-blue-50/50 dark:bg-slate-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-sm flex items-center justify-between">
                                                            <div className="flex items-center text-blue-700 dark:text-blue-300 text-sm font-bold">
                                                                <LinkIcon className="h-4 w-4 mr-3" /> Fichier Joint
                                                            </div>
                                                            {selectedDocument.url ? (
                                                                <a href={selectedDocument.url} target="_blank" rel="noreferrer" className="text-xs font-bold bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm hover:text-blue-600 transition-colors">
                                                                    Télécharger
                                                                </a>
                                                            ) : <span className="text-xs text-slate-500 italic">Aucun fichier</span>}
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-6">
                                                            <div className="bg-white dark:bg-slate-800/50 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Contrôles Liés</h4>
                                                                <div className="space-y-1">
                                                                    {selectedDocument.relatedControlIds?.map(cid => {
                                                                        const c = controls.find(x => x.id === cid);
                                                                        return c ? <div key={cid} className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded">{c.code}</div> : null;
                                                                    })}
                                                                    {(!selectedDocument.relatedControlIds || selectedDocument.relatedControlIds.length === 0) && <span className="text-xs text-slate-500 italic">Aucun</span>}
                                                                </div>
                                                            </div>
                                                            <div className="bg-white dark:bg-slate-800/50 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Actifs Liés</h4>
                                                                <div className="space-y-1">
                                                                    {selectedDocument.relatedAssetIds?.map(aid => {
                                                                        const a = assets.find(x => x.id === aid);
                                                                        return a ? <div key={aid} className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded">{a.name}</div> : null;
                                                                    })}
                                                                    {(!selectedDocument.relatedAssetIds || selectedDocument.relatedAssetIds.length === 0) && <span className="text-xs text-slate-500 italic">Aucun</span>}
                                                                </div>
                                                            </div>
                                                            <div className="bg-white dark:bg-slate-800/50 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Audits Liés</h4>
                                                                <div className="space-y-1">
                                                                    {selectedDocument.relatedAuditIds?.map(aid => {
                                                                        const a = audits.find(x => x.id === aid);
                                                                        return a ? <div key={aid} className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded">{a.name}</div> : null;
                                                                    })}
                                                                    {(!selectedDocument.relatedAuditIds || selectedDocument.relatedAuditIds.length === 0) && <span className="text-xs text-slate-500 italic">Aucun</span>}
                                                                </div>
                                                            </div>
                                                            <div className="bg-white dark:bg-slate-800/50 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Risques Liés</h4>
                                                                <div className="space-y-1">
                                                                    {selectedDocument.relatedRiskIds?.map(rid => {
                                                                        const r = risks.find(x => x.id === rid);
                                                                        return r ? <div key={rid} className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded">{r.threat}</div> : null;
                                                                    })}
                                                                    {(!selectedDocument.relatedRiskIds || selectedDocument.relatedRiskIds.length === 0) && <span className="text-xs text-slate-500 italic">Aucun</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}



                                        {inspectorTab === 'versions' && (
                                            <div className="space-y-4 animate-fade-in">
                                                {versions.length === 0 ? (
                                                    <EmptyState
                                                        icon={History}
                                                        title="Aucune version"
                                                        description="Ce document n'a pas d'historique de versions."
                                                    />
                                                ) : (
                                                    <div className="space-y-3">
                                                        {versions.map((version) => (
                                                            <div key={version.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                                                        <FileText className="h-4 w-4" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">Version {version.version}</p>
                                                                        <p className="text-xs text-slate-600">
                                                                            Par {usersList.find(u => u.uid === version.uploadedBy)?.displayName || 'Utilisateur inconnu'} • {new Date(version.uploadedAt).toLocaleDateString()}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => window.open(version.url, '_blank')}
                                                                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                                    title="Télécharger"
                                                                >
                                                                    <ExternalLink className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {inspectorTab === 'history' && (
                                            <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                                {docHistory.length === 0 ? <p className="text-sm text-slate-600 pl-6">Aucun historique.</p> :
                                                    docHistory.map((log, i) => (
                                                        <div key={i} className="relative">
                                                            <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-900">
                                                                <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                                                            </span>
                                                            <div>
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{log.details}</p>
                                                                <p className="text-[10px] text-slate-500 mt-1">Par: {log.userEmail}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}

                                        {inspectorTab === 'comments' && (
                                            <div className="h-full flex flex-col">
                                                <Comments collectionName="documents" documentId={selectedDocument.id} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {/* Create Modal */}
            {
                showCreateModal && createPortal(
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-4xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-blue-50/30 dark:bg-slate-900/10">
                                <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 tracking-tight">Nouveau Document</h2>
                            </div>
                            <div className="p-8 overflow-y-auto custom-scrollbar">
                                <DocumentForm
                                    onSubmit={handleCreate}
                                    onCancel={() => setShowCreateModal(false)}
                                    users={usersList}
                                    controls={controls}
                                    assets={assets}
                                    audits={audits}
                                    risks={risks}
                                    folders={folders}
                                    isLoading={isSubmitting}
                                    isStorageFull={isStorageFull}
                                    onUploadComplete={handleUploadSuccess}
                                />
                            </div>
                        </div>
                    </div >,
                    document.body
                )
            }

            {/* File Preview Modal */}
            {
                previewFile && (
                    <FilePreview
                        url={previewFile.url}
                        fileName={previewFile.name}
                        fileType={previewFile.type}
                        onClose={() => setPreviewFile(null)}
                        onDownload={() => {
                            const link = document.createElement('a');
                            link.href = previewFile.url;
                            link.download = previewFile.name;
                            link.click();
                        }}
                    />
                )
            }
            {/* Signature Modal */}
            {
                showSignatureModal && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl w-full max-w-md border border-white/10">
                            <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Signature Requise</h3>
                            <p className="text-sm text-slate-600 mb-4">Veuillez apposer votre signature pour valider ce document.</p>
                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl mb-6 bg-white overflow-hidden">
                                <SignatureCanvas
                                    ref={signaturePadRef}
                                    canvasProps={{ className: 'w-full h-48', style: { width: '100%', height: '192px' } }}
                                    velocityFilterWeight={0.7}
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => signaturePadRef.current?.clear()} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Effacer</button>
                                <button onClick={() => setShowSignatureModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Annuler</button>
                                <button onClick={handleSignatureSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">Signer & Valider</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};
