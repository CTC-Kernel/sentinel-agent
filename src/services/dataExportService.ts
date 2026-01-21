import { db } from '../firebase';
import { collection, getDocs, query, where, DocumentData } from 'firebase/firestore';
import { ErrorLogger } from './errorLogger';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

export interface DataExportOptions {
    organizationId: string;
    planId?: string;
    hasApiAccess?: boolean;
    onUpgradeRequired?: (message: string) => void;
    onError?: (error: unknown) => void;
}

export class DataExportService {
    static async exportOrganizationData(options: DataExportOptions): Promise<void> {
        const { organizationId, planId = 'discovery', hasApiAccess = false, onUpgradeRequired, onError } = options;
        
        // Vérifier les limites du plan
        if (!hasApiAccess) {
            const upgradeMessage = planId === 'discovery' 
                ? 'L\'export de données complètes nécessite le plan Enterprise (499€/mois). Le plan Discovery permet uniquement les exports partiels.'
                : 'L\'export de données complètes nécessite le plan Enterprise.';
            
            if (onUpgradeRequired) {
                onUpgradeRequired(upgradeMessage);
                return;
            }
            
            // Continuer avec un export limité si pas de callback d'upgrade
            return this.exportLimitedData(organizationId, planId);
        }

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

            // Add README with plan information
            const readmeContent = this.generateDataExportReadme(planId, true);
            zip.file('README.txt', readmeContent);

            // Generate ZIP
            const content = await zip.generateAsync({ type: 'blob' });

            // Save file
            const timestamp = new Date().toISOString().split('T')[0];
            saveAs(content, `sentinel_export_${organizationId}_${timestamp}.zip`);

        } catch (error) {
            ErrorLogger.error(error, 'DataExportService.exportOrganizationData');
            if (onError) onError(error);
            throw error;
        }
    }

    private static async exportLimitedData(organizationId: string, planId: string): Promise<void> {
        const zip = new JSZip();
        const limitedCollections = ['assets', 'risks']; // Collections limitées pour Discovery

        try {
            const exportData: Record<string, DocumentData[]> = {};

            await Promise.all(limitedCollections.map(async (colName) => {
                const q = query(collection(db, colName), where('organizationId', '==', organizationId));
                const snapshot = await getDocs(q);
                exportData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Add to ZIP as individual JSON files
                zip.file(`${colName}.json`, JSON.stringify(exportData[colName], null, 2));
            }));

            // Add README with limitations information
            const readmeContent = this.generateDataExportReadme(planId, false);
            zip.file('README.txt', readmeContent);

            // Generate ZIP
            const content = await zip.generateAsync({ type: 'blob' });

            // Save file with limited indicator
            const timestamp = new Date().toISOString().split('T')[0];
            saveAs(content, `sentinel_export_limited_${organizationId}_${timestamp}.zip`);

        } catch (error) {
            ErrorLogger.error(error, 'DataExportService.exportLimitedData');
            throw error;
        }
    }

    private static generateDataExportReadme(planId: string, isFullExport: boolean): string {
        const currentDate = new Date().toISOString();
        
        let content = `Export de Données Sentinel GRC\n`;
        content += `Généré le: ${currentDate}\n`;
        content += `Plan: ${planId.toUpperCase()}\n`;
        content += `Type d'export: ${isFullExport ? 'Complet' : 'Limité'}\n\n`;
        
        if (!isFullExport) {
            content += `=== IMPORTANT ===\n`;
            content += `Cet export est limité en raison des restrictions du plan ${planId}.\n`;
            content += `Pour un export complet de toutes vos données, passez au plan Enterprise.\n`;
            content += `URL: https://sentinel-grc.fr/pricing\n\n`;
        }
        
        content += `=== Structure du ZIP ===\n`;
        if (isFullExport) {
            content += `- assets.json: Tous les actifs de l'organisation\n`;
            content += `- risks.json: Tous les risques identifiés\n`;
            content += `- controls.json: Tous les contrôles de sécurité\n`;
            content += `- documents.json: Tous les documents et preuves\n`;
            content += `- audits.json: Toutes les audits et évaluations\n`;
            content += `- incidents.json: Tous les incidents de sécurité\n`;
        } else {
            content += `- assets.json: Actifs (limité)\n`;
            content += `- risks.json: Risques (limité)\n`;
            content += `- README.txt: Ce fichier d'information\n`;
        }
        
        content += `\n=== À propos de Sentinel GRC ===\n`;
        content += `Sentinel GRC est une plateforme de Gouvernance, Risques et Conformité\n`;
        content += `conçue pour les organisations cherchant à obtenir et maintenir\n`;
        content += `leur certification ISO 27001.\n`;
        content += `https://sentinel-grc.fr\n`;
        
        return content;
    }
}
