import { ErrorLogger } from '../services/errorLogger';

const envBaseUrl = import.meta.env.VITE_APP_BASE_URL as string | undefined;

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '');

export const APP_BASE_URL: string = (() => {
 if (envBaseUrl && envBaseUrl.trim().length > 0) {
 return normalizeBaseUrl(envBaseUrl.trim());
 }

 if (import.meta.env.PROD) {
 throw new Error('Missing required environment variable: VITE_APP_BASE_URL');
 }

 if (import.meta.env.MODE !== 'test') {
 ErrorLogger.warn('VITE_APP_BASE_URL is not defined. APP_BASE_URL will be empty and email links may be relative only.', 'appConfig.ts');
 }
 return '';
})();

export const buildAppUrl = (path: string): string => {
 const normalizedPath = path.startsWith('/') ? path : `/${path}`;
 if (!APP_BASE_URL) {
 return normalizedPath;
 }
 return `${APP_BASE_URL}${normalizedPath}`;
};
