import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { RISK_TEMPLATES, RiskTemplate } from '../../utils/riskTemplates';
import { X, Zap, AlertTriangle, ShieldAlert } from '../ui/Icons';

interface RiskTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (template: RiskTemplate, owner: string) => void;
    owners: string[];
}

export const RiskTemplateModal: React.FC<RiskTemplateModalProps> = ({ isOpen, onClose, onSelectTemplate, owners }) => {
    const [selectedTemplate, setSelectedTemplate] = useState<RiskTemplate | null>(null);
    const [owner, setOwner] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedTemplate && owner) {
            onSelectTemplate(selectedTemplate, owner);
            onClose();
            // Reset
            setSelectedTemplate(null);
            setOwner('');
        }
    };

    if (!isOpen) return null;

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'OWASP': return 'from-red-500 to-orange-500';
            case 'ISO27001': return 'from-blue-500 to-indigo-500';
            case 'RGPD': return 'from-purple-500 to-pink-500';
            case 'Cloud': return 'from-cyan-500 to-blue-500';
            default: return 'from-slate-500 to-slate-600';
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-slate-200 dark:border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Importer des Risques depuis un Template
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Gagnez du temps avec des risques prédéfinis
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
                    {!selectedTemplate ? (
                        /* Template Selection */
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {RISK_TEMPLATES.map(template => (
                                    <button
                                        key={template.id}
                                        onClick={() => setSelectedTemplate(template)}
                                        className="text-left p-6 rounded-xl border-2 border-slate-200 dark:border-white/10 hover:border-brand-500 dark:hover:border-brand-500 transition-all hover:shadow-lg group"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={`text-5xl p-3 rounded-xl bg-gradient-to-br ${getCategoryColor(template.category)} bg-opacity-10`}>
                                                {template.icon}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                                        {template.name}
                                                    </h3>
                                                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold bg-gradient-to-r ${getCategoryColor(template.category)} text-white`}>
                                                        {template.category}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                                                    {template.description}
                                                </p>
                                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        {template.risks.length} risques
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <ShieldAlert className="h-3 w-3" />
                                                        Score moyen: {(template.risks.reduce((sum, r) => sum + r.score, 0) / template.risks.length).toFixed(1)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Template Configuration */
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className={`bg-gradient-to-r ${getCategoryColor(selectedTemplate.category)} p-6 rounded-xl text-white`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-4xl">{selectedTemplate.icon}</span>
                                    <div>
                                        <h3 className="font-bold text-xl">{selectedTemplate.name}</h3>
                                        <p className="text-sm opacity-90">{selectedTemplate.description}</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 text-sm">
                                    <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-lg font-bold">
                                        {selectedTemplate.risks.length} risques
                                    </span>
                                    <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-lg font-bold">
                                        {selectedTemplate.category}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Responsable par Défaut *
                                </label>
                                <select
                                    value={owner}
                                    onChange={(e) => setOwner(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                    required
                                >
                                    <option value="">Sélectionner...</option>
                                    {owners.map(o => (
                                        <option key={o} value={o}>{o}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                                    Aperçu des Risques:
                                </h4>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {selectedTemplate.risks.map((risk, index) => (
                                        <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg text-xs">
                                            <span className="font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">
                                                {risk.threat}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-500">{(risk as any).category || 'N/A'}</span>
                                                <span className={`px-2 py-0.5 rounded font-bold ${risk.score >= 15 ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                                                    risk.score >= 10 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' :
                                                        risk.score >= 5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                                                            'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                                    }`}>
                                                    {risk.score}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSelectedTemplate(null)}
                                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Retour
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20"
                                >
                                    <Zap className="h-4 w-4 inline mr-2" />
                                    Importer {selectedTemplate.risks.length} Risques
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
