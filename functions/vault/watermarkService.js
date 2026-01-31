/**
 * Story 27.5 - Watermark Service
 *
 * Cloud Functions for applying watermarks to downloaded documents.
 * Supports PDF watermarking using pdf-lib and image watermarking using sharp.
 *
 * Watermarks include:
 * - User email and timestamp
 * - "CONFIDENTIAL" for classified documents
 * - Organization branding (optional)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const sharp = require('sharp');
const { logWatermarkedDownload } = require('./auditLogger');

const WATERMARK_SETTINGS_COLLECTION = 'watermark_settings';

/**
 * Default watermark configuration
 */
const DEFAULT_WATERMARK_CONFIG = {
  enabled: true,
  text: '',
  position: 'diagonal', // diagonal, top, bottom, center
  opacity: 0.3,
  fontSize: 24,
  color: { r: 128, g: 128, b: 128 },
  includeEmail: true,
  includeTimestamp: true,
  includeConfidential: true,
  confidentialText: 'CONFIDENTIEL',
  fontFamily: 'Helvetica',
};

/**
 * Get watermark settings for an organization
 */
async function getWatermarkSettings(organizationId) {
  const db = getFirestore();

  try {
    const settingsRef = db.collection(WATERMARK_SETTINGS_COLLECTION).doc(organizationId);
    const settingsSnap = await settingsRef.get();

    if (!settingsSnap.exists) {
      return DEFAULT_WATERMARK_CONFIG;
    }

    return {
      ...DEFAULT_WATERMARK_CONFIG,
      ...settingsSnap.data(),
    };
  } catch (error) {
    logger.error('Error getting watermark settings:', error);
    return DEFAULT_WATERMARK_CONFIG;
  }
}

/**
 * Build watermark text from config and context
 */
function buildWatermarkText(config, context) {
  const parts = [];

  if (config.text) {
    parts.push(config.text);
  }

  if (config.includeEmail && context.userEmail) {
    parts.push(context.userEmail);
  }

  if (config.includeTimestamp) {
    const now = new Date();
    parts.push(now.toISOString().split('T')[0] + ' ' + now.toISOString().split('T')[1].split('.')[0]);
  }

  if (config.includeConfidential && context.classification === 'confidential') {
    parts.push(config.confidentialText || 'CONFIDENTIEL');
  }

  if (config.includeConfidential && context.classification === 'secret') {
    parts.push('SECRET');
  }

  return parts.join(' - ');
}

/**
 * Apply watermark to PDF document
 */
async function applyPdfWatermark(pdfBuffer, watermarkText, config) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const fontSize = config.fontSize || 24;
    const opacity = config.opacity || 0.3;
    const color = config.color || { r: 128, g: 128, b: 128 };

    for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);

      if (config.position === 'diagonal') {
        // Diagonal watermark across the page
        page.drawText(watermarkText, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(color.r / 255, color.g / 255, color.b / 255),
          opacity,
          rotate: { type: 'degrees', angle: -45 },
        });
      } else if (config.position === 'top') {
        page.drawText(watermarkText, {
          x: width / 2 - textWidth / 2,
          y: height - 30,
          size: fontSize * 0.75,
          font,
          color: rgb(color.r / 255, color.g / 255, color.b / 255),
          opacity,
        });
      } else if (config.position === 'bottom') {
        page.drawText(watermarkText, {
          x: width / 2 - textWidth / 2,
          y: 20,
          size: fontSize * 0.75,
          font,
          color: rgb(color.r / 255, color.g / 255, color.b / 255),
          opacity,
        });
      } else if (config.position === 'center') {
        page.drawText(watermarkText, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(color.r / 255, color.g / 255, color.b / 255),
          opacity,
        });
      }
    }

    return await pdfDoc.save();
  } catch (error) {
    logger.error('PDF watermark error:', error);
    throw new Error('Failed to apply PDF watermark');
  }
}

/**
 * Apply watermark to image
 */
