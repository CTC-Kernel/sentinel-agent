import { PdfService, ReportOptions } from '../services/PdfService';
import { ErrorLogger } from '../services/errorLogger';

export interface PdfExportOptions extends Omit<ReportOptions, 'watermark'> {
 planId?: string;
 hasWhiteLabelReports?: boolean;
}

/**
 * Service helper pour gérer les exports PDF avec vérification des limites de plan
 */
export class PdfExportService {
 private static readonly DISCOVERY_PLAN_ID = 'discovery';

 /**
 * Generate PDF with automatic watermark based on plan
 */
 static async generatePdfWithPlanLimits(
 content: (options: ReportOptions) => Promise<void> | void,
 options: PdfExportOptions
 ): Promise<void> {
 try {
 const { planId = PdfExportService.DISCOVERY_PLAN_ID, hasWhiteLabelReports = false, ...pdfOptions } = options;
 
 // Get watermark options based on plan
 const watermarkOptions = PdfService.getWatermarkOptions(planId, hasWhiteLabelReports);
 
 // Merge options with watermark settings
 const finalOptions: ReportOptions = {
 ...pdfOptions,
 watermark: watermarkOptions.watermark
 };

 // Generate PDF with final options
 await content(finalOptions);
 } catch (error) {
 ErrorLogger.error('Failed to generate PDF with plan limits', 'PdfExportService', { error });
 throw error;
 }
 }

 /**
 * Check if export requires upgrade and get appropriate message
 */
 static getExportLimitInfo(planId: string, hasWhiteLabelReports: boolean) {
 const needsUpgrade = !hasWhiteLabelReports && planId === PdfExportService.DISCOVERY_PLAN_ID;
 
 return {
 needsUpgrade,
 message: needsUpgrade 
 ? 'Les rapports professionnels sans filigrane nécessitent le plan Professional (199€/mois).'
 : '',
 willHaveWatermark: PdfService.shouldApplyWatermark(planId, hasWhiteLabelReports),
 watermarkText: PdfService.getWatermarkOptions(planId, hasWhiteLabelReports).watermarkText
 };
 }
}
