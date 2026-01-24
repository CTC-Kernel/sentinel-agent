import React from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { CheckCircle2 } from '../ui/Icons';
import { Modal } from '../ui/Modal';

interface DocumentSignatureProps {
    isOpen: boolean;
    onClose: () => void;
    onSign: () => void;
    signaturePadRef: React.RefObject<SignatureCanvas | null>;
}

export const DocumentSignature: React.FC<DocumentSignatureProps> = ({ isOpen, onClose, onSign, signaturePadRef }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Signature Électronique">
            <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-muted-foreground">
                    Veuillez signer dans le cadre ci-dessous pour valider ce document. Cette signature sera apposée sur le certificat d'intégrité.
                </p>
                <div className="border-2 border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white">
                    <SignatureCanvas
                        ref={signaturePadRef}
                        canvasProps={{
                            width: 500,
                            height: 200,
                            className: 'signature-canvas w-full h-48 cursor-crosshair'
                        }}
                    />
                </div>
                <div className="flex justify-end gap-3 mt-4">
                    <button
                        onClick={() => signaturePadRef.current?.clear()}
                        className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 rounded-lg"
                    >
                        Effacer
                    </button>
                    <button
                        onClick={onSign}
                        className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        Valider et Signer
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
