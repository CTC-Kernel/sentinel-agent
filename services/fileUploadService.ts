import { uploadBytesResumable, getDownloadURL, ref, deleteObject, listAll } from 'firebase/storage';
import { storage } from '../firebase';

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
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, path);
        const customMetadata: Record<string, string> = {
            uploadedAt: new Date().toISOString(),
            uploadedBy: metadata?.uploadedBy || '',
            organizationId: metadata?.organizationId || '',
            name: metadata?.name || file.name,
            size: String(metadata?.size || file.size),
            type: metadata?.type || file.type,
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
                console.error('Error uploading file:', error);
                reject(new Error('Failed to upload file. Please try again.'));
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadURL);
                } catch (_error) {
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
        console.error('Error deleting file:', error);
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
        console.error('Error listing files:', error);
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
 * Validate file before upload
 * @param file File to validate
 * @param maxSizeMB Maximum file size in MB
 * @param allowedTypes Allowed MIME types
 * @returns Validation result
 */
export const validateFile = (
    file: File,
    maxSizeMB: number = 10,
    allowedTypes: string[] = ['image/*', 'application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
): { valid: boolean; error?: string } => {
    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return {
            valid: false,
            error: `File size exceeds ${maxSizeMB}MB limit`,
        };
    }

    // Check file type
    const isAllowed = allowedTypes.some(type => {
        if (type.endsWith('/*')) {
            const category = type.split('/')[0];
            return file.type.startsWith(category + '/');
        }
        return file.type === type;
    });

    if (!isAllowed) {
        return {
            valid: false,
            error: 'File type not allowed',
        };
    }

    return { valid: true };
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
