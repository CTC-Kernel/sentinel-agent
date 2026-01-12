import React from 'react';
import { Menu, Transition } from '@headlessui/react';
import {
    Download, FileText, FileSpreadsheet, FileCode, MoreVertical,
    Loader2, Plus, BrainCircuit, ShieldAlert, Copy
} from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/button';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { ObsidianService } from '../../services/ObsidianService'; // Import might need adjustment
import { Risk } from '../../types';

interface RiskHeaderProps {
    risksTitle: string;
    risksSubtitle: string;
    canEdit: boolean;
    isGeneratingReport: boolean;
    isExportingCSV: boolean;
    importing: boolean;
    filteredRisks: Risk[];
    onExportRTP: () => void;
    onExportExecutiveReport: () => void;
    onExportPDF: () => void;
    onExportCSV: () => void;
    onImportCSV: () => void;
    onTemplateModalOpen: () => void;
    onAIAnalysis: () => void;
    onNewRisk: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    isAnalyzing?: boolean;
}

export const RiskHeader: React.FC<RiskHeaderProps> = ({
    risksTitle,
    risksSubtitle,
    canEdit,
    isGeneratingReport,
    isExportingCSV,
    importing,
    filteredRisks,
    onExportRTP,
    onExportExecutiveReport,
    onExportPDF,
    onExportCSV,
    onImportCSV,
    onTemplateModalOpen,
    onAIAnalysis,
    onNewRisk,
    isAnalyzing = false,
}) => {
    return (
        <PageHeader
            title={risksTitle}
            subtitle={risksSubtitle}
            icon={<ShieldAlert className="h-6 w-6 text-white" strokeWidth={2.5} />}
            breadcrumbs={[{ label: 'Risques' }]}
            trustType="integrity"
            actions={
                <>
                    <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button as={Button} variant="ghost" size="icon" aria-label="Plus d'actions" className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm h-9 w-9">
                            <MoreVertical className="h-5 w-5" />
                        </Menu.Button>
                        <Transition
                            as={React.Fragment}
                            enter="transition ease-out duration-100"
                            enterFrom="transform opacity-0 scale-95"
                            enterTo="transform opacity-100 scale-100"
                            leave="transition ease-in duration-75"
                            leaveFrom="transform opacity-100 scale-100"
                            leaveTo="transform opacity-0 scale-95"
                        >
                            <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                <div className="p-1">
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Rapports & Exports
                                    </div>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                aria-label="Exporter le RTP au format PDF"
                                                onClick={onExportRTP}
                                                disabled={isGeneratingReport}
                                                className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm disabled:opacity-50`}
                                            >
                                                {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-brand-500'}`} />}
                                                RTP (PDF)
                                            </button>
                                        )}
                                    </Menu.Item>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                aria-label="Exporter le rapport exécutif"
                                                onClick={onExportExecutiveReport}
                                                disabled={isGeneratingReport}
                                                className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm disabled:opacity-50`}
                                            >
                                                {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-indigo-500'}`} />}
                                                Rapport Exécutif
                                            </button>
                                        )}
                                    </Menu.Item>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                aria-label="Exporter le registre au format PDF"
                                                onClick={onExportPDF}
                                                className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                            >
                                                <Download className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />
                                                Registre (PDF)
                                            </button>
                                        )}
                                    </Menu.Item>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                aria-label="Exporter vers Obsidian"
                                                onClick={() => ObsidianService.exportRisksToObsidian(filteredRisks)}
                                                className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                            >
                                                <FileCode className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-emerald-500'}`} />
                                                Obsidian
                                            </button>
                                        )}
                                    </Menu.Item>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                aria-label="Exporter au format CSV"
                                                onClick={onExportCSV}
                                                disabled={isExportingCSV}
                                                className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                            >
                                                {isExportingCSV ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />}
                                                Export CSV
                                            </button>
                                        )}
                                    </Menu.Item>
                                </div>
                                <div className="p-1">
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Données
                                    </div>
                                    {canEdit && (
                                        <>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        aria-label="Importer depuis un CSV"
                                                        onClick={onImportCSV}
                                                        disabled={importing}
                                                        className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                    >
                                                        {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-emerald-500'}`} />}
                                                        Import CSV
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        aria-label="Gérer les modèles de risque"
                                                        onClick={onTemplateModalOpen}
                                                        className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                    >
                                                        <Copy className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-blue-500'}`} />
                                                        Templates
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        </>
                                    )}
                                </div>
                            </Menu.Items>
                        </Transition>
                    </Menu>

                    {canEdit && (
                        <>
                            <CustomTooltip content="Lancer l'analyse IA">
                                <Button
                                    aria-label="Lancer l'analyse IA"
                                    onClick={onAIAnalysis}
                                    disabled={isAnalyzing}
                                    className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-indigo-500/20 font-bold text-sm"
                                >
                                    {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
                                    <span className="hidden md:inline">{isAnalyzing ? 'Analyse...' : 'Analyse IA'}</span>
                                </Button>
                            </CustomTooltip>
                            <CustomTooltip content="Créer un nouveau risque">
                                <Button
                                    aria-label="Créer un nouveau risque"
                                    onClick={onNewRisk}
                                    className="flex items-center gap-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-500/20"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Nouveau Risque</span>
                                </Button>
                            </CustomTooltip>
                        </>
                    )}
                </>
            }
        />
    );
};
