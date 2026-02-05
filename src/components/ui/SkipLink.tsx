import React from 'react';
import { useLocale } from '../../hooks/useLocale';

/**
 * SkipLink - Lien de navigation pour utilisateurs clavier
 * Permet de sauter directement au contenu principal
 * Améliore l'accessibilité WCAG 2.1 niveau A
 */
export const SkipLink: React.FC = () => {
 const { t } = useLocale();
 return (
 <a
 href="#main-content"
 className="
 sr-only focus:not-sr-only
 fixed top-4 left-4 z-max
 px-6 py-3
 bg-primary text-primary-foreground
 font-bold text-sm
 rounded-3xl shadow-2xl
 ring-4 ring-primary/60
 transition-all duration-200
 hover:bg-primary/90
 focus:outline-none
 "
 tabIndex={0}
 >
 {t('a11y.skipToContent', { defaultValue: 'Aller au contenu principal' })}
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
 const { t } = useLocale();
 const defaultLinks = [
 { href: '#main-content', label: t('a11y.skipToContent', { defaultValue: 'Aller au contenu principal' }) },
 { href: '#navigation', label: t('a11y.skipToNav', { defaultValue: 'Aller à la navigation' }) },
 { href: '#search', label: t('a11y.skipToSearch', { defaultValue: 'Aller à la recherche' }) },
 ];

 const skipLinks = links || defaultLinks;

 return (
 <div className="sr-only focus-within:not-sr-only">
 {skipLinks.map((link, index) => (
 <a
 key={link.href || 'unknown'}
 href={link.href}
 className="
 fixed top-4 z-max
 px-6 py-3 mr-2
 bg-primary text-primary-foreground
 font-bold text-sm
 rounded-3xl shadow-2xl
 ring-4 ring-primary/60
 transition-all duration-200
 hover:bg-primary/90
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
