import { useState, useRef } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Document, UserProfile } from '../../types';
import { logAction } from '../../services/logger';
import { ErrorLogger } from '../../services/errorLogger';
import { useStore } from '../../store';
import { canEditResource } from '../../utils/permissions';
import { validateUrl } from '../../utils/urlValidation';
// EncryptionService import removed
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import CryptoJS from 'crypto-js';
import SignatureCanvas from 'react-signature-canvas';

export const useDocumentWorkflow = (usersList: UserProfile[]) => {
    const { user, addToast, t } = useStore();
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const signaturePadRef = useRef<SignatureCanvas>(null);

    const handleWorkflowAction = async (docItem: Document, action: 'submit' | 'approve' | 'reject' | 'sign', signatureImage?: string) => {
        if (!docItem || !user) return;

        const isOwnerOrAdmin = canEditResource(user, 'Document', docItem.ownerId || docItem.owner);
        const isApprover = docItem.approvers?.includes(user.uid);

        if (action === 'submit' && !isOwnerOrAdmin) return;
        if ((action === 'approve' || action === 'reject') && (!isApprover && !isOwnerOrAdmin)) return;
        if (action === 'sign' && (!isApprover && !isOwnerOrAdmin)) return;

        // If signing and no image, open modal
        if (action === 'sign' && !signatureImage) {
            setSelectedDocument(docItem);
            setShowSignatureModal(true);
            return;
        }

        let updates: Partial<Document> = {};
        let logMsg = '';

        if (action === 'submit') {
            updates = { status: 'En revue', workflowStatus: 'Review' };
            logMsg = t('documents.workflow.submittedForReview', { defaultValue: 'Document soumis pour revue' });
        } else if (action === 'approve') {
            updates = { status: 'Approuvé', workflowStatus: 'Approved' };
            logMsg = t('documents.workflow.approved', { defaultValue: 'Document approuvé' });
        } else if (action === 'reject') {
            updates = { status: 'Rejeté', workflowStatus: 'Rejected' };
            logMsg = t('documents.workflow.rejected', { defaultValue: 'Document rejeté' });
        } else if (action === 'sign') {
            const newSignature = {
                userId: user.uid,
                date: new Date().toISOString(),
                role: user.role,
                signatureImage: signatureImage
            };
            const currentSignatures = docItem.signatures || [];
            updates = {
                status: 'Publié',
                workflowStatus: 'Approved',
                signatures: [...currentSignatures, newSignature]
            };
            logMsg = t('documents.workflow.signedAndPublished', { defaultValue: 'Document signé et publié' });
        }

        try {
            await updateDoc(doc(db, 'documents', docItem.id), { ...updates, updatedAt: serverTimestamp() });
            await logAction(user, 'WORKFLOW', 'Document', `${logMsg}: ${docItem.title}`);

            const updatedDoc = { ...docItem, ...updates };
            if (selectedDocument?.id === docItem.id) {
                setSelectedDocument(updatedDoc);
            }
            const contextualMessages: Record<string, string> = {
                'Approuvé': t('documents.workflow.approvedGuidance', { defaultValue: 'Document approuvé. Le propriétaire peut maintenant le publier.' }),
                'Publié': t('documents.workflow.publishedGuidance', { defaultValue: 'Document publié et disponible pour l\'équipe.' }),
            };
            addToast(contextualMessages[updates.status as string] || logMsg, "success");
            return updatedDoc;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Documents.handleWorkflowAction', 'UPDATE_FAILED');
            return null;
        }
    };

    const handleSignatureSubmit = async () => {
        if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
            addToast(t('documents.toast.signBeforeValidation', { defaultValue: "Veuillez signer avant de valider" }), "info");
            return;
        }

        if (!selectedDocument) return;

        const signatureImage = signaturePadRef.current.toDataURL(); // base64 png
        await handleWorkflowAction(selectedDocument, 'sign', signatureImage);
        setShowSignatureModal(false);
        // Don't clear selectedDocument here necessarily, as typically it's open in inspector
    };

    const handleSecureView = async (docItem: Document) => {
        if (!docItem.url) return;
        addToast(t('documents.toast.preparingSecureDoc', { defaultValue: "Préparation du document sécurisé..." }), "info");

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
                    addToast(t('documents.toast.integrityCompromised', { defaultValue: "ALERTE : L'intégrité du document est compromise ! Le hash ne correspond pas." }), "error");
                    // We allow viewing but with a warning
                } else {
                    addToast(t('documents.toast.integrityVerified', { defaultValue: "Intégrité du document vérifiée." }), "success");
                }
            }

            // 3. Watermark & Certificate (if PDF)
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
                    const { height: pageHeight } = page.getSize();
                    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

                    page.drawText('CERTIFICAT DE SIGNATURE ÉLECTRONIQUE', { x: 50, y: pageHeight - 50, size: 20, font: font, color: rgb(0, 0, 0.5) });

                    let yOffset = pageHeight - 100;
                    page.drawText(`Document : ${docItem.title}`, { x: 50, y: yOffset, size: 12, font: fontRegular });
                    yOffset -= 20;
                    page.drawText(`Hash (SHA-256) : ${docItem.hash || 'N/A'}`, { x: 50, y: yOffset, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
                    yOffset -= 40;

                    for (const sig of docItem.signatures) {
                        const signUser = usersList.find(u => u.uid === sig.userId);
                        page.drawText(`Signataire : ${signUser?.displayName || sig.userId}`, { x: 50, y: yOffset, size: 14, font: font });
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
                const safeUrl = validateUrl(url); if (safeUrl) window.open(safeUrl, '_blank'); // validateUrl checked
            } else {
                // Non-PDF
                const blob = new Blob([arrayBuffer], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const safeUrl = validateUrl(url); if (safeUrl) window.open(safeUrl, '_blank'); // validateUrl checked
            }

            if (user) await logAction(user, 'VIEW', 'Document', `Consultation sécurisée: ${docItem.title}`);

        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Documents.handleSecureView');
        }
    };

    return {
        selectedDocument,
        setSelectedDocument,
        showSignatureModal,
        setShowSignatureModal,
        signaturePadRef,
        handleWorkflowAction,
        handleSignatureSubmit,
        handleSecureView
    };
};
