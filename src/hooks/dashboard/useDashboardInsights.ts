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

// Helper to safely handle Firestore Timestamps or strings
const safeDate = (date: unknown): string => {
    if (!date) return new Date().toISOString();
    if (typeof date === 'string') return date;
    // Handle Firestore Timestamp
    if (apiIsTimestamp(date)) {
        return date.toDate().toISOString();
    }
    // Handle standard Date object
    if (date instanceof Date) {
        return date.toISOString();
    }
    // Last resort
    try {
        return new Date(date as string | number | Date).toISOString();
    } catch {
        return new Date().toISOString();
    }
};

// Helper to check for Timestamp-like object
function apiIsTimestamp(x: unknown): x is { toDate: () => Date } {
    return typeof x === 'object' && x !== null && 'toDate' in x && typeof (x as { toDate: unknown }).toDate === 'function';
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
            return {
                text: t('dashboard.insightIncidents', { count: activeIncidentsCount }),
                type: 'danger' as const,
                details: t('dashboard.insightIncidentsDesc', { count: activeIncidentsCount }),
                action: t('common.manage'),
                link: "/incidents"
            };
        } else if (stats.financialRisk > 100000) {
            return {
                text: t('dashboard.insightFinancial'),
                type: 'danger' as const,
                details: t('dashboard.insightFinancialDesc', { amount: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(stats.financialRisk) }),
                action: t('common.view') + ' ' + t('dashboard.risks'),
                link: "/risks"
            };
        } else if (allRisks.filter(r => r.score >= 15).length > 0) {
            return { text: t('dashboard.insightRisks'), type: 'warning' as const, details: t('dashboard.insightRisksDesc'), action: t('common.view') + ' ' + t('dashboard.risks'), link: "/risks" };
        } else if (complianceScore < 50 && actionable > 0) {
            return { text: t('dashboard.insightCompliance'), type: 'warning' as const, details: t('dashboard.insightComplianceDesc'), action: t('dashboard.plan'), link: "/compliance" };
        } else if (expiredDocs > 0) {
            return { text: t('dashboard.insightDocs', { count: expiredDocs }), type: 'warning' as const, details: t('dashboard.insightDocsDesc', { count: expiredDocs }), action: t('dashboard.review'), link: "/documents" };
        } else if (expiredContracts > 0) {
            return { text: t('dashboard.insightContracts', { count: expiredContracts }), type: 'warning' as const, details: t('dashboard.insightContractsDesc', { count: expiredContracts }), action: t('sidebar.suppliers'), link: "/suppliers" };
        } else if (criticalSuppliersNoScore > 0) {
            return { text: t('dashboard.insightSuppliers', { count: criticalSuppliersNoScore }), type: 'warning' as const, details: t('dashboard.insightSuppliersDesc', { count: criticalSuppliersNoScore }), action: t('dashboard.assess'), link: "/suppliers" };
        } else if (overdueAudits > 0) {
            return { text: t('dashboard.insightAudits', { count: overdueAudits }), type: 'warning' as const, details: t('dashboard.insightAuditsDesc', { count: overdueAudits }), action: t('sidebar.audits'), link: "/audits" };
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
            myItems.push({
                id: a.id,
                type: 'audit',
                title: a.name,
                date: safeDate(a.dateScheduled),
                status: a.status,
                link: `/audits?id=${a.id}`
            });
        });

        // Incidents
        myIncidents.forEach(i => {
            myItems.push({
                id: i.id,
                type: 'incident',
                title: i.title,
                date: safeDate(i.dateReported),
                status: i.status,
                link: `/incidents?id=${i.id}`
            });
        });

        // Risks
        const myRisks = allRisks.filter(r => r.ownerId === user.uid && r.status !== 'Fermé');
        myRisks.forEach(r => {
            myItems.push({
                id: r.id,
                type: 'risk',
                title: r.threat,
                date: safeDate(r.updatedAt || r.createdAt),
                status: r.status,
                link: `/risks?id=${r.id}`
            });
        });

        const next30Days = new Date(); next30Days.setDate(next30Days.getDate() + 30);

        myDocs.filter(d => d.nextReviewDate && new Date(safeDate(d.nextReviewDate)) < next30Days).forEach(d => {
            myItems.push({
                id: d.id,
                type: 'document',
                title: d.title,
                date: safeDate(d.nextReviewDate),
                status: t('dashboard.statusReview'),
                link: `/documents?id=${d.id}`
            });
        });

        myDocs.filter(d => d.expirationDate && new Date(safeDate(d.expirationDate)) < next30Days).forEach(d => {
            myItems.push({
                id: d.id,
                type: 'document',
                title: `Evidence: ${d.title}`,
                date: safeDate(d.expirationDate),
                status: 'Expire',
                link: `/documents?id=${d.id}`
            });
        });

        publishedDocs.filter(d => !d.readBy?.includes(user.uid)).forEach(d => {
            myItems.push({
                id: d.id,
                type: 'policy',
                title: d.title,
                date: new Date().toISOString(),
                status: t('dashboard.statusToRead'),
                link: `/documents?id=${d.id}`
            });
        });

        myProjects.forEach(p => {
            myItems.push({
                id: p.id,
                type: 'project',
                title: p.name,
                date: safeDate(p.dueDate),
                status: `${p.progress}%`,
                link: `/projects?id=${p.id}`
            });
        });

        myItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return myItems;
    }, [user, myAudits, myDocs, publishedDocs, myProjects, myIncidents, allRisks, t]);

    return { insight, healthIssues, myActionItems };
};
