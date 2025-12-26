import { db } from '../firebase';
import { collection, getDocs, query, where, DocumentData } from 'firebase/firestore';
import { ErrorLogger } from './errorLogger';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

export class DataExportService {
    static async exportOrganizationData(organizationId: string): Promise<void> {
        const zip = new JSZip();
        const collections = ['assets', 'risks', 'controls', 'documents', 'audits', 'incidents'];

        try {
            const exportData: Record<string, DocumentData[]> = {};

            await Promise.all(collections.map(async (colName) => {
                const q = query(collection(db, colName), where('organizationId', '==', organizationId));
                const snapshot = await getDocs(q);
                exportData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Add to ZIP as individual JSON files
                zip.file(`${colName}.json`, JSON.stringify(exportData[colName], null, 2));
            }));

            // Generate ZIP
            const content = await zip.generateAsync({ type: 'blob' });

            // Save file
            const timestamp = new Date().toISOString().split('T')[0];
            saveAs(content, `sentinel_export_${organizationId}_${timestamp}.zip`);

        } catch (error) {
            ErrorLogger.error(error, 'DataExportService.exportOrganizationData');
            throw error;
        }
    }
}
