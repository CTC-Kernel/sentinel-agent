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
    // private googleRedirectUri = window.location.origin + '/oauth/google/callback';
    // private microsoftRedirectUri = window.location.origin + '/oauth/microsoft/callback';

    // Google Drive
    async connectGoogleDrive(): Promise<string> {
        if (!this.googleClientId) {
            throw new Error('Google Client ID not configured');
        }

        const scope = 'https://www.googleapis.com/auth/drive.file';
        const redirectUri = window.location.origin; // Expecting the app to handle the token parsing on load or a specific callback route
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&include_granted_scopes=true&state=google_drive`;

        return new Promise((resolve, reject) => {
            const width = 500;
            const height = 600;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            const popup = window.open(
                authUrl,
                'Google Drive Auth',
                `width=${width},height=${height},top=${top},left=${left}`
            );

            if (!popup) {
                reject(new Error('Popup blocked. Please allow popups for this site.'));
                return;
            }

            const messageHandler = (event: MessageEvent) => {
                if (event.origin !== window.location.origin) return;

                // Expecting the popup to send back the token or the main window to detect the hash change if it redirects to self
                // For this implementation, we assume the popup redirects to the app, which parses the hash and sends a message
                if (event.data.type === 'OAUTH_SUCCESS' && event.data.provider === 'google') {
                    window.removeEventListener('message', messageHandler);
                    popup.close();
                    resolve(event.data.token);
                } else if (event.data.type === 'OAUTH_ERROR') {
                    window.removeEventListener('message', messageHandler);
                    popup.close();
                    reject(new Error(event.data.error));
                }
            };

            window.addEventListener('message', messageHandler);

            // Cleanup if popup is closed manually
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageHandler);
                    // If we didn't resolve yet, it might be a cancellation
                    // But we can't be sure if it was successful or not without the message
                    // So we don't reject here to avoid race conditions, or we reject with "User cancelled"
                }
            }, 1000);
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
        const redirectUri = window.location.origin;
        const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${this.microsoftClientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=onedrive`;

        return new Promise((resolve, reject) => {
            const width = 500;
            const height = 600;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            const popup = window.open(
                authUrl,
                'Microsoft Auth',
                `width=${width},height=${height},top=${top},left=${left}`
            );

            if (!popup) {
                reject(new Error('Popup blocked. Please allow popups for this site.'));
                return;
            }

            const messageHandler = (event: MessageEvent) => {
                if (event.origin !== window.location.origin) return;

                if (event.data.type === 'OAUTH_SUCCESS' && event.data.provider === 'microsoft') {
                    window.removeEventListener('message', messageHandler);
                    popup.close();
                    resolve(event.data.token);
                } else if (event.data.type === 'OAUTH_ERROR') {
                    window.removeEventListener('message', messageHandler);
                    popup.close();
                    reject(new Error(event.data.error));
                }
            };

            window.addEventListener('message', messageHandler);

            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageHandler);
                }
            }, 1000);
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
