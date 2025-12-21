import { useMemo } from 'react';
import { Control, Document, Audit, Supplier, Risk, Incident, Project, ActionItem, HealthIssue } from '../../types';
import { useStore } from '../../store';

interface UseDashboardInsightsProps {
    controls: Control[];
    myDocs: Document[];
    myAudits: Audit[];
    allSuppliers: Supplier[];
    stats: { financialRisk: number };
    allRisks: Risk[];
    myIncidents: Incident[];
    publishedDocs: Document[];
    myProjects: Project[];
    activeIncidentsCount: number;
    complianceScore: number;
}

export const useDashboardInsights = ({
    controls,
    myDocs,
    myAudits,
    allSuppliers,
    stats,
    allRisks,
    myIncidents,
    publishedDocs,
    myProjects,
    activeIncidentsCount,
    complianceScore
}: UseDashboardInsightsProps) => {
    const { user, t } = useStore();

    // Insight Logic
    const insight = useMemo(() => {
        const expiredDocs = myDocs.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < new Date()).length;
        const overdueAudits = myAudits.filter(a => new Date(a.dateScheduled) < new Date() && a.status !== 'Terminé' && a.status !== 'Validé').length;
        const criticalSuppliersNoScore = allSuppliers.filter(s => (s.criticality === 'Critique' || s.criticality === 'Élevée') && (!s.securityScore || s.securityScore < 50)).length;
        const expiredContracts = allSuppliers.filter(s => s.contractEnd && new Date(s.contractEnd) < new Date()).length;
        const actionable = controls.filter(c => c.status !== 'Exclu' && c.status !== 'Non applicable').length;

        if (activeIncidentsCount > 0) {
            return { text: t('dashboard.insightIncidents').replace('{count}', activeIncidentsCount.toString()), type: 'danger' as const, details: t('dashboard.insightIncidentsDesc'), action: t('common.manage'), link: "/incidents" };
        } else if (stats.financialRisk > 100000) {
            return { text: t('dashboard.insightFinancial'), type: 'danger' as const, details: t('dashboard.insightFinancialDesc').replace('{amount}', new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(stats.financialRisk)), action: t('common.view') + ' ' + t('dashboard.risks'), link: "/risks" };
        } else if (allRisks.filter(r => r.score >= 15).length > 0) {
            return { text: t('dashboard.insightRisks'), type: 'warning' as const, details: t('dashboard.insightRisksDesc'), action: t('common.view') + ' ' + t('dashboard.risks'), link: "/risks" };
        } else if (complianceScore < 50 && actionable > 0) {
            return { text: t('dashboard.insightCompliance'), type: 'warning' as const, details: t('dashboard.insightComplianceDesc'), action: t('dashboard.plan'), link: "/compliance" };
        } else if (expiredDocs > 0) {
            return { text: t('dashboard.insightDocs').replace('{count}', expiredDocs.toString()), type: 'warning' as const, details: t('dashboard.insightDocsDesc'), action: t('dashboard.review'), link: "/documents" };
        } else if (expiredContracts > 0) {
            return { text: t('dashboard.insightContracts').replace('{count}', expiredContracts.toString()), type: 'warning' as const, details: t('dashboard.insightContractsDesc'), action: t('sidebar.suppliers'), link: "/suppliers" };
        } else if (criticalSuppliersNoScore > 0) {
            return { text: t('dashboard.insightSuppliers').replace('{count}', criticalSuppliersNoScore.toString()), type: 'warning' as const, details: t('dashboard.insightSuppliersDesc'), action: t('dashboard.assess'), link: "/suppliers" };
        } else if (overdueAudits > 0) {
            return { text: t('dashboard.insightAudits').replace('{count}', overdueAudits.toString()), type: 'warning' as const, details: t('dashboard.insightAuditsDesc'), action: t('sidebar.audits'), link: "/audits" };
        }
        return { text: t('dashboard.insightStable'), type: 'success' as const, details: "", action: "", link: "" };
    }, [activeIncidentsCount, stats.financialRisk, allRisks, complianceScore, controls, myDocs, myAudits, allSuppliers, t]);

    // Health Issues
    const healthIssues = useMemo(() => {
        const issues: HealthIssue[] = [];
        const unmitigatedRisks = allRisks.filter(r => r.score >= 15 && !r.mitigationControlIds?.length).length;
        if (unmitigatedRisks > 0) issues.push({ id: '1', type: 'danger', message: t('dashboard.issueRisks'), count: unmitigatedRisks, link: '/risks' });
        const unprovenControls = controls.filter(c => c.status === 'Implémenté' && (!c.evidenceIds || c.evidenceIds.length === 0)).length;
        if (unprovenControls > 0) issues.push({ id: '2', type: 'warning', message: t('dashboard.issueControls'), count: unprovenControls, link: '/compliance' });

        const overdueAudits = myAudits.filter(a => new Date(a.dateScheduled) < new Date() && a.status !== 'Terminé' && a.status !== 'Validé').length;
        if (overdueAudits > 0) issues.push({ id: '6', type: 'warning', message: t('dashboard.issueAudits'), count: overdueAudits, link: '/audits' });
        return issues;
    }, [allRisks, controls, myAudits, t]);

    // Action Items
    const myActionItems = useMemo(() => {
        if (!user) return [];
        const myItems: ActionItem[] = [];

        // Audits
        myAudits.forEach(a => {
            myItems.push({ id: a.id, type: 'audit', title: a.name, date: a.dateScheduled, status: a.status, link: '/audits' });
        });

        // Incidents
        myIncidents.forEach(i => {
            myItems.push({ id: i.id, type: 'incident', title: i.title, date: i.dateReported, status: i.status, link: '/incidents' });
        });

        // Risks
        const myRisks = allRisks.filter(r => r.ownerId === user.uid && r.status !== 'Fermé');
        myRisks.forEach(r => {
            myItems.push({ id: r.id, type: 'risk', title: r.threat, date: r.updatedAt || new Date().toISOString(), status: r.status, link: '/risks' });
        });

        const next30Days = new Date(); next30Days.setDate(next30Days.getDate() + 30);
        myDocs.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < next30Days).forEach(d => {
            myItems.push({ id: d.id, type: 'document', title: d.title, date: d.nextReviewDate!, status: t('dashboard.statusReview'), link: '/documents' });
        });
        myDocs.filter(d => d.expirationDate && new Date(d.expirationDate) < next30Days).forEach(d => {
            myItems.push({ id: d.id, type: 'document', title: `Evidence: ${d.title}`, date: d.expirationDate!, status: 'Expire', link: '/documents' });
        });
        publishedDocs.filter(d => !d.readBy?.includes(user.uid)).forEach(d => {
            myItems.push({ id: d.id, type: 'policy', title: d.title, date: new Date().toISOString(), status: t('dashboard.statusToRead'), link: '/documents' });
        });
        myProjects.forEach(p => {
            myItems.push({ id: p.id, type: 'project', title: p.name, date: p.dueDate, status: `${p.progress}%`, link: '/projects' });
        });
        myItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return myItems;
    }, [user, myAudits, myDocs, publishedDocs, myProjects, myIncidents, allRisks, t]);

    return { insight, healthIssues, myActionItems };
};
