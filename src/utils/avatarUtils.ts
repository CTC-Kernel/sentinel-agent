/**
 * Utility functions for user avatars and profile images
 */

/**
 * Returns the default avatar URL for users without a photo
 */
export const getDefaultAvatarUrl = (): string => {
  return '/user.png';
};

/**
 * Returns the appropriate avatar URL for a user
 * Uses the user's photoURL if available, otherwise returns the default avatar
 */
export const getUserAvatarUrl = (photoURL?: string | null): string => {
  const defaultUrl = getDefaultAvatarUrl();
  const result = photoURL || defaultUrl;
  return result;
};

/**
 * Returns the appropriate avatar source for an img element
 * This is useful when you want to use the default avatar as a fallback
 */
export const getAvatarSrc = (photoURL?: string | null): string => {
  return photoURL || getDefaultAvatarUrl();
};
