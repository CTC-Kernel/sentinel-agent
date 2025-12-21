import { useState } from 'react';
import { Document } from '../types';
import { DocumentWorkflowService } from '../services/DocumentWorkflowService';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';

export const useDocumentWorkflow = () => {
    const { user, addToast } = useStore();
    const [loading, setLoading] = useState(false);

    const submitForReview = async (doc: Document, reviewers: string[], comment?: string) => {
        if (!user) return;
        setLoading(true);
        try {
            await DocumentWorkflowService.submitForReview(doc, user, reviewers, comment);
            addToast("Document soumis pour revue", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useDocumentWorkflow.submitForReview');
        } finally {
            setLoading(false);
        }
    };

    const approveDocument = async (doc: Document, comment?: string) => {
        if (!user) return;
        setLoading(true);
        try {
            await DocumentWorkflowService.approveDocument(doc, user, comment);
            addToast("Document approuvé", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useDocumentWorkflow.approveDocument');
        } finally {
            setLoading(false);
        }
    };

    const rejectDocument = async (doc: Document, comment: string) => {
        if (!user) return;
        setLoading(true);
        try {
            await DocumentWorkflowService.rejectDocument(doc, user, comment);
            addToast("Document rejeté", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useDocumentWorkflow.rejectDocument');
        } finally {
            setLoading(false);
        }
    };

    const publishDocument = async (doc: Document) => {
        if (!user) return;
        setLoading(true);
        try {
            await DocumentWorkflowService.publishDocument(doc, user);
            addToast("Document publié", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useDocumentWorkflow.publishDocument');
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        submitForReview,
        approveDocument,
        rejectDocument,
        publishDocument
    };
};
