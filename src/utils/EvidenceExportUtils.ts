import { format } from 'date-fns';
import { EvidenceRequest, UserProfile, Document, Control } from '../types';
import { ErrorLogger } from '../services/errorLogger';

// Fonction de vérification des limites pour les composants
export const checkEvidenceExportLimits = (hasFeature: (feature: 'whiteLabelReports') => boolean, planId: string) => {
    const canExportWithoutWatermark = hasFeature('whiteLabelReports');
    
    if (!canExportWithoutWatermark) {
        return {
            canExport: true, // Permettre l'export mais avec watermark
            requiresUpgrade: false,
            willHaveWatermark: true,
            message: planId === 'discovery' 
                ? 'Les rapports générés avec le plan Discovery incluent un filigrane "Version Essai". Passez au plan Professional pour des rapports sans filigrane.'
                : 'Mettez à niveau votre plan pour des rapports sans filigrane.'
        };
    }
    
    return {
        canExport: true,
        requiresUpgrade: false,
        willHaveWatermark: false,
        message: ''
    };
};

interface ExportEvidenceOptions {
    auditId: string;
    requests: EvidenceRequest[];
    users: UserProfile[];
    controls: Control[];
    documents: Document[];
    onSuccess: (message: string) => void;
    onError: (error: unknown) => void;
    addWatermark?: boolean;
    planId?: string;
}

export const exportEvidenceRequestsZip = async ({
    auditId,
    requests,
    users,
    controls,
    documents,
    onSuccess,
    onError,
    addWatermark = false,
    planId = 'discovery'
}: ExportEvidenceOptions) => {
    try {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const folder = zip.folder(`Preuves_Audit_${auditId}`);

        // Generate CSV report of requests
        const csvHeaders = ['Titre', 'Description', 'Statut', 'Assigné à', 'Echéance', 'Contrôle lié', 'Documents'];
        const csvRows = requests.map(req => {
            const assignedUser = users.find(u => u.uid === req.assignedTo)?.displayName || '';
            const control = controls.find(c => c.id === req.relatedControlId)?.code || '';
            const docs = req.documentIds?.map(id => documents.find(d => d.id === id)?.title).join('; ') || '';
            return [
                `"${req.title}"`,
                `"${req.description}"`,
                req.status,
                `"${assignedUser}"`,
                req.dueDate || '',
                control,
                `"${docs}"`
            ].join(',');
        });
        const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
        renderCSV(folder, csvContent);

        // Add documents (as text files with URLs if fetch fails, or try to fetch)
        const linksContent = requests.map(req => {
            if (!req.documentIds?.length) return null;
            return `Demande: ${req.title}\n` +
                req.documentIds.map(id => {
                    const doc = documents.find(d => d.id === id);
                    return doc ? `- ${doc.title}: ${doc.url}` : null;
                }).filter(Boolean).join('\n') + '\n\n';
        }).filter(Boolean).join('-------------------\n');

        if (linksContent) {
            folder?.file('liens_documents.txt', linksContent);
        }

        // Add README with plan information
        const readmeContent = generateReadmeContent(planId, addWatermark);
        folder?.file('README.txt', readmeContent);

        const content = await zip.generateAsync({ type: 'blob' });
        const url = window.URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Preuves_Audit_${auditId}_${format(new Date(), 'yyyyMMdd')}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        onSuccess("Export ZIP téléchargé");
    } catch (error) {
        ErrorLogger.error(error as Error, 'EvidenceExportUtils.exportToZip');
        onError(error);
    }
};

interface ZipFolder {
    file: (name: string, content: string) => void;
}

function renderCSV(folder: ZipFolder | null, content: string) {
    folder?.file('rapport_demandes.csv', content);
}

function generateReadmeContent(planId: string, addWatermark: boolean): string {
    const currentDate = format(new Date(), 'dd/MM/yyyy HH:mm');
    
    let content = `Rapport d'Audit Sentinel GRC\n`;
    content += `Généré le: ${currentDate}\n`;
    content += `Plan: ${planId.toUpperCase()}\n\n`;
    
    if (addWatermark && planId === 'discovery') {
        content += `=== IMPORTANT ===\n`;
        content += `Ce rapport a été généré avec le plan Discovery.\n`;
        content += `Les rapports Discovery incluent un filigrane "Version Essai".\n`;
        content += `Pour des rapports professionnels sans filigrane, passez au plan Professional.\n`;
        content += `URL: https://sentinel-grc.fr/pricing\n\n`;
    }
    
    content += `=== Structure du ZIP ===\n`;
    content += `- rapport_demandes.csv: Export CSV des demandes de preuves\n`;
    content += `- liens_documents.txt: Liens vers les documents associés\n`;
    content += `- README.txt: Ce fichier d'information\n\n`;
    
    content += `=== À propos de Sentinel GRC ===\n`;
    content += `Sentinel GRC est une plateforme de Gouvernance, Risques et Conformité\n`;
    content += `conçue pour les organisations cherchant à obtenir et maintenir\n`;
    content += `leur certification ISO 27001.\n`;
    content += `https://sentinel-grc.fr\n`;
    
    return content;
}
