/**
 * usePrefersReducedMotion Tests
 *
 * @see Story VOX-8.4: Reduced Motion Support
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePrefersReducedMotion,
  getAnimationDuration,
  getTransitionStyle,
} from '../usePrefersReducedMotion';

// ============================================================================
// Mocks
// ============================================================================

let mockMatches = false;
let changeHandler: ((event: MediaQueryListEvent) => void) | null = null;

const mockMediaQueryList = {
  matches: false,
  media: '(prefers-reduced-motion: reduce)',
  addEventListener: vi.fn((_, handler) => {
    changeHandler = handler;
  }),
  removeEventListener: vi.fn(() => {
    changeHandler = null;
  }),
  // Legacy API
  addListener: vi.fn((handler) => {
    changeHandler = handler;
  }),
  removeListener: vi.fn(() => {
    changeHandler = null;
  }),
};

const mockMatchMedia = vi.fn(() => ({
  ...mockMediaQueryList,
  matches: mockMatches,
}));

// ============================================================================
// Tests
// ============================================================================

describe('usePrefersReducedMotion', () => {
  beforeEach(() => {
    mockMatches = false;
    changeHandler = null;
    vi.stubGlobal('matchMedia', mockMatchMedia);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should return false when user does not prefer reduced motion', () => {
    mockMatches = false;

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);
  });

  it('should return true when user prefers reduced motion', () => {
    mockMatches = true;

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(true);
  });

  it('should update when media query changes', () => {
    mockMatches = false;

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);

    // Simulate media query change
    act(() => {
      if (changeHandler) {
        changeHandler({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(result.current).toBe(true);
  });

  it('should clean up event listener on unmount', () => {
    const { unmount } = renderHook(() => usePrefersReducedMotion());

    unmount();

    expect(mockMediaQueryList.removeEventListener).toHaveBeenCalled();
  });

  it('should return false when matchMedia returns false', () => {
    mockMatches = false;

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);
    expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
});

describe('getAnimationDuration', () => {
  it('should return 0 when reduced motion is preferred', () => {
    expect(getAnimationDuration(300, true)).toBe(0);
    expect(getAnimationDuration(1000, true)).toBe(0);
  });

  it('should return original duration when reduced motion is not preferred', () => {
    expect(getAnimationDuration(300, false)).toBe(300);
    expect(getAnimationDuration(1000, false)).toBe(1000);
  });
});

describe('getTransitionStyle', () => {
  it('should return "none" when reduced motion is preferred', () => {
    expect(getTransitionStyle('all 0.3s ease', true)).toBe('none');
    expect(getTransitionStyle('transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)', true)).toBe('none');
  });

  it('should return original transition when reduced motion is not preferred', () => {
    const transition = 'all 0.3s ease';
    expect(getTransitionStyle(transition, false)).toBe(transition);
  });
});