async function applyImageWatermark(imageBuffer, watermarkText, config) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const fontSize = Math.min(config.fontSize || 24, Math.floor(metadata.width / 30));
    const opacity = config.opacity || 0.3;
    const color = config.color || { r: 128, g: 128, b: 128 };

    // Create SVG watermark
    const svgText = `
      <svg width="${metadata.width}" height="${metadata.height}">
        <style>
          .watermark {
            fill: rgba(${color.r}, ${color.g}, ${color.b}, ${opacity});
            font-size: ${fontSize}px;
            font-family: Arial, sans-serif;
          }
        </style>
        ${config.position === 'diagonal' ? `
          <text
            x="${metadata.width / 2}"
            y="${metadata.height / 2}"
            class="watermark"
            text-anchor="middle"
            transform="rotate(-45, ${metadata.width / 2}, ${metadata.height / 2})"
          >${escapeXml(watermarkText)}</text>
        ` : config.position === 'top' ? `
          <text
            x="${metadata.width / 2}"
            y="${fontSize + 10}"
            class="watermark"
            text-anchor="middle"
          >${escapeXml(watermarkText)}</text>
        ` : config.position === 'bottom' ? `
          <text
            x="${metadata.width / 2}"
            y="${metadata.height - 10}"
            class="watermark"
            text-anchor="middle"
          >${escapeXml(watermarkText)}</text>
        ` : `
          <text
            x="${metadata.width / 2}"
            y="${metadata.height / 2}"
            class="watermark"
            text-anchor="middle"
          >${escapeXml(watermarkText)}</text>
        `}
      </svg>
    `;

    const watermarkBuffer = Buffer.from(svgText);

    const result = await image
      .composite([{ input: watermarkBuffer, top: 0, left: 0 }])
      .toBuffer();

    return result;
  } catch (error) {
    logger.error('Image watermark error:', error);
    throw new Error('Failed to apply image watermark');
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Determine if file type supports watermarking
 */
function isWatermarkableType(mimeType) {
  const watermarkableTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ];
  return watermarkableTypes.includes(mimeType);
}

/**
 * Apply watermark to document content
 * Main entry point for watermarking
 */
async function applyWatermark(content, mimeType, watermarkText, config) {
  if (mimeType === 'application/pdf') {
    return await applyPdfWatermark(content, watermarkText, config);
  } else if (mimeType.startsWith('image/')) {
    return await applyImageWatermark(content, watermarkText, config);
  } else {
    // Return original content for unsupported types
    return content;
  }
}

/**
 * Callable function to apply watermark and return document
 */
exports.downloadWithWatermark = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 300,
    memory: '1GiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { documentId, filePath } = request.data;
    if (!documentId && !filePath) {
      throw new HttpsError('invalid-argument', 'documentId or filePath required');
    }

    const userId = request.auth.uid;
    const userEmail = request.auth.token.email || 'unknown';
    const db = getFirestore();
    const storage = getStorage();

    try {
      // Get document metadata from Firestore
      let docData = null;
      let storagePath = filePath;
      const organizationId = request.auth.token.organizationId;

      if (!organizationId) {
        throw new HttpsError('permission-denied', 'No organization context');
      }

      if (documentId) {
        const docRef = db.collection('documents').doc(documentId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          throw new HttpsError('not-found', 'Document not found');
        }

        docData = docSnap.data();
        storagePath = docData.url || docData.storagePath;

        // Check user authorization: document must belong to the user's organization
        if (docData.organizationId !== organizationId) {
          throw new HttpsError('permission-denied', 'Access denied');
        }
      }

      // Get watermark settings for organization
      const watermarkConfig = await getWatermarkSettings(organizationId);

      if (!watermarkConfig.enabled) {
        // Watermarking disabled - return original document
        // This should fall through to regular decryptOnDownload
        throw new HttpsError('failed-precondition', 'Watermarking is disabled');
      }

      // Get file from Cloud Storage
      const bucket = storage.bucket();
      const file = bucket.file(storagePath);

      const [exists] = await file.exists();
      if (!exists) {
        throw new HttpsError('not-found', 'File not found in storage');
      }

      // Get file metadata
      const [metadata] = await file.getMetadata();
      const mimeType = metadata.contentType || 'application/octet-stream';

      // Check if file type is watermarkable
      if (!isWatermarkableType(mimeType)) {
        throw new HttpsError(
          'failed-precondition',
          'File type does not support watermarking'
        );
      }

      // Download file content
      const [content] = await file.download();

      // Decrypt if needed (similar to decryptOnDownload)
      let decryptedContent = content;
      const isEncrypted = metadata.metadata?.encrypted === 'true';

      if (isEncrypted) {
        const { KeyManagementServiceClient } = require('@google-cloud/kms');
        const kmsClient = new KeyManagementServiceClient();

        const VAULT_CONFIG = {
          keyRingId: 'sentinel-vault',
          cryptoKeyId: 'documents-key',
          location: 'europe-west1',
          projectId: process.env.GCLOUD_PROJECT || '',
        };

        const keyPath = `projects/${VAULT_CONFIG.projectId}/locations/${VAULT_CONFIG.location}/keyRings/${VAULT_CONFIG.keyRingId}/cryptoKeys/${VAULT_CONFIG.cryptoKeyId}`;

        const [decryptResponse] = await kmsClient.decrypt({
          name: keyPath,
          ciphertext: content,
        });

        decryptedContent = decryptResponse.plaintext;
      }

      // Build watermark text
      const watermarkText = buildWatermarkText(watermarkConfig, {
        userEmail,
        classification: docData?.classification?.level,
      });

      // Apply watermark
      const watermarkedContent = await applyWatermark(
        decryptedContent,
        mimeType,
        watermarkText,
        watermarkConfig
      );

      // Log watermarked download
      if (documentId) {
        await logWatermarkedDownload(documentId, organizationId, userId, userEmail, {
          text: watermarkText,
          position: watermarkConfig.position,
        });
      }

      // Return watermarked content as base64
      return {
        success: true,
        content: Buffer.from(watermarkedContent).toString('base64'),
        contentType: mimeType,
        filename: metadata.name?.split('/').pop(),
        watermarked: true,
        watermarkText,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Watermark error:', error);
      throw new HttpsError('internal', 'Failed to apply watermark');
    }
  }
);

