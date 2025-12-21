import { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc, where, increment, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { Document, DocumentFolder, UserProfile, Control } from '../../types';
import { DocumentFormData } from '../../schemas/documentSchema';
import { sanitizeData } from '../../utils/dataSanitizer';
import { logAction } from '../../services/logger';
import { ErrorLogger } from '../../services/errorLogger';
import { useStore } from '../../store';
import { canEditResource } from '../../utils/permissions';
import { EncryptionService } from '../../services/encryptionService';
import { CsvParser } from '../../utils/csvUtils';
import { getDocumentReviewTemplate } from '../../services/emailTemplates';
import { sendEmail } from '../../services/emailService';

export const useDocumentActions = () => {
    const { user, addToast } = useStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);

    // Confirm Dialog State (managed here or passed down? Managed here for actions involving confirmation)
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; loading?: boolean; closeOnConfirm?: boolean }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const handleCreate = async (data: DocumentFormData & { fileUrl?: string; fileHash?: string; isSecure?: boolean }) => {
        if (!user || !user.organizationId) return false;
        if (!canEditResource(user, 'Document')) return false;

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
            return true;
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Documents.handleCreate');
            return false;
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

            const updates = {
                ...data,
                url: newUrl,
                hash: data.fileHash || currentDoc.hash,
                isSecure: data.isSecure ?? currentDoc.isSecure,
                // Encrypt description if Secure Mode is ON (either new or existing)
                description: (data.isSecure ?? currentDoc.isSecure)
                    ? EncryptionService.encrypt(data.description || '')
                    : (data.description || ''),
                watermarkEnabled: (data.isSecure ?? currentDoc.isSecure) || false,
                updatedAt: new Date().toISOString()
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
                    uploadedAt: new Date().toISOString(),
                    changeLog: 'Mise à jour'
                });
            }

            await logAction(user, 'UPDATE', 'Document', `MAJ document: ${data.title}`);
            addToast("Document mis à jour", "success");
            return { ...currentDoc, ...updates };
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleUpdate', 'UPDATE_FAILED');
            return null;
        } finally {
            setIsSubmitting(false);
        }
    };

    const initiateDelete = async (docItem: Document, controls: Control[] = []) => {
        // Check permissions
        if (!user || !canEditResource(user, 'Document', docItem.ownerId || docItem.owner)) return;

        // Check for dependencies (Data Integrity)
        try {
            const id = docItem.id;

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
                onConfirm: async () => await handleDelete(id, docItem.title),
                closeOnConfirm: false
            });
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Documents.initiateDelete');
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!user) return;
        setConfirmData(prev => ({ ...prev, loading: true }));
        try {
            await deleteDoc(doc(db, 'documents', id));
            await logAction(user, 'DELETE', 'Document', `Suppression: ${title}`);
            addToast("Document supprimé", "info");
            setConfirmData(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleDelete', 'DELETE_FAILED');
        } finally {
            setConfirmData(prev => ({ ...prev, loading: false }));
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

    const handleDeleteFolder = async (id: string, rawFolders: DocumentFolder[], documents: Document[], selectedFolderId: string | null, setSelectedFolderId: (id: string | null) => void) => {
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

            if (selectedFolderId === id) setSelectedFolderId(null);
            addToast('Dossier supprimé', 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleDeleteFolder', 'DELETE_FAILED');
        }
    };

    const handleUploadSuccess = async (size: number) => {
        if (size && user?.organizationId) {
            const orgRef = doc(db, 'organizations', user.organizationId);
            updateDoc(orgRef, {
                storageUsed: increment(size)
            }).catch(e => ErrorLogger.error(e, "Documents.handleUploadSuccess"));
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

            CsvParser.exportToCsv(
                exportData,
                `documents_export_${new Date().toISOString().split('T')[0]}`,
                ['title', 'type', 'version', 'status', 'owner', 'nextReviewDate', 'url']
            );
            if (user) await logAction(user, 'EXPORT', 'Documents', `Exported ${documents.length} documents`);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleExportCSV');
        } finally {
            setTimeout(() => setIsExportingCSV(false), 0);
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
        isSubmitting,
        isExportingCSV,
        confirmData,
        setConfirmData
    };
};
