import { ErrorLogger } from './errorLogger';

export interface ExternalFile {
    id: string;
    name: string;
    webViewLink: string;
    thumbnailLink?: string;
    mimeType: string;
    provider: 'google_drive' | 'onedrive' | 'sharepoint';
}

class ExternalStorageService {
    private googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    private microsoftClientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';
    private googleRedirectUri = window.location.origin + '/oauth/google/callback';
    private microsoftRedirectUri = window.location.origin + '/oauth/microsoft/callback';

    // Google Drive
    async connectGoogleDrive(): Promise<string> {
        if (!this.googleClientId) {
            throw new Error('Google Client ID not configured');
        }

        const scope = 'https://www.googleapis.com/auth/drive.file';
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.googleClientId}&redirect_uri=${encodeURIComponent(this.googleRedirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&include_granted_scopes=true&state=pass-through-value`;

        // In a real app, you might use a popup or redirect. 
        // For this implementation, we'll assume a popup flow or similar.
        // Since we can't easily implement the full callback handler here without routing changes,
        // we'll simulate the token retrieval or use a simplified flow if possible.

        // Ideally, use the Google Identity Services (GIS) library:
        // google.accounts.oauth2.initTokenClient(...)

        return new Promise((resolve, reject) => {
            // Placeholder for actual OAuth flow
            // window.open(authUrl, '_blank', 'width=500,height=600');
            // Listen for message from popup...

            // For now, returning a mock token to allow UI testing if keys are missing
            console.warn('Google OAuth flow not fully implemented without valid Client ID and callback route.');
            // resolve('mock-google-token');
            reject(new Error('Google OAuth flow requires configuration and callback implementation.'));
        });
    }

    async listGoogleDriveFiles(accessToken: string): Promise<ExternalFile[]> {
        try {
            const response = await fetch('https://www.googleapis.com/drive/v3/files?q=trashed=false&fields=files(id,name,webViewLink,thumbnailLink,mimeType)', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch Google Drive files');

            const data = await response.json();
            return data.files.map((f: any) => ({
                id: f.id,
                name: f.name,
                webViewLink: f.webViewLink,
                thumbnailLink: f.thumbnailLink,
                mimeType: f.mimeType,
                provider: 'google_drive'
            }));
        } catch (error) {
            ErrorLogger.error(error as Error, 'ExternalStorageService.listGoogleDriveFiles');
            throw error;
        }
    }

    // OneDrive / SharePoint (via MS Graph)
    async connectOneDrive(): Promise<string> {
        if (!this.microsoftClientId) {
            throw new Error('Microsoft Client ID not configured');
        }

        const scope = 'Files.ReadWrite';
        const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${this.microsoftClientId}&response_type=token&redirect_uri=${encodeURIComponent(this.microsoftRedirectUri)}&scope=${encodeURIComponent(scope)}`;

        return new Promise((resolve, reject) => {
            // Placeholder for actual OAuth flow
            console.warn('Microsoft OAuth flow not fully implemented without valid Client ID and callback route.');
            reject(new Error('Microsoft OAuth flow requires configuration and callback implementation.'));
        });
    }

    async listOneDriveFiles(accessToken: string): Promise<ExternalFile[]> {
        try {
            const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch OneDrive files');

            const data = await response.json();
            return data.value.map((f: any) => ({
                id: f.id,
                name: f.name,
                webViewLink: f.webUrl,
                thumbnailLink: f.thumbnails?.[0]?.small?.url,
                mimeType: f.file?.mimeType || 'application/octet-stream',
                provider: 'onedrive'
            }));
        } catch (error) {
            ErrorLogger.error(error as Error, 'ExternalStorageService.listOneDriveFiles');
            throw error;
        }
    }
}

export const externalStorageService = new ExternalStorageService();
