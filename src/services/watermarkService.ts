/**
 * Story 27.5 - Watermark Service (Client-side)
 *
 * Service for managing watermark settings and downloading watermarked documents.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase';
import { ErrorLogger } from './errorLogger';
import type { ClassificationLevel } from '@/types/vault';

/**
 * Watermark position options
 */
export type WatermarkPosition = 'diagonal' | 'top' | 'bottom' | 'center';

/**
 * Watermark color configuration
 */
export interface WatermarkColor {
 r: number;
 g: number;
 b: number;
}

/**
 * Watermark settings configuration
 */
export interface WatermarkSettings {
 enabled: boolean;
 text: string;
 position: WatermarkPosition;
 opacity: number;
 fontSize: number;
 color: WatermarkColor;
 includeEmail: boolean;
 includeTimestamp: boolean;
 includeConfidential: boolean;
 confidentialText: string;
 fontFamily?: string;
}

/**
 * Default watermark settings
 */
export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
 enabled: true,
 text: '',
 position: 'diagonal',
 opacity: 0.3,
 fontSize: 24,
 color: { r: 128, g: 128, b: 128 },
 includeEmail: true,
 includeTimestamp: true,
 includeConfidential: true,
 confidentialText: 'CONFIDENTIEL',
};

/**
 * Watermarked download result
 */
export interface WatermarkedDownloadResult {
 success: boolean;
 content: string; // Base64 encoded
 contentType: string;
 filename: string;
 watermarked: boolean;
 watermarkText: string;
}

/**
 * Watermark preview result
 */
export interface WatermarkPreviewResult {
 success: boolean;
 previewText: string;
 config: {
 position: WatermarkPosition;
 opacity: number;
 fontSize: number;
 color: WatermarkColor;
 };
}

/**
 * Firebase error type guard
 */
interface FirebaseError {
 code?: string;
 message?: string;
}

function isFirebaseError(error: unknown): error is FirebaseError {
 return typeof error === 'object' && error !== null && ('code' in error || 'message' in error);
}

/**
 * Watermark Service for managing watermark settings and downloads
 */
