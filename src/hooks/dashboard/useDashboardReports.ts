import { useState } from 'react';
import 'jspdf-autotable';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { PdfService } from '../../services/PdfService';
import { aiService } from '../../services/aiService';
import { ErrorLogger } from '../../services/errorLogger';
import { useStore } from '../../store';
import { Risk } from '../../types';

interface ReportContext {
    organizationName: string;
    complianceScore: number;
    activeIncidentsCount: number;
    openAuditsCount: number;
    allRisks: Risk[];
    topRisks: Risk[];
    financialRisk: number;
    radarData: { subject: string; A: number; fullMark: number }[];
    organizationLogo?: string;
}

export const useDashboardReports = () => {
    const { user, addToast, t } = useStore();
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const generateICal = async () => {
        if (!user?.organizationId) return;
        try {
            const [auditsSnap, projectsSnap] = await Promise.all([
                getDocs(query(collection(db, 'audits'), where('organizationId', '==', user.organizationId), limit(1000))),
                getDocs(query(collection(db, 'projects'), where('organizationId', '==', user.organizationId), limit(1000)))
            ]);
            let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Sentinel GRC//FR\n";
            auditsSnap.forEach(doc => { const d = doc.data(); const date = d.dateScheduled ? d.dateScheduled.replace(/-/g, '') : ''; if (date) icsContent += `BEGIN:VEVENT\nSUMMARY:${t('dashboard.icsAudit')}: ${d.name}\nDTSTART;VALUE=DATE:${date}\nDTEND;VALUE=DATE:${date}\nDESCRIPTION:${t('dashboard.icsAuditor')}: ${d.auditor}\nEND:VEVENT\n`; });
            projectsSnap.forEach(doc => { const d = doc.data(); const date = d.dueDate ? d.dueDate.replace(/-/g, '') : ''; if (date) icsContent += `BEGIN:VEVENT\nSUMMARY:${t('dashboard.icsProject')}: ${d.name}\nDTSTART;VALUE=DATE:${date}\nDTEND;VALUE=DATE:${date}\nDESCRIPTION:${t('dashboard.icsManager')}: ${d.manager}\nEND:VEVENT\n`; });
            icsContent += "END:VCALENDAR";
            const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })); link.download = 'sentinel_calendar.ics'; link.click(); addToast(t('dashboard.calendarExported'), "success");
        } catch (err) { ErrorLogger.handleErrorWithToast(err, 'Dashboard.generateICal', 'UNKNOWN_ERROR'); }
    };

    const generateExecutiveReport = async (context: ReportContext) => {
        setIsGeneratingReport(true);
        addToast(t('dashboard.generatingReport'), "info");
        try {
            const { organizationName, complianceScore, activeIncidentsCount, openAuditsCount, allRisks, topRisks, financialRisk, radarData, organizationLogo } = context;

            // Context for AI
            const aiContext = {
                organizationName,
                complianceScore,
                activeIncidents: activeIncidentsCount,
                openAudits: openAuditsCount,
                riskCount: allRisks?.length || 0,
                highRisks: (topRisks || []).filter(r => r.score >= 15).length,
                financialRisk: financialRisk || 0,
                criticalRisks: (topRisks || []).slice(0, 3).map(r => ({ threat: r.threat, score: r.score }))
            };

            let summary = '';
            try {
                // Only try AI generation if we have basic context
                if (organizationName) {
                    summary = await aiService.generateExecutiveDashboardSummary(aiContext);
                } else {
                    summary = 'Résumé non disponible.';
                }
            } catch (error) {
                summary = 'Résumé non disponible (Service IA indisponible).';
            }

            const metrics = [
                { label: t('dashboard.complianceScore') || 'Conformité', value: `${complianceScore || 0}%` },
                { label: t('dashboard.criticalRisks') || 'Risques Critiques', value: (topRisks || []).filter(r => r.score >= 15).length.toString() },
                { label: t('dashboard.activeIncidents') || 'Incidents Actifs', value: (activeIncidentsCount || 0).toString() },
                { label: t('dashboard.openAudits') || 'Audits Ouverts', value: (openAuditsCount || 0).toString() }
            ];

            const chartStats = (radarData || []).map((d, i) => ({
                label: d.subject,
                value: d.A,
                color: ['#0F172A', '#334155', '#475569', '#64748B'][i % 4] || '#334155'
            }));

            PdfService.generateExecutiveReport(
                {
                    title: t('dashboard.reportTitle') || 'Rapport Exécutif',
                    subtitle: (t('dashboard.generatedOn') || 'Généré le {date}').replace('{date}', new Date().toLocaleDateString()),
                    filename: `Rapport_Executif_${organizationName || 'Sentinel'}_${new Date().toISOString().split('T')[0]}.pdf`,
                    organizationName: organizationName || 'Sentinel GRC',
                    organizationLogo,
                    summary,
                    metrics,
                    stats: chartStats,
                    author: user?.displayName || 'Sentinel GRC',
                    orientation: 'portrait'
                },
                (doc, startY) => {
                    let y = startY;

                    // Top Risks Table -- Check if we have risks
                    if (topRisks && topRisks.length > 0) {
                        doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
                        doc.text(t('dashboard.top5Risks') || 'Top 5 des Risques Prioritaires', 14, y);
                        y += 5;

                        const riskData = topRisks.map(r => [
                            r.threat || 'N/A',
                            (r.score || 0).toString(),
                            r.strategy || 'N/A',
                            r.status || 'N/A'
                        ]);

                        doc.autoTable({
                            startY: y,
                            head: [[
                                t('dashboard.threat') || 'Menace',
                                t('dashboard.score') || 'Score',
                                t('dashboard.strategy') || 'Stratégie',
                                t('dashboard.status') || 'Statut'
                            ]],
                            body: riskData,
                            theme: 'grid',
                            headStyles: { fillColor: [79, 70, 229] },
                            styles: { fontSize: 8, cellPadding: 2 },
                            margin: { left: 14, right: 14 }
                        });

                        const lastAutoTable = doc.lastAutoTable;
                        y = (lastAutoTable?.finalY ?? y) + 15;
                    }

                    // Compliance Summary -- Check if we have radar data
                    if (radarData && radarData.length > 0) {
                        doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
                        doc.text(t('dashboard.complianceByDomain') || 'Conformité par Domaine', 14, y);
                        y += 5;

                        const complianceData = radarData.map(d => [d.subject, `${d.A}%`]);

                        doc.autoTable({
                            startY: y,
                            head: [[t('dashboard.domain') || 'Domaine', t('dashboard.score') || 'Score']],
                            body: complianceData,
                            theme: 'grid',
                            headStyles: { fillColor: [79, 70, 229] },
                            styles: { fontSize: 8, cellPadding: 2 },
                            margin: { left: 14, right: 14 }
                        });
                    }
                }
            );
            addToast(t('dashboard.reportGenerated'), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Dashboard.generateExecutiveReport', 'REPORT_GENERATION_FAILED');
            addToast(t('dashboard.reportError'), "error");
        } finally {
            setIsGeneratingReport(false);
        }
    };

    return {
        isGeneratingReport,
        generateICal,
        generateExecutiveReport
    };
};
