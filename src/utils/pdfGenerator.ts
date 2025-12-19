import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BusinessProcess, BcpDrill } from '../types';

export const generateContinuityReport = (processes: BusinessProcess[], drills: BcpDrill[]) => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text("Rapport de Continuité d'Activité (BCP)", 14, 22);
    doc.setFontSize(10);
    doc.text(`Généré le: ${new Date().toLocaleDateString()}`, 14, 30);

    // Business Impact Analysis Sections
    doc.setFontSize(16);
    doc.text("Analyse d'Impact Métier (BIA)", 14, 45);

    const biaData = processes.map(p => [
        p.name,
        p.priority, // Was criticality
        p.rto,
        p.rpo,
        p.priority
    ]);

    autoTable(doc, {
        startY: 50,
        head: [['Processus', 'Priorité', 'RTO', 'RPO', 'Priorité']],
        body: biaData,
        headStyles: { fillColor: [66, 133, 244] }, // Brand color approximation
    });

    // Drills Section
    const finalY = (doc as any).lastAutoTable.finalY || 50;
    doc.setFontSize(16);
    doc.text("Exercices & Tests", 14, finalY + 15);

    const drillData = drills.map(d => [
        new Date(d.date).toLocaleDateString(),
        d.type,
        d.notes || '-', // Use notes instead of scope
        d.result,
        '-' // Duration missing
    ]);

    autoTable(doc, {
        startY: finalY + 20,
        head: [['Date', 'Type', 'Notes', 'Résultat', 'Durée']],
        body: drillData,
        headStyles: { fillColor: [52, 168, 83] }, // Greenish
    });

    doc.save('rapport_continuite_activite.pdf');
};
