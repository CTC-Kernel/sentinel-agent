import React from 'react';
import { Control } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { Download } from '../ui/Icons';
import { useStore } from '../../store';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SoAViewProps {
    controls: Control[];
    onUpdateControl: (id: string, updates: Partial<Control>) => Promise<any>;
}

export const SoAView: React.FC<SoAViewProps> = ({ controls, onUpdateControl }) => {
    const { addToast } = useStore();

    const handleApplicabilityChange = async (control: Control, isApplicable: boolean) => {
        const newStatus = isApplicable ? 'Non commencé' : 'Non applicable';
        const newApplicability = isApplicable ? 'Applicable' : 'Non applicable';
        await onUpdateControl(control.id, {
            status: newStatus,
            applicability: newApplicability
        });
        addToast(`Contrôle ${control.code} marqué comme ${newApplicability}`, 'success');
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.text('Statement of Applicability (SoA) - ISO 27001', 14, 20);

        const data = controls.map(c => [
            c.code,
            c.name,
            c.applicability || (c.status === 'Non applicable' ? 'Non applicable' : 'Applicable'),
            c.justification || '-',
            c.status
        ]);

        autoTable(doc, {
            startY: 30,
            head: [['Code', 'Nom', 'Applicabilité', 'Justification', 'Statut']],
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
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-4 py-3">Code</th>
                            <th className="px-4 py-3">Contrôle</th>
                            <th className="px-4 py-3">Applicable</th>
                            <th className="px-4 py-3">Justification</th>
                            <th className="px-4 py-3">Statut implémentation</th>
                            <th className="px-4 py-3">Maturité</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-slate-900">
                        {controls.map(control => (
                            <tr key={control.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                <td className="px-4 py-3 font-medium">{control.code}</td>
                                <td className="px-4 py-3 max-w-sm">
                                    <div className="font-medium text-slate-900 dark:text-slate-100">{control.name}</div>
                                    <div className="text-xs text-slate-500 truncate" title={control.description}>{control.description}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={control.applicability === 'Applicable' || control.status !== 'Non applicable'}
                                            onChange={(e) => handleApplicabilityChange(control, e.target.checked)}
                                        />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </td>
                                <td className="px-4 py-3">
                                    <input
                                        type="text"
                                        defaultValue={control.justification || ''}
                                        onBlur={(e) => {
                                            if (e.target.value !== control.justification) {
                                                onUpdateControl(control.id, { justification: e.target.value });
                                            }
                                        }}
                                        className="bg-transparent border-none text-xs w-full focus:ring-1 focus:ring-brand-500 rounded px-2 py-1"
                                        placeholder="Ajouter une justification..."
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
                                                <div key={i} className={`h-1.5 w-3 rounded-sm ${i <= control.maturity! ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                            ))}
                                        </div>
                                    ) : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
