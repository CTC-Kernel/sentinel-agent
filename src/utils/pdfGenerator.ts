import { PdfService } from '../services/PdfService';
import { BusinessProcess, BcpDrill } from '../types';

export const generateContinuityReport = (processes: BusinessProcess[], drills: BcpDrill[]) => {
    // 1. Calculate Metrics
    const totalProcesses = processes.length;
    const criticalProcesses = processes.filter(p => p.priority === 'Critique').length;
    const protectedProcesses = processes.filter(p => p.rto && p.rpo).length;

    // Fake trend for now
    const successfulDrills = drills.filter(d => d.result === 'Succès').length;
    const drillSuccessRate = drills.length > 0 ? Math.round((successfulDrills / drills.length) * 100) : 0;

    const summary = `
    Synthèse de Continuité d'Activité
    
    État de Préparation : ${drillSuccessRate > 80 ? 'Optimisé' : 'En développement'}
    
    Vue d'ensemble :
    L'organisation a identifié ${totalProcesses} processus métier critiques. Parmi eux, ${criticalProcesses} sont classés comme vitaux pour la survie de l'entreprise. À ce jour, ${protectedProcesses} processus disposent de stratégies de continuité définies (RTO/RPO).
    
    Résilience Opérationnelle :
    Le programme d'exercices affiche un taux de succès de ${drillSuccessRate}%. ${drills.length} tests ont été réalisés pour valider les procédures de secours.
    `.trim();

    PdfService.generateExecutiveReport(
        {
            title: "Rapport de Continuité d'Activité (BCP)",
            subtitle: "Analyse d'Impact Métier (BIA) et Résilience",
            filename: "rapport_continuite_activite.pdf",
            orientation: 'portrait',
            // We assume Organization Name is passed or hardcoded if missing. 
            // The original function didn't take organization name. 
            // We'll use a default or fetch it later if we refactor the call signature.
            organizationName: 'Sentinel GRC',
            summary: summary,
            metrics: [
                { label: 'Processus', value: totalProcesses, subtext: 'Périmètre total' },
                { label: 'Critiques', value: criticalProcesses, subtext: 'Priorité absolue' },
                { label: 'Succès Tests', value: `${drillSuccessRate}%`, subtext: 'Validation Plan' }
            ],
            stats: [
                { label: 'Critique', value: criticalProcesses, color: '#EF4444' },
                { label: 'Majeur', value: processes.filter(p => p.priority === 'Élevée').length, color: '#F97316' },
                { label: 'Standard', value: processes.filter(p => p.priority === 'Moyenne' || p.priority === 'Faible').length, color: '#3B82F6' },
            ]
        },
        (doc, y) => {
            let currentY = y;
            const pageWidth = doc.internal.pageSize.width;

            // 1. BIA Table
            doc.setFontSize(14);
            doc.setTextColor('#334155');
            doc.setFont('helvetica', 'bold');
            doc.text("Analyse d'Impact Métier (BIA)", 14, currentY);
            currentY += 10;

            const biaData = processes.map(p => [
                p.name,
                p.priority,
                p.rto,
                p.rpo,
                p.priority
            ]);

            doc.autoTable({
                startY: currentY,
                head: [['Processus', 'Priorité', 'RTO', 'RPO', 'Niveau']],
                body: biaData,
                headStyles: { fillColor: '#0F172A' },
                theme: 'striped'
            });

            currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

            // 2. Drills Section
            doc.setFontSize(14);
            doc.setTextColor('#334155');
            doc.setFont('helvetica', 'bold');
            doc.text("Exercices & Tests de Continuité", 14, currentY);
            currentY += 10;

            // Draw Drill Stats if possible (Pie chart?)
            PdfService.drawDonutChart(
                doc,
                pageWidth - 60,
                currentY - 20, // Align with title kinda
                20,
                [
                    { label: 'Succès', value: successfulDrills, color: '#10B981' },
                    { label: 'Échec', value: drills.length - successfulDrills, color: '#EF4444' }
                ]
            );

            const drillData = drills.map(d => [
                new Date(d.date).toLocaleDateString(),
                d.type,
                d.notes || '-',
                d.result,
                '-' // Duration
            ]);

            doc.autoTable({
                startY: currentY + 10,
                head: [['Date', 'Type', 'Notes', 'Résultat', 'Durée']],
                body: drillData,
                headStyles: { fillColor: '#10B981' },
                theme: 'striped'
            });
        }
    );
};
