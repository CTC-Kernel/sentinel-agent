/**
 * RowActionsMenu Component (Story 1.6)
 *
 * Dropdown menu for contextual row actions in list views.
 * Provides Edit, Duplicate, Delete actions with proper styling.
 * Uses Portal to escape overflow:hidden containers.
 *
 * @module RowActionsMenu
 */

import React, { Fragment, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, Transition } from '@headlessui/react';
import { MoreVertical } from './Icons';
import { cn } from '../../lib/utils';

/**
 * Menu item configuration
 */
export interface RowActionItem {
 /** Display label for the action */
 label: string;
 /** Icon component to display */
 icon: React.ComponentType<{ className?: string }>;
 /** Click handler */
 onClick: () => void;
 /** Visual variant - danger shows red styling */
 variant?: 'default' | 'danger';
 /** Whether the action is disabled */
 disabled?: boolean;
}

/**
 * Props for RowActionsMenu component
 */
export interface RowActionsMenuProps {
 /** Array of menu items to display */
 items: RowActionItem[];
 /** Accessible label for the menu button */
 'aria-label'?: string;
 /** Additional class name for the container */
 className?: string;
}

/**
 * Get item styles based on variant and state
 */
function getItemStyles(variant: RowActionItem['variant'], active: boolean, disabled: boolean): string {
 const baseStyles = 'group flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors';

 if (disabled) {
 return cn(baseStyles, 'text-muted-foreground cursor-not-allowed');
 }

 if (variant === 'danger') {
 return cn(
 baseStyles,
 active
 ? 'bg-error-bg text-error-text'
 : 'text-error-text'
 );
 }

 return cn(
 baseStyles,
 active
 ? 'bg-muted text-foreground'
 : 'text-foreground'
 );
}

/**
 * RowActionsMenu - Dropdown menu for contextual row actions
 * Uses Portal to render outside parent containers and avoid overflow clipping.
 *
 * @example
 * ```tsx
 * <RowActionsMenu
 * aria-label="Actions pour le risque"
 * items={[
 * { label: 'Modifier', icon: Edit, onClick: handleEdit },
 * { label: 'Dupliquer', icon: Copy, onClick: handleDuplicate },
 * { label: 'Supprimer', icon: Trash2, onClick: handleDelete, variant: 'danger' },
 * ]}
 * />
 * ```
 */
export function RowActionsMenu({
 items,
 'aria-label': ariaLabel,
 className,
}: RowActionsMenuProps) {
 const buttonRef = useRef<HTMLButtonElement>(null);
 const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

 // Update menu position when button position changes
 const updatePosition = () => {
 if (buttonRef.current) {
 const rect = buttonRef.current.getBoundingClientRect();
 const menuWidth = 192; // w-48 = 12rem = 192px

 // Calculate position - align to right of button
 let left = rect.right - menuWidth;
 const top = rect.bottom + 8; // mt-2 = 8px

 // Ensure menu doesn't go off-screen on the left
 if (left < 8) {
 left = 8;
 }

 // Ensure menu doesn't go off-screen on the right
 if (left + menuWidth > window.innerWidth - 8) {
 left = window.innerWidth - menuWidth - 8;
 }

 setMenuPosition({ top, left });
 }
 };

 if (items.length === 0) {
 return null;
 }

 return (
 <div
 className={cn('relative', className)}
 onClick={(e) => e.stopPropagation()}
 role="presentation"
 >
 <Menu as="div" className="relative inline-block text-left">
 {({ open }) => (
 <>
 <Menu.Button
 ref={buttonRef}
 onClick={updatePosition}
 className={cn(
 'p-2 rounded-3xl transition-all duration-150',
 'hover:bg-muted',
 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0',
 open && 'bg-muted'
 )}
 aria-label={ariaLabel || 'Actions'}
 aria-haspopup="menu"
 >
 <MoreVertical className="h-4 w-4 text-muted-foreground" />
 </Menu.Button>

 {/* Portal the menu items to document.body to escape overflow:hidden */}
 {typeof document !== 'undefined' && createPortal(
 <Transition
  as={Fragment}
  show={open}
  enter="transition duration-100 ease-out"
  enterFrom="transform scale-95 opacity-0"
  enterTo="transform scale-100 opacity-100"
  leave="transition duration-75 ease-in"
  leaveFrom="transform scale-100 opacity-100"
  leaveTo="transform scale-95 opacity-0"
 >
  <Menu.Items
  static
  className={cn(
   'fixed w-48 origin-top-right',
   'rounded-3xl overflow-hidden',
   'bg-card',
   'shadow-lg ring-1 ring-black/5 dark:ring-white/10',
   'focus-visible:outline-none z-dropdown',
   'divide-y divide-border'
  )}
  style={{
   top: menuPosition.top,
   left: menuPosition.left,
  }}
  >
  <div className="py-1">
   {items.map((item, index) => (
   <Menu.Item key={`${item.label || 'unknown'}-${index}`} disabled={item.disabled}>
   {({ active }) => (
   <button
    type="button"
    onClick={item.onClick}
    disabled={item.disabled}
    className={getItemStyles(item.variant, active, !!item.disabled)}
   >
    <item.icon
    className={cn(
    'h-4 w-4 flex-shrink-0',
    item.disabled && 'opacity-60'
    )}
    />
    <span>{item.label}</span>
   </button>
   )}
   </Menu.Item>
   ))}
  </div>
  </Menu.Items>
 </Transition>,
 document.body
 )}
 </>
 )}
 </Menu>
 </div>
 );
}

export default RowActionsMenu;
