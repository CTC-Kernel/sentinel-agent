import React, { useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import { Download, ShieldCheck, X } from '../ui/Icons';
import { Button } from '../ui/button';

interface AgentDownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDownload: () => void;
    assetName?: string;
}

export const AgentDownloadModal: React.FC<AgentDownloadModalProps> = ({
    isOpen,
    onClose,
    onDownload,
    assetName
}) => {
    // Override onDownload to force internal simulation if parent doesn't handle it
    const handleDownload = () => {
        if (onDownload) {
            onDownload();
            return;
        }

        window.location.href = '/settings?tab=agents';
        onClose();
    };

    const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

    return (
        <Transition.Root show={isOpen} as={React.Fragment}>
            <Dialog as="div" className="relative z-modal" initialFocus={cancelButtonRef} onClose={onClose}>
                <Transition.Child
                    as={React.Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={React.Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-4xl bg-background text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-border">
                                {/* Decorative background elements */}
                                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 blur-3xl rounded-full pointer-events-none" />

                                <div className="relative p-6 px-8 pt-10 text-center">
                                    <button
                                        onClick={onClose}
                                        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>

                                    <motion.div
                                        className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-6 shadow-inner ring-1 ring-primary/20 shadow-primary/20"
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                                    >
                                        <ShieldCheck className="h-10 w-10" />
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2, duration: 0.3 }}
                                    >
                                        <Dialog.Title as="h3" className="text-xl font-bold font-display text-foreground mb-2">
                                            Sécuriser cet actif ?
                                        </Dialog.Title>
                                        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto mb-6">
                                            L'actif <strong>{assetName || 'créé'}</strong> est éligible à la protection Sentinel Agent.
                                        </p>

                                        <div className="bg-muted/30 rounded-2xl p-4 mb-8 text-left border border-border/50">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Fonctionnalités incluses</h4>
                                            <ul className="space-y-2.5">
                                                <li className="flex items-center gap-2.5 text-sm text-foreground">
                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success ring-1 ring-success/20">
                                                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    </span>
                                                    Collecte de logs en temps réel
                                                </li>
                                                <li className="flex items-center gap-2.5 text-sm text-foreground">
                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success ring-1 ring-success/20">
                                                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    </span>
                                                    Remontée des vulnérabilités (CVE)
                                                </li>
                                                <li className="flex items-center gap-2.5 text-sm text-foreground">
                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success ring-1 ring-success/20">
                                                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    </span>
                                                    Configuration automatique
                                                </li>
                                            </ul>
                                        </div>
                                    </motion.div>

                                    <div className="flex flex-col gap-3">
                                        <Button
                                            type="button"
                                            onClick={handleDownload}
                                            className="w-full py-3 h-auto text-base rounded-3xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/20 font-bold transform transition-all hover:-translate-y-0.5"
                                        >
                                            <Download className="h-5 w-5 mr-2" />
                                            Télécharger l'Agent
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={onClose}
                                            ref={cancelButtonRef}
                                            className="w-full text-muted-foreground hover:text-foreground"
                                        >
                                            Plus tard
                                        </Button>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
};
