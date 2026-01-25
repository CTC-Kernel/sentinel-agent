/**
 * Utility functions for user avatars and profile images
 */

/**
 * Returns the default avatar URL for users without a photo, optionally based on role
 */
export const getDefaultAvatarUrl = (role?: string): string => {
  const name = role ? role.toUpperCase() : 'USER';
  // Apple-like neutral style: Light gray background, dark gray text, sleek look
  // Using ui-avatars.com service
  return `https://ui-avatars.com/api/?name=${name}&background=f1f5f9&color=475569&bold=true&font-size=0.45&length=2`;
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