export const WatermarkService = {
 /**
 * Get watermark settings for the current organization
 */
 async getWatermarkSettings(): Promise<WatermarkSettings> {
 try {
 const fn = httpsCallable<Record<string, never>, { success: boolean; settings: WatermarkSettings }>(
 functions,
 'getWatermarkSettingsCallable'
 );
 const result = await fn({});
 return result.data.settings;
 } catch (error) {
 ErrorLogger.error(error, 'WatermarkService.getWatermarkSettings');
 // Return defaults on error
 return DEFAULT_WATERMARK_SETTINGS;
 }
 },

 /**
 * Update watermark settings (admin only)
 */
 async updateWatermarkSettings(settings: Partial<WatermarkSettings>): Promise<WatermarkSettings> {
 try {
 const fn = httpsCallable<
 { settings: Partial<WatermarkSettings> },
 { success: boolean; settings: WatermarkSettings }
 >(functions, 'updateWatermarkSettings');

 const result = await fn({ settings });

 if (!result.data.success) {
 throw new Error('Échec de la mise à jour des paramètres');
 }

 return result.data.settings;
 } catch (error) {
 ErrorLogger.error(error, 'WatermarkService.updateWatermarkSettings');

 if (isFirebaseError(error)) {
 if (error.code === 'permission-denied') {
 throw new Error('Acces administrateur requis');
 }
 }

 throw new Error('Échec de la mise à jour des paramètres de filigrane');
 }
 },

 /**
 * Preview watermark text without downloading
 */
 async previewWatermark(classification?: ClassificationLevel): Promise<WatermarkPreviewResult> {
 try {
 const fn = httpsCallable<
 { classification?: ClassificationLevel },
 WatermarkPreviewResult
 >(functions, 'previewWatermark');

 const result = await fn({ classification });
 return result.data;
 } catch (error) {
 ErrorLogger.error(error, 'WatermarkService.previewWatermark');
 throw new Error('Échec de la génération de l\'aperçu');
 }
 },

 /**
 * Download document with watermark applied
 */
 async downloadWithWatermark(documentId: string): Promise<WatermarkedDownloadResult> {
 try {
 const fn = httpsCallable<
 { documentId: string },
 WatermarkedDownloadResult
 >(functions, 'downloadWithWatermark');

 const result = await fn({ documentId });

 if (!result.data.success) {
 throw new Error('Échec du téléchargement');
 }

 return result.data;
 } catch (error) {
 ErrorLogger.error(error, 'WatermarkService.downloadWithWatermark');

 if (isFirebaseError(error)) {
 if (error.code === 'failed-precondition') {
 // Watermarking disabled or unsupported file type
 throw new Error(error.message || 'Filigrane non supporte pour ce type de fichier');
 }
 if (error.code === 'not-found') {
 throw new Error('Document non trouvé');
 }
 if (error.code === 'permission-denied') {
 throw new Error('Accès refusé');
 }
 }

 throw new Error('Échec du téléchargement avec filigrane');
 }
 },

 /**
 * Download base64 content as file
 */
 downloadBase64AsFile(
 base64Content: string,
 filename: string,
 contentType: string
 ): void {
 try {
 // Decode base64 to binary
 const binaryString = atob(base64Content);
 const bytes = new Uint8Array(binaryString.length);
 for (let i = 0; i < binaryString.length; i++) {
 bytes[i] = binaryString.charCodeAt(i);
 }

 // Create blob and download
 const blob = new Blob([bytes], { type: contentType });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = filename;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(url);
 } catch (error) {
 ErrorLogger.error(error, 'WatermarkService.downloadBase64AsFile');
 throw new Error('Échec du téléchargement du fichier');
 }
 },

 /**
 * Check if file type supports watermarking
 */
 isWatermarkableType(mimeType: string): boolean {
 const watermarkableTypes = [
 'application/pdf',
 'image/png',
 'image/jpeg',
 'image/jpg',
 'image/webp',
 ];
 return watermarkableTypes.includes(mimeType);
 },

 /**
 * Get human-readable position label (French)
 */
 getPositionLabel(position: WatermarkPosition): string {
 const labels: Record<WatermarkPosition, string> = {
 diagonal: 'Diagonal',
 top: 'En haut',
 bottom: 'En bas',
 center: 'Centre',
 };
 return labels[position] || position;
 },

 /**
 * Get all position options
 */
 getPositionOptions(): Array<{ value: WatermarkPosition; label: string }> {
 return [
 { value: 'diagonal', label: 'Diagonal' },
 { value: 'top', label: 'En haut' },
 { value: 'bottom', label: 'En bas' },
 { value: 'center', label: 'Centre' },
 ];
 },

 /**
 * Convert color object to CSS hex string
 */
 colorToHex(color: WatermarkColor): string {
 const toHex = (n: number) => n.toString(16).padStart(2, '0');
 return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
 },

 /**
 * Parse hex color to color object
 */
 hexToColor(hex: string): WatermarkColor {
 const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
 if (result) {
 return {
 r: parseInt(result[1], 16),
 g: parseInt(result[2], 16),
 b: parseInt(result[3], 16),
 };
 }
 return { r: 128, g: 128, b: 128 };
 },

 /**
 * Validate watermark settings
 */
 validateSettings(settings: Partial<WatermarkSettings>): {
 valid: boolean;
 errors: string[];
 } {
 const errors: string[] = [];

 if (settings.text && settings.text.length > 200) {
 errors.push('Le texte ne doit pas depasser 200 caracteres');
 }

 if (settings.confidentialText && settings.confidentialText.length > 50) {
 errors.push('Le texte confidentiel ne doit pas depasser 50 caracteres');
 }

 if (settings.opacity !== undefined && (settings.opacity < 0.1 || settings.opacity > 1)) {
 errors.push('L\'opacite doit etre entre 0.1 et 1');
 }

 if (settings.fontSize !== undefined && (settings.fontSize < 8 || settings.fontSize > 72)) {
 errors.push('La taille de police doit etre entre 8 et 72');
 }

 if (settings.color) {
 const { r, g, b } = settings.color;
 if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
 errors.push('Les valeurs de couleur doivent etre entre 0 et 255');
 }
 }

 return {
 valid: errors.length === 0,
 errors,
 };
 },
};

export default WatermarkService;
