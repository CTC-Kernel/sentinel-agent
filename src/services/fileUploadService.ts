import { uploadBytesResumable, getDownloadURL, ref, deleteObject, listAll } from 'firebase/storage';
import { storage } from '../firebase';
import { ErrorLogger } from './errorLogger';

export interface UploadProgress {
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
  organizationId: string;
  hash?: string;
  isSecure?: string; // Metadata values must be strings
}

/**
 * Upload a file to Firebase Storage
 * @param file File to upload
 * @param path Storage path (e.g., 'documents/org123/file.pdf')
 * @param metadata Additional metadata
 * @returns Download URL of uploaded file
 */
export const uploadFile = async (
  file: File,
  path: string,
  metadata?: Partial<FileMetadata>,
  onProgress?: (progress: number) => void
): Promise<string> => {
  // Validate file before upload
  const validation = validateFile(file, { maxSizeMB: 50 });
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }

  // Sanitize the path to prevent directory traversal
  const sanitizedPath = path.replace(/\.\./g, '').replace(/\/\//g, '/');

  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, sanitizedPath);
    const customMetadata: Record<string, string> = {
      uploadedAt: new Date().toISOString(),
      uploadedBy: metadata?.uploadedBy || '',
      organizationId: metadata?.organizationId || '',
      name: metadata?.name || file.name,
      size: String(metadata?.size || file.size),
      type: metadata?.type || file.type,
      hash: metadata?.hash || '',
      isSecure: metadata?.isSecure || 'false',
    };

    const uploadTask = uploadBytesResumable(storageRef, file, {
      customMetadata: customMetadata,
      contentType: file.type,
    });

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        ErrorLogger.error(error, 'FileUploadService.uploadFile');
        reject(new Error('Failed to upload file. Please try again.'));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);

        } catch (error) {
          ErrorLogger.error(error, 'FileUploadService.uploadFile.getDownloadURL');
          reject(new Error('Failed to get download URL.'));
        }
      }
    );
  });
};

/**
 * Delete a file from Firebase Storage
 * @param path Storage path
 */
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    ErrorLogger.error(error, 'FileUploadService.deleteFile');
    throw new Error('Failed to delete file.');
  }
};

/**
 * List all files in a directory
 * @param path Directory path
 * @returns Array of file references
 */
export const listFiles = async (path: string) => {
  try {
    const storageRef = ref(storage, path);
    const result = await listAll(storageRef);
    return result.items;
  } catch (error) {
    ErrorLogger.error(error, 'FileUploadService.listFiles');
    throw new Error('Failed to list files.');
  }
};

/**
 * Generate a unique file path
 * @param organizationId Organization ID
 * @param category Category (e.g., 'documents', 'evidence', 'avatars')
 * @param fileName Original file name
 * @returns Unique storage path
 */
export const generateFilePath = (
  organizationId: string,
  category: string,
  fileName: string
): string => {
  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${category}/${organizationId}/${timestamp}_${sanitizedName}`;
};

/**
 * Dangerous file extensions that should never be uploaded
 */
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar',
  '.msi', '.dll', '.scr', '.com', '.pif', '.hta', '.cpl',
  '.reg', '.inf', '.lnk', '.url', '.iso', '.dmg', '.app'
];

/**
 * Safe file extensions for GRC documents
 */
export const ALLOWED_EXTENSIONS = {
  documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.txt', '.rtf', '.csv'],
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'],
  archives: ['.zip', '.rar', '.7z', '.tar', '.gz'],
  evidence: ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.eml', '.msg']
};

/**
 * MIME types mapping for validation
 */
const MIME_TYPE_MAP: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  'application/x-7z-compressed': ['.7z']
};

/**
 * Validate file before upload with enhanced security
 * @param file File to validate
 * @param options Validation options
 * @returns Validation result
 */
export const validateFile = (
  file: File,
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
    category?: 'documents' | 'images' | 'archives' | 'evidence';
  } = {}
): { valid: boolean; error?: string } => {
  const {
    maxSizeMB = 10,
    allowedTypes = ['image/*', 'application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    allowedExtensions,
    category
  } = options;

  // 1. Check file name for path traversal attacks
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return {
      valid: false,
      error: 'Nom de fichier invalide',
    };
  }

  // 2. Get file extension
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();

  // 3. Block dangerous extensions
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: 'Type de fichier non autorisé pour des raisons de sécurité',
    };
  }

  // 4. Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `La taille du fichier dépasse la limite de ${maxSizeMB} Mo`,
    };
  }

  // 5. Check file size minimum (empty files)
  if (file.size === 0) {
    return {
      valid: false,
      error: 'Le fichier est vide',
    };
  }

  // 6. Check extension against category if provided
  if (category && ALLOWED_EXTENSIONS[category]) {
    if (!ALLOWED_EXTENSIONS[category].includes(ext)) {
      return {
        valid: false,
        error: `Extension non autorisée pour cette catégorie. Extensions acceptées: ${ALLOWED_EXTENSIONS[category].join(', ')}`,
      };
    }
  }

  // 7. Check extension against explicit list if provided
  if (allowedExtensions && !allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Extension non autorisée. Extensions acceptées: ${allowedExtensions.join(', ')}`,
    };
  }

  // 8. Validate MIME type matches extension (prevent spoofing)
  if (file.type && MIME_TYPE_MAP[file.type]) {
    const expectedExtensions = MIME_TYPE_MAP[file.type];
    if (!expectedExtensions.includes(ext)) {
      return {
        valid: false,
        error: 'Le type de fichier ne correspond pas à son extension',
      };
    }
  }

  // 9. Check MIME type against allowed types
  const isAllowed = allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      const category = type.split('/')[0];
      return file.type.startsWith(category + '/');
    }
    return file.type === type;
  });

  if (!isAllowed && file.type) {
    return {
      valid: false,
      error: 'Type de fichier non autorisé',
    };
  }

  return { valid: true };
};

/**
 * Validate file with strict security for user uploads
 */
export const validateSecureUpload = (
  file: File,
  maxSizeMB: number = 5
): { valid: boolean; error?: string } => {
  return validateFile(file, {
    maxSizeMB,
    category: 'evidence',
    allowedTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ]
  });
};

/**
 * Format file size for display
 * @param bytes File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
