/**
 * Utility functions for user avatars and profile images
 */

/**
 * Returns the default avatar URL for users without a photo, optionally based on role
 */
export const getDefaultAvatarUrl = (role?: string): string => {
  if (!role) return '/avatar_user.png';

  const normalizedRole = role.toLowerCase();

  switch (normalizedRole) {
    case 'admin':
      return '/avatar_admin.png';
    case 'auditor':
      return '/avatar_auditor.png';
    case 'rssi':
      return '/avatar_rssi.png';
    case 'project_manager':
      return '/avatar_project_manager.png';
    case 'direction':
      return '/avatar_direction.png';
    case 'user':
    default:
      return '/avatar_user.png';
  }
};

/**
 * Returns the appropriate avatar URL for a user
 * Uses the user's photoURL if available, otherwise returns the default avatar based on role
 */
export const getUserAvatarUrl = (photoURL?: string | null, role?: string): string => {
  const defaultUrl = getDefaultAvatarUrl(role);
  const result = photoURL || defaultUrl;
  return result;
};

/**
 * Returns the appropriate avatar source for an img element
 * This is useful when you want to use the default avatar as a fallback
 */
export const getAvatarSrc = (photoURL?: string | null, role?: string): string => {
  return photoURL || getDefaultAvatarUrl(role);
};
