import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Button } from '../ui/button';
import { FileText, ShieldAlert, CheckSquare, Server, Activity, ArrowRight } from '../ui/Icons';

export interface ReportConfig {
    title: string;
    includeRisks: boolean;
    includeCompliance: boolean;
    includeAudits: boolean;
    includeProjects: boolean;
    includeIncidents: boolean;
}

interface ReportConfigurationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (config: ReportConfig) => void;
    defaultTitle?: string;
}

export const ReportConfigurationModal: React.FC<ReportConfigurationModalProps> = ({
    isOpen,
    onClose,
    onGenerate,
    defaultTitle = "Rapport Exécutif Global"
}) => {
    const [title, setTitle] = useState(defaultTitle);

    const [sections, setSections] = useState({
        includeRisks: true,
        includeCompliance: true,
        includeAudits: true,
        includeProjects: true,
        includeIncidents: true
    });

    const toggleSection = (key: keyof typeof sections) => {
        setSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleGenerate = () => {
        onGenerate({
            title,
            ...sections
        });
        onClose();
    };

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[200]" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-4xl bg-white dark:bg-slate-950 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-200 dark:border-white/5">
                                <div className="p-6">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600">
                                            <FileText className="h-6 w-6" />
                                        </div>
                                        Configuration du Rapport
                                    </h3>

                                    <div className="space-y-6">
                                        {/* Title Input */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Titre du rapport
                                            </label>
                                            <input
                                                type="text"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
                                                placeholder="Ex: Rapport Trimestriel Q1 2024"
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                                                Sections à inclure
                                            </label>

                                            <button
                                                onClick={() => toggleSection('includeRisks')}
                                                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${sections.includeRisks ? 'border-red-500/50 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-white/10 opacity-60'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <ShieldAlert className={`h-5 w-5 ${sections.includeRisks ? 'text-red-500' : 'text-slate-400'}`} />
                                                    <span className={`font-medium ${sections.includeRisks ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Risques Cyber</span>
                                                </div>
                                                <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${sections.includeRisks ? 'bg-red-500 border-red-500' : 'border-slate-300'}`}>
                                                    {sections.includeRisks && <ArrowRight className="h-3 w-3 text-white rotate-45" />}
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => toggleSection('includeCompliance')}
                                                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${sections.includeCompliance ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-white/10 opacity-60'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <CheckSquare className={`h-5 w-5 ${sections.includeCompliance ? 'text-emerald-500' : 'text-slate-400'}`} />
                                                    <span className={`font-medium ${sections.includeCompliance ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Conformité & Contrôles</span>
                                                </div>
                                                <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${sections.includeCompliance ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                                    {sections.includeCompliance && <ArrowRight className="h-3 w-3 text-white rotate-45" />}
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => toggleSection('includeProjects')}
                                                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${sections.includeProjects ? 'border-blue-500/50 bg-blue-50 dark:bg-blue-900/10' : 'border-slate-200 dark:border-white/10 opacity-60'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Activity className={`h-5 w-5 ${sections.includeProjects ? 'text-blue-500' : 'text-slate-400'}`} />
                                                    <span className={`font-medium ${sections.includeProjects ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Projets & Audits</span>
                                                </div>
                                                <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${sections.includeProjects ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                                                    {sections.includeProjects && <ArrowRight className="h-3 w-3 text-white rotate-45" />}
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => toggleSection('includeIncidents')}
                                                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${sections.includeIncidents ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-900/10' : 'border-slate-200 dark:border-white/10 opacity-60'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Server className={`h-5 w-5 ${sections.includeIncidents ? 'text-orange-500' : 'text-slate-400'}`} />
                                                    <span className={`font-medium ${sections.includeIncidents ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Incidents</span>
                                                </div>
                                                <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${sections.includeIncidents ? 'bg-orange-500 border-orange-500' : 'border-slate-300'}`}>
                                                    {sections.includeIncidents && <ArrowRight className="h-3 w-3 text-white rotate-45" />}
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex border-t border-slate-200 dark:border-white/5">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="flex-1 py-4 h-auto rounded-none text-sm font-bold text-slate-600 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                        onClick={onClose}
                                    >
                                        Annuler
                                    </Button>
                                    <div className="w-px bg-slate-200 dark:bg-white/5"></div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="flex-1 py-4 h-auto rounded-none text-sm font-bold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                                        onClick={handleGenerate}
                                    >
                                        Générer le rapport
                                    </Button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
};