/**
 * Callable function to get/update watermark settings
 */
exports.getWatermarkSettingsCallable = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const organizationId = request.auth.token.organizationId;

    try {
      const settings = await getWatermarkSettings(organizationId);
      return {
        success: true,
        settings,
      };
    } catch (error) {
      logger.error('Get watermark settings error:', error);
      throw new HttpsError('internal', 'Failed to get watermark settings');
    }
  }
);

/**
 * Callable function to update watermark settings (admin only)
 */
exports.updateWatermarkSettings = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userRole = request.auth.token.role || 'user';
    if (!['admin', 'rssi', 'super_admin'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { settings } = request.data;
    if (!settings || typeof settings !== 'object') {
      throw new HttpsError('invalid-argument', 'Settings object required');
    }

    const organizationId = request.auth.token.organizationId;
    const db = getFirestore();

    try {
      const settingsRef = db.collection(WATERMARK_SETTINGS_COLLECTION).doc(organizationId);

      // Validate and sanitize settings
      const validSettings = {
        enabled: typeof settings.enabled === 'boolean' ? settings.enabled : true,
        text: typeof settings.text === 'string' ? settings.text.substring(0, 200) : '',
        position: ['diagonal', 'top', 'bottom', 'center'].includes(settings.position)
          ? settings.position
          : 'diagonal',
        opacity: typeof settings.opacity === 'number'
          ? Math.max(0.1, Math.min(1, settings.opacity))
          : 0.3,
        fontSize: typeof settings.fontSize === 'number'
          ? Math.max(8, Math.min(72, settings.fontSize))
          : 24,
        color: settings.color && typeof settings.color === 'object'
          ? {
              r: Math.max(0, Math.min(255, settings.color.r || 128)),
              g: Math.max(0, Math.min(255, settings.color.g || 128)),
              b: Math.max(0, Math.min(255, settings.color.b || 128)),
            }
          : { r: 128, g: 128, b: 128 },
        includeEmail: typeof settings.includeEmail === 'boolean' ? settings.includeEmail : true,
        includeTimestamp: typeof settings.includeTimestamp === 'boolean' ? settings.includeTimestamp : true,
        includeConfidential: typeof settings.includeConfidential === 'boolean' ? settings.includeConfidential : true,
        confidentialText: typeof settings.confidentialText === 'string'
          ? settings.confidentialText.substring(0, 50)
          : 'CONFIDENTIEL',
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
      };

      await settingsRef.set(validSettings, { merge: true });

      return {
        success: true,
        settings: validSettings,
      };
    } catch (error) {
      logger.error('Update watermark settings error:', error);
      throw new HttpsError('internal', 'Failed to update watermark settings');
    }
  }
);

/**
 * Preview watermark text without applying
 */
exports.previewWatermark = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userEmail = request.auth.token.email || 'example@email.com';
    const organizationId = request.auth.token.organizationId;
    const { classification } = request.data;

    try {
      const config = await getWatermarkSettings(organizationId);

      const previewText = buildWatermarkText(config, {
        userEmail,
        classification: classification || 'internal',
      });

      return {
        success: true,
        previewText,
        config: {
          position: config.position,
          opacity: config.opacity,
          fontSize: config.fontSize,
          color: config.color,
        },
      };
    } catch (error) {
      logger.error('Preview watermark error:', error);
      throw new HttpsError('internal', 'Failed to generate preview');
    }
  }
);

module.exports = {
  downloadWithWatermark: exports.downloadWithWatermark,
  getWatermarkSettingsCallable: exports.getWatermarkSettingsCallable,
  updateWatermarkSettings: exports.updateWatermarkSettings,
  previewWatermark: exports.previewWatermark,
  // Internal exports for use by other modules
  applyWatermark,
  buildWatermarkText,
  getWatermarkSettings,
  isWatermarkableType,
  DEFAULT_WATERMARK_CONFIG,
};
