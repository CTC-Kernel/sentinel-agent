import { format } from 'date-fns';
import { EvidenceRequest, UserProfile, Document, Control } from '../types';

interface ExportEvidenceOptions {
    auditId: string;
    requests: EvidenceRequest[];
    users: UserProfile[];
    controls: Control[];
    documents: Document[];
    onSuccess: (message: string) => void;
    onError: (error: unknown) => void;
}

export const exportEvidenceRequestsZip = async ({
    auditId,
    requests,
    users,
    controls,
    documents,
    onSuccess,
    onError
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
        onError(error);
    }
};

function renderCSV(folder: any, content: string) {
    folder?.file('rapport_demandes.csv', content);
}
