import React from 'react';

/**
 * Hook pour améliorer l'accessibilité ARIA
 * Fournit des utilitaires pour ajouter automatiquement des labels et rôles
 */
export const useAccessibility = () => {
  /**
   * Génère un ID unique pour les éléments ARIA
   */
  const generateId = (prefix: string) => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Props ARIA pour les boutons sans texte visible
   */
  const getIconButtonProps = (label: string, describedBy?: string) => ({
    'aria-label': label,
    'aria-describedby': describedBy,
    role: 'button',
    tabIndex: 0
  });

  /**
   * Props ARIA pour les éléments de navigation
   */
  const getNavItemProps = (label: string, isActive?: boolean) => ({
    'aria-label': label,
    'aria-current': isActive ? 'page' : undefined,
    role: 'navigation',
    tabIndex: 0
  });

  /**
   * Props ARIA pour les formulaires
   */
  const getFormProps = (title: string, description?: string) => {
    const titleId = generateId('form-title');
    const descId = description ? generateId('form-desc') : undefined;
    
    return {
      'aria-labelledby': titleId,
      'aria-describedby': descId,
      role: 'form',
      titleId,
      descId,
      titleProps: {
        id: titleId,
        'aria-label': title
      },
      descriptionProps: descId ? {
        id: descId,
        'aria-label': description
      } : undefined
    };
  };

  /**
   * Gestionnaire d'événements clavier standard
   */
  const keyboardHandlers = {
    /**
     * Gère les événements Enter/Space pour les éléments cliquables
     */
    onClick: (handler: () => void) => (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        handler();
      }
    },

    /**
     * Gère la navigation avec les flèches
     */
    onArrowNavigation: (
      onUp?: () => void,
      onDown?: () => void,
      onLeft?: () => void,
      onRight?: () => void
    ) => (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onDown?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onLeft?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onRight?.();
          break;
      }
    },

    /**
     * Gère Escape pour fermer les modales/dropdowns
     */
    onEscape: (handler: () => void) => (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handler();
      }
    }
  };

  return {
    generateId,
    getIconButtonProps,
    getNavItemProps,
    getFormProps,
    keyboardHandlers
  };
};

/**
 * Hook pour gérer les annonces aux lecteurs d'écran
 */
export const useScreenReaderAnnouncer = () => {
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Nettoyer après l'annonce
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  return { announce };
};
