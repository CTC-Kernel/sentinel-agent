import { Control, Risk } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { Download, AlertTriangle, FileText } from '../ui/Icons';
import { useStore } from '../../store';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SoAViewProps {
    controls: Control[];
    risks: Risk[];
    handlers: {
        updateControl: (id: string, updates: Partial<Control>) => Promise<boolean>;
        handleApplicabilityChange: (control: Control, isApplicable: boolean) => Promise<void>;
        updateJustification: (control: Control, text: string) => Promise<void>;
    };
}

export const SoAView: React.FC<SoAViewProps> = ({ controls, risks, handlers }) => {
    const { addToast } = useStore();

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.text('Statement of Applicability (SoA) - ISO 27001', 14, 20);

        const data = controls.map(c => [
            c.code,
            c.name,
            c.applicability || (c.status === 'Non applicable' ? 'Non applicable' : 'Applicable'),
            c.justification || '-',
            c.status,
            (c.relatedRiskIds?.length || 0).toString()
        ]);

        autoTable(doc, {
            startY: 30,
            head: [['Code', 'Nom', 'Applicabilité', 'Justification', 'Statut', 'Risques']],
            body: data,
        });

        doc.save('SoA_Report.pdf');
        addToast('Export SoA généré', 'success');
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button variant="outline" onClick={exportPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Exporter SoA (PDF)
                </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
                {controls.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-slate-600 dark:text-slate-400">Aucun contrôle disponible dans ce référentiel.</p>
                    </div>
                ) : (
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-4 py-3">Code</th>
                            <th className="px-4 py-3">Contrôle</th>
                            <th className="px-4 py-3">Applicable</th>
                            <th className="px-4 py-3">Risques</th>
                            <th className="px-4 py-3">Preuves</th>
                            <th className="px-4 py-3">Justification</th>
                            <th className="px-4 py-3">Statut implémentation</th>
                            <th className="px-4 py-3">Maturité</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-slate-900">
                        {controls.map(control => {
                            const isNonApplicable = control.applicability === 'Non applicable' || control.status === 'Non applicable';
                            const missingJustification = isNonApplicable && (!control.justification || control.justification.trim() === '');
                            // Validate linked risks exist in the current risks listing
                            const linkedRisksCount = control.relatedRiskIds?.filter(id => risks.some(r => r.id === id)).length || 0;
                            const evidenceCount = control.evidenceIds?.length || 0;

                            return (
                                <tr key={control.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                    <td className="px-4 py-3 font-medium">{control.code}</td>
                                    <td className="px-4 py-3 max-w-sm">
                                        <div className="font-medium text-slate-900 dark:text-slate-100">{control.name}</div>
                                        <div className="text-xs text-slate-500 truncate" title={control.description}>{control.description}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input checked={!isNonApplicable} onChange={(e) => handlers.handleApplicabilityChange(control, e.target.checked)}
                                                type="checkbox"
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </td>
                                    <td className="px-4 py-3">
                                        {linkedRisksCount > 0 ? (
                                            <Badge variant="outline" className="flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                                {linkedRisksCount}
                                            </Badge>
                                        ) : <span className="text-slate-400">-</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        {evidenceCount > 0 ? (
                                            <Badge variant="outline" className="flex items-center gap-1">
                                                <FileText className="h-3 w-3 text-blue-500" />
                                                {evidenceCount}
                                            </Badge>
                                        ) : <span className="text-slate-400">-</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <input defaultValue={control.justification || ''} onBlur={(e) => { if (e.target.value !== control.justification) handlers.updateJustification(control, e.target.value); }}
                                            type="text"
                                            className={`bg-transparent text-xs w-full focus:ring-1 focus:ring-brand-500 rounded px-2 py-1 transition-colors ${missingJustification
                                                ? 'border border-red-500 bg-red-50 dark:bg-red-900/10 placeholder-red-400'
                                                : 'border-none placeholder-slate-400'
                                                }`}
                                            placeholder={missingJustification ? "Justification requise !" : "Ajouter une justification..."}
                                            aria-label={`Justification pour ${control.title}`}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge status={
                                            control.status === 'Implémenté' ? 'success' :
                                                control.status === 'Non applicable' ? 'neutral' :
                                                    control.status === 'Partiel' ? 'warning' : 'error'
                                        } variant="soft">
                                            {control.status}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        {control.maturity ? (
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map(i => (
                                                    <div key={`star-${i}`} className={`h-1.5 w-3 rounded-sm ${i <= control.maturity! ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                                ))}
                                            </div>
                                        ) : '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                )}
            </div>
        </div>
    );
};
