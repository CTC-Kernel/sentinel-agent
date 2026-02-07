/**
 * Utility functions for user avatars and profile images
 *
 * Uses optimized local WebP avatar images by role, with PNG fallback.
 */

/**
 * Map of role names to their local avatar file paths (WebP).
 * Original PNGs are kept alongside as fallback.
 */
const ROLE_AVATAR_MAP: Record<string, string> = {
  admin: '/avatar_admin.webp',
  auditor: '/avatar_auditor.webp',
  rssi: '/avatar_rssi.webp',
  project_manager: '/avatar_project_manager.webp',
  direction: '/avatar_direction.webp',
  user: '/avatar_user.webp',
};

/**
 * Returns the default avatar URL for users without a photo, optionally based on role.
 * Uses local optimized WebP images served from public/.
 */
export const getDefaultAvatarUrl = (role?: string): string => {
  const normalizedRole = role ? role.toLowerCase() : 'user';
  return ROLE_AVATAR_MAP[normalizedRole] || ROLE_AVATAR_MAP['user'];
};

/**
 * Returns the PNG fallback avatar URL for a given role.
 * Used as onError fallback when WebP is not supported.
 */
export const getDefaultAvatarFallbackUrl = (role?: string): string => {
  const normalizedRole = role ? role.toLowerCase() : 'user';
  const pngMap: Record<string, string> = {
    admin: '/avatar_admin.png',
    auditor: '/avatar_auditor.png',
    rssi: '/avatar_rssi.png',
    project_manager: '/avatar_project_manager.png',
    direction: '/avatar_direction.png',
    user: '/avatar_user.png',
  };
  return pngMap[normalizedRole] || pngMap['user'];
};

/**
 * Returns the appropriate avatar URL for a user.
 * Uses the user's photoURL if available, otherwise returns the local WebP avatar based on role.
 */
export const getUserAvatarUrl = (photoURL?: string | null, role?: string): string => {
  const defaultUrl = getDefaultAvatarUrl(role);
  const result = photoURL || defaultUrl;
  return result;
};

/**
 * Returns the appropriate avatar source for an img element.
 * This is useful when you want to use the default avatar as a fallback.
 */
export const getAvatarSrc = (photoURL?: string | null, role?: string): string => {
  return photoURL || getDefaultAvatarUrl(role);
};
