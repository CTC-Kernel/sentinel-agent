/**
 * Validates if a URL is safe for navigation
 * Prevents open redirects and XSS via javascript: URLs
 */
export const isSafeUrl = (url: string): boolean => {
 if (!url) return false;
 if (url.length > 2048) return false;

 // Allow relative paths
 if (url.startsWith('/')) return true;

 // Allow hash fragments
 if (url.startsWith('#')) return true;

 // Block javascript: and data: URLs
 const lowerUrl = url.toLowerCase().trim();
 if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:')) {
 return false;
 }

 // Allow http/https
 if (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
 return true;
 }

 // Allow mailto: and tel:
 if (lowerUrl.startsWith('mailto:') || lowerUrl.startsWith('tel:')) {
 return true;
 }

 // Default: block unknown schemes (including blob:)
 return false;
};

/**
 * Validates if a blob: URL is safe for file downloads.
 * blob: URLs are created locally by URL.createObjectURL and should only
 * be used for downloading generated files, not for general navigation.
 */
export const isSafeBlobUrl = (url: string): boolean => {
 if (!url) return false;
 const lowerUrl = url.toLowerCase().trim();
 return lowerUrl.startsWith('blob:http://') || lowerUrl.startsWith('blob:https://');
};

/**
 * Validates and returns URL for safe navigation, or null if unsafe
 */
export const validateUrl = (url: string): string | null => {
 return isSafeUrl(url) ? url : null;
};
