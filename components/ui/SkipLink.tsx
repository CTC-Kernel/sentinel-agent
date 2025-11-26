import React from 'react';

/**
 * SkipLink - Lien de navigation pour utilisateurs clavier
 * Permet de sauter directement au contenu principal
 * Améliore l'accessibilité WCAG 2.1 niveau A
 */
export const SkipLink: React.FC = () => {
  return (
    <a
      href="#main-content"
      className="
        sr-only focus:not-sr-only
        fixed top-4 left-4 z-[9999]
        px-6 py-3
        bg-brand-600 text-white
        font-bold text-sm
        rounded-xl shadow-2xl
        ring-4 ring-brand-300
        transition-all duration-200
        hover:bg-brand-700
        focus:outline-none
      "
      tabIndex={0}
    >
      Aller au contenu principal
    </a>
  );
};

/**
 * SkipLinks - Collection de liens de navigation rapide
 */
interface SkipLinksProps {
  links?: Array<{
    href: string;
    label: string;
  }>;
}

export const SkipLinks: React.FC<SkipLinksProps> = ({ links }) => {
  const defaultLinks = [
    { href: '#main-content', label: 'Aller au contenu principal' },
    { href: '#navigation', label: 'Aller à la navigation' },
    { href: '#search', label: 'Aller à la recherche' },
  ];

  const skipLinks = links || defaultLinks;

  return (
    <div className="sr-only focus-within:not-sr-only">
      {skipLinks.map((link, index) => (
        <a
          key={index}
          href={link.href}
          className="
            fixed top-4 z-[9999]
            px-6 py-3 mr-2
            bg-brand-600 text-white
            font-bold text-sm
            rounded-xl shadow-2xl
            ring-4 ring-brand-300
            transition-all duration-200
            hover:bg-brand-700
            focus:outline-none
          "
          style={{ left: `${4 + index * 200}px` }}
          tabIndex={0}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
};
