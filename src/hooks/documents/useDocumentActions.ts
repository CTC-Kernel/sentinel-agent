import { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Document, DocumentFolder, UserProfile } from '../../types';
import { DocumentFormData } from '../../schemas/documentSchema';
import { sanitizeData } from '../../utils/dataSanitizer';
import { AuditLogService } from '../../services/auditLogService';
import { ErrorLogger } from '../../services/errorLogger';
import { DocumentService } from '../../services/documentService';
import { useStore } from '../../store';
import { canEditResource, canDeleteResource } from '../../utils/permissions';
import { EncryptionService } from '../../services/encryptionService';
import { ImportService } from '../../services/ImportService';
import { getDocumentReviewTemplate } from '../../services/emailTemplates';
import { sendEmail } from '../../services/emailService';

const normalizeUserIds = (ids: string[] | undefined, usersList: UserProfile[]) => {
    if (!ids || ids.length === 0) return [];
    const allowed = new Set(usersList.map(u => u.uid));
    return Array.from(new Set(ids.filter(id => allowed.has(id))));
};

const resolveOwner = (ownerId: string | undefined, usersList: UserProfile[]) => {
    if (!ownerId) return null;
    return usersList.find(u => u.uid === ownerId) || null;
};

export const useDocumentActions = (usersList: UserProfile[] = []) => {
    const { user, addToast } = useStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);

    // Confirm Dialog State
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; loading?: boolean; closeOnConfirm?: boolean }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const handleCreate = async (data: DocumentFormData & { fileUrl?: string; fileHash?: string; isSecure?: boolean }) => {
        if (!user || !user.organizationId) return false;
        if (!canEditResource(user, 'Document')) return false;

        setIsSubmitting(true);

        try {
            const ownerProfile = resolveOwner(data.ownerId, usersList);
            if (data.ownerId && !ownerProfile) {
                throw new Error("Propriétaire introuvable dans votre organisation");
            }
            // Prepare Document Data (extracted logic)
            const docData = {
                ...data,
                owner: ownerProfile ? (ownerProfile.displayName || ownerProfile.email || '') : (data.owner || ''),
                ownerId: ownerProfile?.uid || '',
                reviewers: normalizeUserIds(data.reviewers, usersList),
                approvers: normalizeUserIds(data.approvers, usersList),
                readBy: normalizeUserIds(data.readBy, usersList),
                url: data.storageProvider !== 'firebase' ? data.externalUrl : (data.fileUrl || ''),
                hash: data.fileHash || '',
                isSecure: data.isSecure || false,
                description: (data.isSecure || false) ? EncryptionService.encrypt(data.description || '') : (data.description || ''),
                watermarkEnabled: data.isSecure || false,
                organizationId: user.organizationId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
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
                    uploadedAt: serverTimestamp(),
                    changeLog: 'Création initiale'
                });
            }

            await AuditLogService.logCreate(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
                'document',
                docRef.id,
                sanitizeData(docData) as Record<string, unknown>,
                `Nouveau document: ${data.title}`
            );

            addToast("Document ajouté", "success");
            return docRef.id;
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Documents.handleCreate');
            return null;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async (id: string, data: DocumentFormData & { fileUrl?: string; fileHash?: string; isSecure?: boolean }, currentDoc: Document) => {
        if (!user) return false;
        if (!canEditResource(user, 'Document', currentDoc.ownerId || currentDoc.owner)) return false;

        setIsSubmitting(true);
        try {
            const newUrl = data.storageProvider !== 'firebase' ? data.externalUrl : (data.fileUrl || currentDoc.url);
            const ownerProfile = resolveOwner(data.ownerId, usersList) || resolveOwner(currentDoc.ownerId, usersList);
            if ((data.ownerId || currentDoc.ownerId) && !ownerProfile) {
                throw new Error("Propriétaire introuvable dans votre organisation");
            }
            const sanitizedReviewers = normalizeUserIds(data.reviewers ?? currentDoc.reviewers, usersList);
            const sanitizedApprovers = normalizeUserIds(data.approvers ?? currentDoc.approvers, usersList);
            const sanitizedReadBy = normalizeUserIds(data.readBy ?? currentDoc.readBy, usersList);

            const updates = {
                ...data,
                owner: ownerProfile ? (ownerProfile.displayName || ownerProfile.email || '') : (data.owner || currentDoc.owner),
                ownerId: ownerProfile?.uid || currentDoc.ownerId || '',
                reviewers: sanitizedReviewers,
                approvers: sanitizedApprovers,
                readBy: sanitizedReadBy,
                url: newUrl,
                hash: data.fileHash || currentDoc.hash,
                isSecure: data.isSecure ?? currentDoc.isSecure,
                // Encrypt description if Secure Mode is ON (either new or existing)
                description: (data.isSecure ?? currentDoc.isSecure)
                    ? EncryptionService.encrypt(data.description || '')
                    : (data.description || ''),
                watermarkEnabled: (data.isSecure ?? currentDoc.isSecure) || false,
                updatedAt: serverTimestamp()
            };

            await updateDoc(doc(db, 'documents', id), sanitizeData(updates));

            // Create new version if version number or file changed
            if (data.version !== currentDoc.version || newUrl !== currentDoc.url) {
                await addDoc(collection(db, 'document_versions'), {
                    documentId: id,
                    version: data.version,
                    url: newUrl || '',
                    hash: updates.hash || '',
                    uploadedBy: user?.uid,
                    uploadedAt: serverTimestamp(),
                    changeLog: 'Mise à jour'
                });
            }

            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
                'document',
                id,
                currentDoc as unknown as Record<string, unknown>,
                updates as Record<string, unknown>,
                data.title
            );

            addToast("Document mis à jour", "success");
            return { ...currentDoc, ...updates };
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleUpdate', 'UPDATE_FAILED');
            return null;
        } finally {
            setIsSubmitting(false);
        }
    };

    const initiateDelete = async (docItem: Document) => {
        if (!user?.organizationId || !canEditResource(user, 'Document', docItem.ownerId || docItem.owner)) return;

        try {
            // Use DocumentService to check dependencies
            const dependencies = await DocumentService.checkDependencies(
                docItem.id,
                user.organizationId
            );

            setConfirmData({
                isOpen: true,
                title: "Supprimer le document ?",
                message: dependencies.message,
                onConfirm: async () => await handleDelete(docItem.id, docItem.title),
                closeOnConfirm: false
            });
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Documents.initiateDelete');
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!user?.organizationId || !user?.uid) return;
        // Strict RBAC check for deletion
        if (!canDeleteResource(user, 'Document')) {
            addToast('Permission refusée', 'error');
            return;
        }

        setConfirmData(prev => ({ ...prev, loading: true }));
        try {
            // Use DocumentService for cascade deletion with dependency cleanup
            await DocumentService.deleteDocumentWithCascade({
                documentId: id,
                documentTitle: title,
                organizationId: user.organizationId,
                user
            });

            await AuditLogService.logDelete(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
                'document',
                id,
                { id, title },
                title
            );

            addToast("Document et liens supprimés", "info");
            setConfirmData(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleDelete', 'DELETE_FAILED');
        } finally {
            setConfirmData(prev => ({ ...prev, loading: false }));
        }
    };

    const handleCreateFolder = async (name: string, parentId?: string) => {
        if (!user?.organizationId) return;
        if (!canEditResource(user, 'Document')) return; // RBAC Check

        try {
            const docRef = await addDoc(collection(db, 'document_folders'), {
                organizationId: user.organizationId,
                name,
                parentId: parentId || null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            await AuditLogService.logCreate(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
                'document',
                docRef.id,
                { name, parentId, type: 'folder' },
                name
            );

            addToast('Dossier créé', 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleCreateFolder', 'CREATE_FAILED');
        }
    };

    const handleUpdateFolder = async (id: string, name: string, folderOrganizationId?: string) => {
        if (!user?.organizationId) return;
        if (!canEditResource(user, 'Document')) return; // RBAC Check

        // SECURITY: IDOR protection - verify folder belongs to user's organization
        if (folderOrganizationId && folderOrganizationId !== user.organizationId) {
            ErrorLogger.warn('IDOR attempt: folder update across organizations', 'useDocumentActions.handleUpdateFolder', {
                metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: folderOrganizationId, callerOrg: user.organizationId }
            });
            addToast('Dossier non trouvé', 'error');
            return;
        }

        try {
            await updateDoc(doc(db, 'document_folders', id), {
                name,
                updatedAt: serverTimestamp()
            });

            await AuditLogService.logUpdate(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
                'document',
                id,
                { name: 'Unknown', type: 'folder' },
                { name, type: 'folder' },
                name
            );

            addToast('Dossier renommé', 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleUpdateFolder', 'UPDATE_FAILED');
        }
    };

    const handleDeleteFolder = async (id: string, rawFolders: DocumentFolder[], documents: Document[], selectedFolderId: string | null, setSelectedFolderId: (id: string | null) => void) => {
        if (!user?.organizationId) return;
        if (!canDeleteResource(user, 'Document')) {
            addToast('Permission refusée', 'error');
            return;
        }

        // SECURITY: IDOR protection - verify folder belongs to user's organization
        const folder = rawFolders.find(f => f.id === id);
        if (!folder || folder.organizationId !== user.organizationId) {
            ErrorLogger.warn('IDOR attempt: folder deletion across organizations', 'useDocumentActions.handleDeleteFolder', {
                metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: folder?.organizationId, callerOrg: user.organizationId }
            });
            addToast('Dossier non trouvé', 'error');
            return;
        }

        try {
            // Delete folder
            await deleteDoc(doc(db, 'document_folders', id));

            // Delete subfolders (recursive deletion would be better but for now flat check like original)
            const subfolders = rawFolders.filter(f => f.parentId === id);
            for (const sub of subfolders) {
                await deleteDoc(doc(db, 'document_folders', sub.id));
            }

            // Move documents to root
            const docsInFolder = documents.filter(d => d.folderId === id);
            for (const d of docsInFolder) {
                await updateDoc(doc(db, 'documents', d.id), { folderId: null });
            }

            await AuditLogService.logDelete(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
                'document',
                id,
                folder as unknown as Record<string, unknown>,
                folder.name
            );

            if (selectedFolderId === id) setSelectedFolderId(null);
            addToast('Dossier supprimé', 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleDeleteFolder', 'DELETE_FAILED');
        }
    };

    const handleUploadSuccess = async (size: number) => {
        if (size && user?.organizationId) {
            const orgRef = doc(db, 'organizations', user.organizationId);
            try {
                await updateDoc(orgRef, {
                    storageUsed: increment(size)
                });
            } catch (e) {
                ErrorLogger.error(e, "Documents.handleUploadSuccess");
            }
        }
    };

    const sendReviewReminder = async (docItem: Document, usersList: UserProfile[]) => {
        if (!docItem || !user) return;
        try {
            const link = `${window.location.origin}/#/documents`;
            const html = getDocumentReviewTemplate(docItem.title, docItem.owner, docItem.nextReviewDate || new Date().toISOString(), link);

            await sendEmail(user, {
                to: usersList.find(u => u.displayName === docItem.owner)?.email || docItem.owner,
                subject: `Rappel de révision : ${docItem.title}`,
                type: 'DOCUMENT_REVIEW',
                html
            });
            addToast("Rappel envoyé au propriétaire", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.sendReviewReminder', 'EMAIL_SEND_FAILED');
        }
    };

    const handleExportCSV = async (documents: Document[]) => {
        if (isExportingCSV) return;
        setIsExportingCSV(true);
        try {
            // Decrypt descriptions for export if needed, or just export basic fields
            const exportData = documents.map(d => ({
                ...d,
                description: EncryptionService.decrypt(d.description || '')
            }));

            ImportService.exportDocuments(exportData);
            if (user?.organizationId) {
                await AuditLogService.log({
                    organizationId: user.organizationId,
                    userId: user.uid,
                    userName: user.displayName || user.email || 'Unknown',
                    userEmail: user.email || '',
                    action: 'export',
                    entityType: 'document',
                    entityId: 'bulk',
                    details: `Exported ${documents.length} documents`
                });
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleExportCSV');
        } finally {
            setTimeout(() => setIsExportingCSV(false), 0);
        }
    }

    const importDocuments = async (csvContent: string) => {
        if (!user?.organizationId) return;
        if (!canEditResource(user, 'Document')) {
            addToast('Permission refusée', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const lines = ImportService.parseCSV(csvContent);
            if (lines.length === 0) {
                addToast("Fichier vide ou invalide", "error");
                return;
            }

            const count = await DocumentService.importDocumentsFromCSV(
                lines,
                user.organizationId,
                user
            );

            await AuditLogService.logImport(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
                'document',
                count,
                'CSV Import'
            );

            addToast(`Import de ${count} documents réussi`, "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useDocumentActions.importDocuments');
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        handleCreate,
        handleUpdate,
        initiateDelete,
        handleCreateFolder,
        handleUpdateFolder,
        handleDeleteFolder,
        handleUploadSuccess,
        sendReviewReminder,
        handleExportCSV,
        importDocuments,
        isSubmitting,
        isExportingCSV,
        confirmData,
        setConfirmData
    };
};
