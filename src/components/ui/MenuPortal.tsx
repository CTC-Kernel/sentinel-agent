/**
 * MenuPortal Component
 *
 * A portal-based Menu.Items wrapper for HeadlessUI Menu that escapes
 * overflow:hidden containers. Use this instead of inline Menu.Items
 * to ensure dropdowns are never clipped.
 *
 * @module MenuPortal
 */

import React, { Fragment, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Menu, Transition } from '@headlessui/react';
import { cn } from '../../lib/utils';

interface MenuPortalProps {
  /** Reference to the trigger button element */
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  /** Whether the menu is currently open */
  open: boolean;
  /** Child menu items */
  children: React.ReactNode;
  /** Additional classes for the menu panel */
  className?: string;
  /** Width of the menu (default: w-56 = 224px) */
  width?: number;
  /** Alignment relative to button */
  align?: 'left' | 'right';
}

export const MenuPortal: React.FC<MenuPortalProps> = ({
  buttonRef,
  open,
  children,
  className,
  width = 224, // w-56 = 14rem = 224px
  align = 'right',
}) => {
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();

      // Calculate position based on alignment
      let left = align === 'right' ? rect.right - width : rect.left;
      const top = rect.bottom + 8; // mt-2 = 8px

      // Ensure menu doesn't go off-screen on the left
      if (left < 8) {
        left = 8;
      }

      // Ensure menu doesn't go off-screen on the right
      if (left + width > window.innerWidth - 8) {
        left = window.innerWidth - width - 8;
      }

      setCoords({ top, left });
    }
  }, [buttonRef, width, align]);

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [open, updatePosition]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <Transition
      as={Fragment}
      show={open}
      enter="transition ease-apple duration-normal"
      enterFrom="transform opacity-0 scale-95 translate-y-2"
      enterTo="transform opacity-100 scale-100 translate-y-0"
      leave="transition ease-apple duration-fast"
      leaveFrom="transform opacity-100 scale-100 translate-y-0"
      leaveTo="transform opacity-0 scale-95 translate-y-2"
    >
      <Menu.Items
        static
        className={cn(
          "fixed origin-top-right divide-y divide-border/20",
          "rounded-xl bg-background/95 backdrop-blur-xl",
          "text-popover-foreground shadow-xl",
          "ring-1 ring-border/40 focus-visible:outline-none",
          "z-dropdown",
          className
        )}
        style={{
          top: coords.top,
          left: coords.left,
          width: width,
        }}
      >
        {children}
      </Menu.Items>
    </Transition>,
    document.body
  );
};

export default MenuPortal;
