import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
                getDocs(query(collection(db, 'audits'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'projects'), where('organizationId', '==', user.organizationId)))
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
                riskCount: allRisks.length,
                highRisks: topRisks.filter(r => r.score >= 15).length,
                financialRisk: financialRisk,
                criticalRisks: topRisks.slice(0, 3).map(r => ({ threat: r.threat, score: r.score }))
            };

            const summary = await aiService.generateExecutiveDashboardSummary(aiContext);

            const metrics = [
                { label: t('dashboard.complianceScore'), value: `${complianceScore}%` },
                { label: t('dashboard.criticalRisks'), value: topRisks.filter(r => r.score >= 15).length.toString() },
                { label: t('dashboard.activeIncidents'), value: activeIncidentsCount.toString() },
                { label: t('dashboard.openAudits'), value: openAuditsCount.toString() }
            ];

            const chartStats = radarData.map((d, i) => ({
                label: d.subject,
                value: d.A,
                color: ['#0F172A', '#334155', '#475569', '#64748B'][i % 4]
            }));

            PdfService.generateExecutiveReport(
                {
                    title: t('dashboard.reportTitle'),
                    subtitle: t('dashboard.generatedOn').replace('{date}', new Date().toLocaleDateString()),
                    filename: `Rapport_Executif_${organizationName}_${new Date().toISOString().split('T')[0]}.pdf`,
                    organizationName,
                    organizationLogo,
                    summary,
                    metrics,
                    stats: chartStats,
                    author: user?.displayName || 'Sentinel GRC',
                    orientation: 'portrait'
                },
                (doc, startY) => {
                    let y = startY;

                    // Top Risks Table
                    doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
                    doc.text(t('dashboard.top5Risks'), 14, y);
                    y += 5;

                    const riskData = topRisks.map(r => [r.threat, r.score.toString(), r.strategy, r.status]);
                    doc.autoTable({
                        startY: y,
                        head: [[t('dashboard.threat'), t('dashboard.score'), t('dashboard.strategy'), t('dashboard.status')]],
                        body: riskData,
                        theme: 'grid',
                        headStyles: { fillColor: [79, 70, 229] },
                        styles: { fontSize: 8, cellPadding: 2 },
                        margin: { left: 14, right: 14 }
                    });

                    const lastAutoTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
                    y = (lastAutoTable?.finalY ?? y) + 15;

                    // Compliance Summary
                    doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
                    doc.text(t('dashboard.complianceByDomain'), 14, y);
                    y += 5;

                    const complianceData = radarData.map(d => [d.subject, `${d.A}%`]);
                    doc.autoTable({
                        startY: y,
                        head: [[t('dashboard.domain'), t('dashboard.score')]],
                        body: complianceData,
                        theme: 'grid',
                        headStyles: { fillColor: [79, 70, 229] },
                        styles: { fontSize: 8, cellPadding: 2 },
                        margin: { left: 14, right: 14 }
                    });
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
