/**
 * Design System Constants
 * Standardized spacing, sizing, and effects for consistent UI
 */

export const SPACING = {
  // Gap spacing
  GAP: {
    XS: 'gap-1',    // 4px
    SM: 'gap-2',    // 8px  
    MD: 'gap-4',    // 16px
    LG: 'gap-6',    // 24px
    XL: 'gap-8',    // 32px
    XXL: 'gap-12',  // 48px
  },
  
  // Padding
  PADDING: {
    XS: 'p-2',      // 8px
    SM: 'p-3',      // 12px
    MD: 'p-4',      // 16px
    LG: 'p-6',      // 24px
    XL: 'p-8',      // 32px
    XXL: 'p-12',    // 48px
  },
  
  // Margin
  MARGIN: {
    XS: 'm-2',      // 8px
    SM: 'm-3',      // 12px
    MD: 'm-4',      // 16px
    LG: 'm-6',      // 24px
    XL: 'm-8',      // 32px
    XXL: 'm-12',    // 48px
  }
} as const;

export const BORDER_RADIUS = {
  // Standardized border radius
  NONE: 'rounded-none',
  XS: 'rounded-sm',     // 6px
  SM: 'rounded',       // 8px
  MD: 'rounded-md',    // 12px
  LG: 'rounded-lg',     // 16px
  XL: 'rounded-xl',     // 20px
  XXL: 'rounded-2xl',  // 24px
  FULL: 'rounded-full',
  
  // Specialized
  CARD: 'rounded-2xl',    // 24px for cards
  BUTTON: 'rounded-xl',    // 20px for buttons
  INPUT: 'rounded-lg',     // 16px for inputs
  MODAL: 'rounded-3xl',   // 32px for modals
} as const;

export const SHADOWS = {
  // Standardized shadows
  NONE: 'shadow-none',
  XS: 'shadow-sm',              // Small shadow
  SM: 'shadow',                // Default shadow
  MD: 'shadow-md',             // Medium shadow
  LG: 'shadow-lg',             // Large shadow
  XL: 'shadow-xl',             // Extra large shadow
  
  // Specialized
  GLASS: 'shadow-glass',        // Glass effect
  GLASS_SM: 'shadow-glass-sm',  // Small glass
  GLASS_MD: 'shadow-glass-md',  // Medium glass
  GLASS_LG: 'shadow-glass-lg',  // Large glass
  GLOW: 'shadow-glow',          // Brand glow
  GLOW_SM: 'shadow-glow-sm',    // Small glow
  CARD: 'shadow-card',          // Card shadow
  FLOAT: 'shadow-float',        // Floating effect
} as const;

export const ANIMATIONS = {
  // Standardized animations
  SCALE: {
    NONE: 'scale-100',
    SM: 'scale-105',      // 5% scale
    MD: 'scale-110',      // 10% scale
    LG: 'scale-125',      // 25% scale
  },
  
  TRANSITIONS: {
    FAST: 'transition-all duration-150',
    NORMAL: 'transition-all duration-300',
    SLOW: 'transition-all duration-500',
  },
  
  HOVER: {
    LIFT: 'hover:-translate-y-1',
    SCALE_SM: 'hover:scale-105',
    SCALE_MD: 'hover:scale-110',
    GLOW: 'hover:shadow-glow',
  },
  
  ACTIVE: {
    PRESS: 'active:scale-95',
    PRESS_MD: 'active:scale-98',
  }
} as const;

export const TYPOGRAPHY = {
  // Standardized font sizes
  SIZES: {
    XS: 'text-xs',      // 12px
    SM: 'text-sm',      // 14px
    BASE: 'text-base',  // 16px
    LG: 'text-lg',      // 18px
    XL: 'text-xl',      // 20px
    '2XL': 'text-2xl', // 24px
    '3XL': 'text-3xl', // 30px
    '4XL': 'text-4xl', // 36px
  },
  
  WEIGHTS: {
    LIGHT: 'font-light',
    NORMAL: 'font-normal',
    MEDIUM: 'font-medium',
    SEMIBOLD: 'font-semibold',
    BOLD: 'font-bold',
  }
} as const;

// Utility functions for consistent usage
export const getGapClass = (size: keyof typeof SPACING.GAP) => SPACING.GAP[size];
export const getRadiusClass = (size: keyof typeof BORDER_RADIUS) => BORDER_RADIUS[size];
export const getShadowClass = (size: keyof typeof SHADOWS) => SHADOWS[size];
export const getAnimationClass = (type: keyof typeof ANIMATIONS.SCALE) => ANIMATIONS.SCALE[type];

// Default combinations
export const DEFAULTS = {
  BUTTON: `${BORDER_RADIUS.BUTTON} ${SHADOWS.MD} ${ANIMATIONS.TRANSITIONS.NORMAL} ${ANIMATIONS.HOVER.LIFT} ${ANIMATIONS.ACTIVE.PRESS}`,
  CARD: `${BORDER_RADIUS.CARD} ${SHADOWS.GLASS} ${ANIMATIONS.TRANSITIONS.NORMAL}`,
  INPUT: `${BORDER_RADIUS.INPUT} ${SHADOWS.XS} ${ANIMATIONS.TRANSITIONS.FAST}`,
  MODAL: `${BORDER_RADIUS.MODAL} ${SHADOWS.XL}`,
} as const;
