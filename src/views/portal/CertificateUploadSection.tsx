import React, { useState } from 'react';
import { Upload, CheckCircle, AlertTriangle, Loader2 } from '../../components/ui/Icons';
import { httpsCallable } from 'firebase/functions';
import { functions, storage } from '../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ErrorLogger } from '../../services/errorLogger';
import { toast } from '@/lib/toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface CertificateUploadProps {
    token: string;
}

export const CertificateUploadSection: React.FC<CertificateUploadProps> = ({ token }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'success'>('idle');
    const [showNoCertificateConfirm, setShowNoCertificateConfirm] = useState(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            // Validation Anti-Draper / Security
            const ALLOWED_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            const MAX_SIZE = 10 * 1024 * 1024; // 10MB

            if (!ALLOWED_TYPES.includes(selectedFile.type)) {
                toast.error('Format invalide. Uniquement PDF ou Word.');
                e.target.value = ''; // Reset input
                return;
            }

            if (selectedFile.size > MAX_SIZE) {
                toast.error('Fichier trop volumineux (Max 10 Mo).');
                e.target.value = '';
                return;
            }

            setFile(selectedFile);
        }
    };

    const handleCertifyClick = () => {
        if (!file) {
            setShowNoCertificateConfirm(true);
            return;
        }
        handleCertify();
    };

    const handleCertify = async () => {
        setShowNoCertificateConfirm(false);
        setIsUploading(true);
        try {
            let downloadUrl = null;

            if (file) {
                // Upload to a secure bucket location (conceptually)
                // For MVP, using standard storage path with obscure name
                const storageRef = ref(storage, `certificates/${token}_${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                downloadUrl = await getDownloadURL(snapshot.ref);
            }

            const updateFn = httpsCallable(functions, 'portal_updateStatus');
            await updateFn({
                token,
                status: 'Validé',
                certificationData: {
                    certifiedAt: new Date().toISOString(),
                    certificateUrl: downloadUrl,
                    certifierName: 'External Auditor' // In real app, derived from token metadata
                }
            });

            setStatus('success');
            toast.success('Audit validé et certifié avec succès !');

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'CertificateUpload.submit', 'UPDATE_FAILED');
        } finally {
            setIsUploading(false);
        }
    };

    if (status === 'success') {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Certification Enregistrée</h3>
                <p className="text-slate-600 dark:text-slate-400">Le rapport de certification a été transmis. L'accès à cet audit est désormais archivé.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-brand-500" />
                Validation & Certification
            </h2>
            <p className="text-slate-600 mb-6 text-sm">
                En tant qu'auditeur accrédité, vous pouvez valider cet audit et y joindre le certificat officiel.
                Cette action clôturera l'audit et notifiera l'organisation.
            </p>

            <div className="border border-slate-200 dark:border-white/10 rounded-xl p-6 bg-slate-50 dark:bg-slate-900/50">
                <label className={`flex flex-col items-center justify-center border-2 border-dashed ${file ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-slate-300 dark:border-slate-700'} rounded-lg p-8 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}>
                    {file ? (
                        <>
                            <FileCheckIcon className="w-8 h-8 text-green-500 mb-2" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-300">{file.name}</span>
                            <span className="text-xs text-green-600 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                        </>
                    ) : (
                        <>
                            <Upload className="w-8 h-8 text-slate-400 mb-2" />
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Déposer le rapport ou le certificat (PDF)</span>
                            <span className="text-xs text-slate-400 mt-1">Max 10 Mo</span>
                        </>
                    )}
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileSelect} />
                </label>

                <div className="mt-6 flex justify-end gap-3">
                    <button className="px-4 py-2 text-slate-600 font-medium hover:underline text-sm">Refuser / Demander corrections</button>
                    <button
                        onClick={handleCertifyClick}
                        disabled={isUploading}
                        className="btn-primary flex items-center gap-2"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Valider et Certifier
                    </button>
                </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg flex items-start gap-3 text-orange-800 dark:text-orange-200 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p>Attention : Cette action est irréversible. Une fois validé, l'audit passera en statut "Validé" et votre accès en écriture sera révoqué.</p>
            </div>

            <ConfirmModal
                isOpen={showNoCertificateConfirm}
                onClose={() => setShowNoCertificateConfirm(false)}
                onConfirm={handleCertify}
                title="Validation sans certificat"
                message="Voulez-vous valider sans joindre de certificat ?"
                type="warning"
                confirmText="Valider quand même"
                cancelText="Annuler"
            />
        </div>
    );
};

const FileCheckIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
