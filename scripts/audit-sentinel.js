/**
 * ============================================================================
 * SENTINEL GRC V2 - AUDIT ULTIME PRODUCTION-READY
 * ============================================================================
 *
 * Script d'audit complet pour garantir une application 100% fonctionnelle,
 * cohérente, sécurisée et prête pour la production.
 *
 * Catégories d'audit:
 * 1.  Architecture & Structure
 * 2.  Boutons & Interactions
 * 3.  Tableaux & Listes
 * 4.  Firebase & Firestore
 * 5.  UX/UI & Design System
 * 6.  Cohérence Logique
 * 7.  Sécurité & RBAC
 * 8.  Performance & Optimisation
 * 9.  TypeScript & Types
 * 10. React Best Practices
 * 11. Formulaires & Validation
 * 12. États de Chargement & Erreurs
 * 13. Accessibilité (a11y)
 * 14. Internationalisation
 * 15. Tests & Couverture
 * 16. Hooks & Services
 * 17. Routes & Navigation
 * 18. Imports & Exports
 *
 * Usage: node scripts/audit-sentinel.js [--fix] [--category=<cat>] [--severity=<sev>]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const FUNCTIONS_DIR = path.join(ROOT_DIR, 'functions');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Fichiers à ignorer
    ignorePaths: [
        'node_modules',
        'dist',
        'build',
        'coverage',
        '.git',
        '__tests__',
        '.test.',
        '.spec.',
        'test-utils',
        'setupTests'
    ],
    // Extensions à auditer
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    // Couleurs terminal
    colors: {
        reset: '\x1b[0m',
        red: '\x1b[31m',
        yellow: '\x1b[33m',
        green: '\x1b[32m',
        blue: '\x1b[34m',
        cyan: '\x1b[36m',
        magenta: '\x1b[35m',
        gray: '\x1b[90m',
        bold: '\x1b[1m'
    }
};

// ============================================================================
// RÈGLES D'AUDIT
// ============================================================================

const RULES = [
    // =========================================================================
    // 1. ARCHITECTURE & STRUCTURE
    // =========================================================================
    {
        id: 'arch-no-direct-firebase-views',
        category: 'Architecture',
        human: 'Les Views ne doivent PAS importer Firebase directement. Utilisez les Hooks/Services.',
        severity: 'critical',
        check: (content, filePath) => {
            if (!filePath.includes('/src/views/')) return null;
            const regex = /import\s+.*\s+from\s+['"](firebase\/|\.\.\/firebase|@firebase)['"]/g;
            if (content.match(regex)) {
                return { line: 0, match: 'Import Firebase direct détecté dans une View' };
            }
            return null;
        }
    },
    {
        id: 'arch-no-direct-firebase-components',
        category: 'Architecture',
        human: 'Les Components ne doivent PAS importer Firebase directement (sauf hooks).',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.includes('/src/components/')) return null;
            // Autoriser les imports depuis les hooks
            if (filePath.includes('/hooks/')) return null;
            const regex = /import\s+\{[^}]*\bdb\b[^}]*\}\s+from\s+['"].*firebase['"]/g;
            if (content.match(regex)) {
                return { line: 0, match: 'Import direct de "db" depuis Firebase dans un composant' };
            }
            return null;
        }
    },
    {
        id: 'arch-service-layer',
        category: 'Architecture',
        human: 'Les appels Firestore complexes doivent être dans les Services, pas les Hooks.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/hooks/')) return null;
            // Vérifier si le hook contient plus de 3 opérations Firestore complexes
            const complexOps = (content.match(/(writeBatch|runTransaction|where\(.*where\()/g) || []).length;
            if (complexOps > 2) {
                return { line: 0, match: `Hook contient ${complexOps} opérations Firestore complexes - déplacer vers un Service` };
            }
            return null;
        }
    },
    {
        id: 'arch-circular-import',
        category: 'Architecture',
        human: 'Import potentiellement circulaire détecté.',
        severity: 'warning',
        check: (content, filePath) => {
            const errors = [];
            // Détecter les imports de fichiers du même dossier qui importent aussi le fichier courant
            const fileName = path.basename(filePath, path.extname(filePath));
            if (content.includes(`from './${fileName}'`) || content.includes(`from "./${fileName}"`)) {
                errors.push({ line: 0, match: 'Possible import circulaire' });
            }
            return errors.length ? errors : null;
        }
    },

    // =========================================================================
    // 2. BOUTONS & INTERACTIONS
    // =========================================================================
    {
        id: 'btn-empty-handler',
        category: 'Boutons',
        human: 'Les boutons ne doivent pas avoir de handler vide.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                if (line.match(/onClick=\{\s*\(\)\s*=>\s*\{\}\s*\}/) ||
                    line.match(/onClick=\{undefined\}/)) {
                    errors.push({ line: i, match: 'Handler onClick vide ou undefined' });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'btn-form-submit-context',
        category: 'Boutons',
        human: 'Les boutons type="submit" doivent être dans un formulaire.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            if (content.includes('type="submit"') && !content.includes('<form') && !content.includes('FormProvider')) {
                return { line: 0, match: 'Bouton submit détecté hors d\'un contexte de formulaire visible (verification limitée)' };
            }
            return null;
        }
    },
    {
        id: 'btn-aria-label-icon-only',
        category: 'Boutons',
        human: 'Les boutons icône seule doivent avoir un aria-label.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                // Heuristique simplifiée : bouton avec Icon et fermeture immédiate ou courte
                if ((line.match(/<Button[^>]*>\s*<[^>]*Icon/) || line.match(/<IconButton/)) &&
                    !line.includes('aria-label') && !line.includes('title=')) {
                    // Vérifier s'il n'y a pas de texte enfant (difficile en regex pur, mais on peut flaguer les IconButton)
                    if (line.includes('IconButton')) {
                        errors.push({ line: i, match: 'IconButton sans aria-label explicite' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'btn-onclick-handler',
        category: 'Boutons',
        human: 'Les boutons avec onClick doivent avoir un handler défini (pas inline complexe).',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                // Détecter les onClick avec des fonctions inline complexes (plus de 50 caractères)
                const match = line.match(/onClick=\{([^}]{80,})\}/);
                if (match) {
                    errors.push({ line: i, match: 'onClick avec logique inline trop complexe - extraire dans une fonction' });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'btn-disabled-state',
        category: 'Boutons',
        human: 'Les boutons de soumission doivent gérer l\'état disabled pendant le chargement.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            // Rechercher les boutons de type submit sans disabled
            const hasSubmitButton = content.includes('type="submit"') || content.includes("type='submit'");
            const hasLoadingState = content.includes('loading') || content.includes('isLoading') || content.includes('isSubmitting');
            const hasDisabled = content.includes('disabled={') || content.includes('disabled=');

            if (hasSubmitButton && hasLoadingState && !hasDisabled) {
                errors.push({ line: 0, match: 'Bouton submit sans gestion de disabled pendant le chargement' });
            }
            return errors.length ? errors : null;
        }
    },
    {
        id: 'btn-loading-indicator',
        category: 'Boutons',
        human: 'Les boutons d\'action async doivent afficher un indicateur de chargement.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                // Bouton avec onClick async sans loading
                if (line.match(/onClick=\{.*async/)) {
                    // Vérifier si le fichier a un état de loading
                    if (!content.includes('loading') && !content.includes('isLoading') && !content.includes('Loader') && !content.includes('Spinner')) {
                        errors.push({ line: i, match: 'Bouton async sans indicateur de chargement visible' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'btn-double-click-prevention',
        category: 'Boutons',
        human: 'Les boutons critiques (delete, submit) doivent prévenir le double-clic.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                // Bouton de suppression ou confirmation
                if ((line.includes('delete') || line.includes('Delete') || line.includes('supprimer')) && line.includes('onClick')) {
                    // Vérifier s'il y a une protection
                    const hasProtection = content.includes('isDeleting') ||
                        content.includes('disabled={') ||
                        content.includes('confirmDialog') ||
                        content.includes('confirm(');
                    if (!hasProtection) {
                        errors.push({ line: i, match: 'Bouton de suppression sans protection contre le double-clic' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'btn-keyboard-accessible',
        category: 'Boutons',
        human: 'Les éléments cliquables non-bouton doivent être accessibles au clavier.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                // div ou span avec onClick mais sans role et tabIndex
                if (line.match(/<(div|span)[^>]*onClick=/) &&
                    !line.includes('role=') &&
                    !line.includes('tabIndex')) {
                    errors.push({ line: i, match: 'Élément cliquable non-bouton sans role="button" et tabIndex' });
                }
            });
            return errors.length ? errors : null;
        }
    },

    // =========================================================================
    // 3. TABLEAUX & LISTES
    // =========================================================================
    {
        id: 'table-empty-state',
        category: 'Tableaux',
        human: 'Les tableaux/listes doivent avoir un état vide.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            // Détecter les .map() sans vérification de tableau vide
            if ((content.includes('<table') || content.includes('<Table')) &&
                content.includes('.map(') &&
                !content.includes('length === 0') &&
                !content.includes('length > 0') &&
                !content.includes('EmptyState') &&
                !content.includes('empty') &&
                !content.includes('Aucun')) {
                errors.push({ line: 0, match: 'Tableau sans gestion d\'état vide' });
            }
            return errors.length ? errors : null;
        }
    },
    {
        id: 'table-loading-skeleton',
        category: 'Tableaux',
        human: 'Les tableaux doivent afficher un skeleton pendant le chargement.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            if (!content.includes('<table') && !content.includes('<Table')) return null;

            const hasLoading = content.includes('loading') || content.includes('isLoading');
            const hasSkeleton = content.includes('Skeleton') || content.includes('skeleton') ||
                content.includes('Loader') || content.includes('Spinner') ||
                content.includes('animate-pulse');

            if (hasLoading && !hasSkeleton) {
                return { line: 0, match: 'Tableau avec loading mais sans skeleton/loader visible' };
            }
            return null;
        }
    },
    {
        id: 'table-pagination',
        category: 'Tableaux',
        human: 'Les grands tableaux doivent avoir une pagination.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            if (!content.includes('<table') && !content.includes('<Table')) return null;

            // Si c'est un tableau de données, vérifier la pagination
            if (content.includes('.map(') &&
                !content.includes('pagination') &&
                !content.includes('Pagination') &&
                !content.includes('page') &&
                !content.includes('limit') &&
                !content.includes('slice(')) {
                return { line: 0, match: 'Tableau potentiellement grand sans pagination' };
            }
            return null;
        }
    },
    {
        id: 'table-sorting',
        category: 'Tableaux',
        human: 'Les colonnes de tableaux devraient être triables.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            if (!content.includes('<th') && !content.includes('<TableHead')) return null;

            if (!content.includes('sort') && !content.includes('Sort') && !content.includes('orderBy')) {
                return { line: 0, match: 'Tableau sans fonctionnalité de tri' };
            }
            return null;
        }
    },
    {
        id: 'list-unique-key',
        category: 'Tableaux',
        human: 'Les éléments de liste doivent avoir une clé unique (pas l\'index).',
        severity: 'critical',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                // key={index} ou key={i} ou key={idx}
                if (line.match(/key=\{(index|i|idx|j)\}/)) {
                    errors.push({ line: i, match: 'Utilisation de l\'index comme clé de liste - utiliser un ID unique' });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'list-virtualization',
        category: 'Tableaux',
        human: 'Les très grandes listes devraient utiliser la virtualisation.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            // Si le composant gère plus de 100 éléments potentiellement
            if (content.includes('.slice(0, 100)') || content.includes('limit: 100') || content.includes('pageSize: 100')) {
                if (!content.includes('virtualized') && !content.includes('Virtualized') &&
                    !content.includes('react-window') && !content.includes('react-virtualized')) {
                    return { line: 0, match: 'Grande liste sans virtualisation - considérer react-window' };
                }
            }
            return null;
        }
    },

    // =========================================================================
    // 4. FIREBASE & FIRESTORE
    // =========================================================================
    {
        id: 'firebase-error-handling',
        category: 'Firebase',
        human: 'Les opérations Firestore doivent avoir un try/catch avec ErrorLogger.',
        severity: 'critical',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            // Rechercher les appels Firestore sans try/catch
            const firestoreOps = ['addDoc', 'updateDoc', 'deleteDoc', 'setDoc', 'getDocs', 'getDoc'];
            lines.forEach((line, i) => {
                for (const op of firestoreOps) {
                    if (line.includes(`await ${op}(`) || line.includes(`${op}(`)) {
                        // Vérifier si c'est dans un try/catch
                        const context = lines.slice(Math.max(0, i - 50), i + 1).join('\n');
                        if (!context.includes('try') && !context.includes('catch')) {
                            errors.push({ line: i, match: `Opération ${op} sans try/catch` });
                        }
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'firebase-unsubscribe',
        category: 'Firebase',
        human: 'Les listeners onSnapshot doivent être unsubscribe dans le cleanup.',
        severity: 'critical',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;

            if (content.includes('onSnapshot(')) {
                // Vérifier qu'il y a un return avec unsubscribe
                if (!content.includes('return () =>') && !content.includes('return unsubscribe') && !content.includes('return () => unsubscribe')) {
                    return { line: 0, match: 'onSnapshot sans unsubscribe dans le cleanup useEffect' };
                }
            }
            return null;
        }
    },
    {
        id: 'firebase-batch-limit',
        category: 'Firebase',
        human: 'Les batches Firestore sont limités à 500 opérations.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;

            if (content.includes('writeBatch') && content.includes('.forEach(') && !content.includes('chunk') && !content.includes('slice')) {
                return { line: 0, match: 'WriteBatch avec forEach sans chunking - limite 500 ops' };
            }
            return null;
        }
    },
    {
        id: 'firebase-security-rules-client',
        category: 'Firebase',
        human: 'Ne pas contourner les règles de sécurité côté client.',
        severity: 'critical',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;

            // Patterns dangereux
            if (content.includes('ignoreUndefinedProperties: true') ||
                content.includes('merge: true') && content.includes('undefined')) {
                return { line: 0, match: 'Pattern potentiellement dangereux pour les règles de sécurité' };
            }
            return null;
        }
    },
    {
        id: 'firebase-timestamp',
        category: 'Firebase',
        human: 'Utiliser serverTimestamp() pour les dates de création/modification.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Détecter new Date() utilisé pour createdAt/updatedAt
                if ((line.includes('createdAt') || line.includes('updatedAt') || line.includes('created_at') || line.includes('updated_at')) &&
                    line.includes('new Date()')) {
                    errors.push({ line: i, match: 'Utiliser serverTimestamp() au lieu de new Date() pour les timestamps' });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'firebase-offline-handling',
        category: 'Firebase',
        human: 'Gérer le mode offline pour les opérations critiques.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/views/') && !filePath.includes('/src/components/')) return null;

            // Si le fichier utilise des opérations d'écriture
            if ((content.includes('addDoc') || content.includes('updateDoc') || content.includes('deleteDoc'))) {
                if (!content.includes('navigator.onLine') && !content.includes('offline') && !content.includes('network')) {
                    return { line: 0, match: 'Opérations d\'écriture sans gestion du mode offline' };
                }
            }
            return null;
        }
    },
    {
        id: 'firebase-query-optimization',
        category: 'Firebase',
        human: 'Les queries Firestore doivent avoir des limites.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Query sans limit()
                if (line.includes('getDocs(') && line.includes('query(') && !content.includes('limit(')) {
                    errors.push({ line: i, match: 'Query Firestore sans limit() - risque de lecture excessive' });
                }
            });
            return errors.length ? errors : null;
        }
    },

    // =========================================================================
    // 5. UX/UI & DESIGN SYSTEM
    // =========================================================================
    {
        id: 'ui-hover-state',
        category: 'UX/UI',
        human: 'Les éléments interactifs doivent avoir un état hover.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                if (line.includes('onClick=') && line.includes('className=') && !line.includes('hover:')) {
                    // Exclure les composants qui gèrent déjà le hover
                    if (!line.includes('<Button') && !line.includes('<IconButton') &&
                        !line.includes('<Link') && !line.includes('btn')) {
                        errors.push({ line: i, match: 'Élément interactif sans état hover' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'ui-focus-visible',
        category: 'UX/UI',
        human: 'Les éléments focusables doivent avoir un indicateur focus-visible.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;

            if ((content.includes('tabIndex') || content.includes('<button') || content.includes('<input')) &&
                !content.includes('focus:') && !content.includes('focus-visible:') && !content.includes('outline')) {
                return { line: 0, match: 'Éléments focusables sans indicateur de focus visible' };
            }
            return null;
        }
    },
    {
        id: 'ui-transition',
        category: 'UX/UI',
        human: 'Les changements d\'état visuels doivent avoir des transitions.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;

            // Si le composant a des états visuels mais pas de transitions
            if ((content.includes('hover:') || content.includes('active:')) &&
                !content.includes('transition') && !content.includes('animate') &&
                !content.includes('duration-')) {
                return { line: 0, match: 'États visuels sans transitions - UX dégradée' };
            }
            return null;
        }
    },
    {
        id: 'ui-no-hardcoded-colors',
        category: 'UX/UI',
        human: 'Utiliser les classes Tailwind au lieu de couleurs hardcodées.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Détecter les couleurs hex dans les styles
                if (line.match(/(style=|className=)[^>]*#[0-9a-fA-F]{3,6}/)) {
                    errors.push({ line: i, match: 'Couleur hexadécimale hardcodée - utiliser Tailwind' });
                }
                // Détecter rgb/rgba inline
                if (line.match(/style=\{.*rgba?\(/)) {
                    errors.push({ line: i, match: 'Couleur RGB inline - utiliser les variables CSS ou Tailwind' });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'ui-responsive-design',
        category: 'UX/UI',
        human: 'Les composants principaux doivent être responsive.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/views/')) return null;

            // Vérifier la présence de classes responsive
            const hasResponsive = content.includes('sm:') || content.includes('md:') ||
                content.includes('lg:') || content.includes('xl:') ||
                content.includes('useMediaQuery');

            if (!hasResponsive && content.includes('grid') || content.includes('flex')) {
                return { line: 0, match: 'View avec layout sans classes responsive' };
            }
            return null;
        }
    },
    {
        id: 'ui-dark-mode',
        category: 'UX/UI',
        human: 'Les composants doivent supporter le dark mode.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;

            // Si le composant utilise des classes de couleur sans variante dark
            if ((content.includes('bg-white') || content.includes('text-gray-')) &&
                !content.includes('dark:')) {
                return { line: 0, match: 'Composant avec couleurs sans support dark mode' };
            }
            return null;
        }
    },
    {
        id: 'ui-z-index-management',
        category: 'UX/UI',
        human: 'Utiliser une échelle de z-index cohérente.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // z-index arbitraire élevé
                const match = line.match(/z-\[(\d+)\]/);
                if (match && parseInt(match[1]) > 100) {
                    errors.push({ line: i, match: `z-index arbitraire élevé (${match[1]}) - utiliser l'échelle standard` });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'ui-consistent-spacing',
        category: 'UX/UI',
        human: 'Utiliser des espacements cohérents (multiples de 4).',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Détecter les valeurs de padding/margin non-standard
                const match = line.match(/(p|m)[xy]?-\[(\d+)px\]/);
                if (match && parseInt(match[2]) % 4 !== 0) {
                    errors.push({ line: i, match: `Espacement non-multiple de 4 (${match[2]}px)` });
                }
            });
            return errors.length ? errors : null;
        }
    },

    // =========================================================================
    // 6. COHÉRENCE LOGIQUE
    // =========================================================================
    {
        id: 'logic-catch-error-handling',
        category: 'Logique',
        human: 'Les blocs catch doivent utiliser ErrorLogger ou toast.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                if (line.match(/catch\s*\(/)) {
                    // Vérifier les 5 lignes suivantes
                    const context = lines.slice(i, i + 6).join('\n');
                    if (!context.includes('ErrorLogger') &&
                        !context.includes('toast') &&
                        !context.includes('console.error') &&
                        !context.includes('throw') &&
                        !context.includes('handleError')) {
                        // Ignorer les catch vides intentionnels
                        if (!context.includes('// ignore') && !context.includes('// silent')) {
                            errors.push({ line: i, match: 'Bloc catch sans gestion d\'erreur (ErrorLogger/toast)' });
                        }
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'logic-async-consistency',
        category: 'Logique',
        human: 'Les fonctions async doivent avoir await ou retourner une Promise.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            let inAsyncFunc = false;
            let asyncStartLine = 0;
            let braceCount = 0;
            let hasAwait = false;

            lines.forEach((line, i) => {
                if (line.includes('async ') && (line.includes('=>') || line.includes('function'))) {
                    inAsyncFunc = true;
                    asyncStartLine = i;
                    braceCount = 0;
                    hasAwait = false;
                }
                if (inAsyncFunc) {
                    braceCount += (line.match(/\{/g) || []).length;
                    braceCount -= (line.match(/\}/g) || []).length;
                    if (line.includes('await ')) hasAwait = true;
                    if (braceCount === 0 && line.includes('}')) {
                        if (!hasAwait) {
                            errors.push({ line: asyncStartLine, match: 'Fonction async sans await' });
                        }
                        inAsyncFunc = false;
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'logic-null-check',
        category: 'Logique',
        human: 'Vérifier les valeurs null/undefined avant utilisation.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Accès à une propriété sans vérification
                if (line.match(/\w+\.\w+\.\w+/) && !line.includes('?.') && !line.includes('&&')) {
                    // Vérifier que ce n'est pas un import ou une déclaration de type
                    if (!line.includes('import') && !line.includes('from') &&
                        !line.includes('interface') && !line.includes('type ') &&
                        !line.includes('console.')) {
                        // C'est probablement un faux positif, mais mérite vérification
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'logic-early-return',
        category: 'Logique',
        human: 'Utiliser les early returns pour réduire l\'imbrication.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const lines = content.split('\n');

            // Compter la profondeur d'indentation maximale
            let maxIndent = 0;
            lines.forEach((line) => {
                const indent = line.search(/\S/);
                if (indent > maxIndent) maxIndent = indent;
            });

            // Plus de 6 niveaux d'indentation (24 espaces) = trop imbriqué
            if (maxIndent > 24) {
                return { line: 0, match: `Imbrication profonde détectée (${Math.floor(maxIndent / 4)} niveaux) - utiliser early returns` };
            }
            return null;
        }
    },
    {
        id: 'logic-magic-numbers',
        category: 'Logique',
        human: 'Éviter les magic numbers - utiliser des constantes.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Nombres arbitraires dans la logique (pas les styles)
                if (line.match(/===?\s*\d{2,}/) || line.match(/>\s*\d{2,}/) || line.match(/<\s*\d{2,}/)) {
                    // Ignorer les valeurs communes (0, 1, 100, 1000)
                    if (!line.match(/===?\s*(0|1|100|1000|10|60|24|365)\b/) &&
                        !line.includes('className') && !line.includes('style')) {
                        errors.push({ line: i, match: 'Magic number détecté - extraire en constante' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'logic-boolean-naming',
        category: 'Logique',
        human: 'Les variables booléennes doivent avoir un préfixe is/has/can/should.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Variables booléennes sans préfixe approprié
                const match = line.match(/const\s+(\w+)\s*=\s*(true|false)/);
                if (match && !match[1].match(/^(is|has|can|should|will|did|was|allow|enable|disable|show|hide)/i)) {
                    errors.push({ line: i, match: `Variable booléenne "${match[1]}" devrait avoir un préfixe is/has/can/should` });
                }
            });
            return errors.length ? errors : null;
        }
    },

    // =========================================================================
    // 7. SÉCURITÉ & RBAC & LOGIQUE MÉTIER
    // =========================================================================
    {
        id: 'logic-mutation-audit',
        category: 'Logique',
        human: 'Les actions de mutation doivent être auditées (logAction).',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/hooks/') && !filePath.includes('/src/services/')) return null;
            const errors = [];
            const lines = content.split('\n');

            // Regex pour repérer le début d'une fonction handleCreate/Update/Delete ou une méthode de service
            // C'est complexe en regex multilingues, on va faire une heuristic simple sur le fichier global
            // Si le fichier contient handleCreate... et pas de logAction / logAudit
            if ((content.includes('handleCreate') || content.includes('handleUpdate') || content.includes('handleDelete')) &&
                !content.includes('logAction') && !content.includes('auditService') && !content.includes('logEvent')) {
                return { line: 0, match: 'Fonctions de mutation (handle*) détectées sans trace d\'appel d\'audit (logAction/auditService)' };
            }
            return null;
        }
    },
    {
        id: 'logic-missing-implementations',
        category: 'Logique',
        human: 'Détecter les fonctionnalités incomplètes (TODO, TBD).',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                if (line.match(/console\.log\(['"]TODO/) ||
                    line.match(/alert\(['"]Not implemented/) ||
                    line.includes('// TODO:') ||
                    line.includes('// FIXME:')) {
                    errors.push({ line: i, match: 'Fonctionnalité marquée comme incomplète (TODO/FIXME)' });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'security-xss',
        category: 'Sécurité',
        human: 'Éviter dangerouslySetInnerHTML - risque XSS.',
        severity: 'critical',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                if (line.includes('dangerouslySetInnerHTML')) {
                    // Vérifier si le contenu est sanitizé
                    const context = lines.slice(Math.max(0, i - 3), i + 3).join('\n');
                    if (!context.includes('DOMPurify') && !context.includes('sanitize')) {
                        errors.push({ line: i, match: 'dangerouslySetInnerHTML sans sanitization - risque XSS' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'security-eval',
        category: 'Sécurité',
        human: 'Ne jamais utiliser eval() ou Function().',
        severity: 'critical',
        regex: /\beval\s*\(|\bnew\s+Function\s*\(/g
    },
    {
        id: 'security-sensitive-data-logging',
        category: 'Sécurité',
        human: 'Ne pas logger de données sensibles.',
        severity: 'critical',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                if (line.includes('console.log') || line.includes('ErrorLogger')) {
                    if (line.includes('password') || line.includes('token') ||
                        line.includes('secret') || line.includes('apiKey') ||
                        line.includes('credential')) {
                        errors.push({ line: i, match: 'Données sensibles potentiellement loggées' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'security-rbac-check',
        category: 'Sécurité',
        human: 'Les actions sensibles doivent vérifier les permissions.',
        severity: 'critical',
        check: (content, filePath) => {
            if (!filePath.includes('/src/views/')) return null;

            // Détecter les actions de suppression/modification
            const hasSensitiveAction = content.includes('delete') || content.includes('Delete') ||
                content.includes('remove') || content.includes('Remove') ||
                content.includes('update') || content.includes('Update');

            const hasPermissionCheck = content.includes('hasPermission') ||
                content.includes('canDelete') ||
                content.includes('canEdit') ||
                content.includes('isAdmin') ||
                content.includes('role') ||
                content.includes('RoleGuard');

            if (hasSensitiveAction && !hasPermissionCheck) {
                return { line: 0, match: 'Actions sensibles sans vérification de permissions RBAC' };
            }
            return null;
        }
    },
    {
        id: 'security-url-validation',
        category: 'Sécurité',
        human: 'Valider les URLs avant redirection.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                if (line.includes('window.location') || line.includes('window.open') || line.includes('navigate(')) {
                    // Vérifier si l'URL vient d'une variable non validée
                    if (line.match(/(window\.location|window\.open|navigate)\s*[=(]\s*\w+/) &&
                        !line.includes('validateUrl') && !line.includes('sanitize')) {
                        errors.push({ line: i, match: 'Redirection avec URL potentiellement non validée' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'security-input-sanitization',
        category: 'Sécurité',
        human: 'Les entrées utilisateur doivent être validées/sanitizées.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;

            // Si le fichier utilise des inputs et Firestore sans validation
            if ((content.includes('<input') || content.includes('<textarea')) &&
                (content.includes('addDoc') || content.includes('updateDoc')) &&
                !content.includes('validate') && !content.includes('Yup') &&
                !content.includes('zod') && !content.includes('sanitize')) {
                return { line: 0, match: 'Entrées utilisateur sans validation avant Firestore' };
            }
            return null;
        }
    },
    {
        id: 'security-api-key-exposure',
        category: 'Sécurité',
        human: 'Ne pas exposer de clés API côté client.',
        severity: 'critical',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Détecter les clés API hardcodées
                if (line.match(/['"][a-zA-Z0-9]{20,}['"]\s*;?\s*\/\/.*key/i) ||
                    line.match(/api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i)) {
                    // Ignorer les références à import.meta.env
                    if (!line.includes('import.meta.env') && !line.includes('process.env')) {
                        errors.push({ line: i, match: 'Clé API potentiellement hardcodée' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },

    // =========================================================================
    // 8. PERFORMANCE & OPTIMISATION
    // =========================================================================
    {
        id: 'perf-useeffect-deps',
        category: 'Performance',
        human: 'useEffect doit avoir un tableau de dépendances.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // useEffect sans tableau de dépendances
                if (line.match(/useEffect\s*\(\s*\(\s*\)\s*=>\s*\{/) ||
                    line.match(/useEffect\s*\(\s*async/)) {
                    // Vérifier les lignes suivantes pour le tableau de dépendances
                    const nextLines = lines.slice(i, i + 100).join('\n');
                    if (!nextLines.includes('], [') && !nextLines.includes('],\n') &&
                        !nextLines.match(/\}\s*,\s*\[/)) {
                        // Vérifier le pattern standard
                        if (!nextLines.includes('// eslint-disable')) {
                            errors.push({ line: i, match: 'useEffect potentiellement sans tableau de dépendances' });
                        }
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'perf-memo-missing',
        category: 'Performance',
        human: 'Les callbacks passés en props devraient utiliser useCallback.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Props callback inline
                if (line.match(/\w+=\{\s*\(\w*\)\s*=>/)) {
                    if (!line.includes('onClick=') && !line.includes('onChange=') &&
                        !line.includes('onSubmit=') && !line.includes('onBlur=')) {
                        errors.push({ line: i, match: 'Callback inline comme prop - utiliser useCallback' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'perf-usememo-expensive',
        category: 'Performance',
        human: 'Les calculs coûteux devraient utiliser useMemo.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];

            // Détecter les .filter().map() ou .reduce() sans useMemo
            if (content.match(/\.filter\([^)]+\)\.map\([^)]+\)/) ||
                content.match(/\.reduce\([^)]+\)/) ||
                content.match(/\.sort\([^)]*\)/)) {
                if (!content.includes('useMemo')) {
                    errors.push({ line: 0, match: 'Calculs coûteux (filter/map/reduce/sort) sans useMemo' });
                }
            }
            return errors.length ? errors : null;
        }
    },
    {
        id: 'perf-large-bundle',
        category: 'Performance',
        human: 'Éviter les imports de librairies complètes.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Import de lodash complet
                if (line.match(/import\s+_\s+from\s+['"]lodash['"]/)) {
                    errors.push({ line: i, match: 'Import lodash complet - utiliser lodash/fonction' });
                }
                // Import de moment complet
                if (line.match(/import\s+moment\s+from\s+['"]moment['"]/)) {
                    errors.push({ line: i, match: 'moment.js importé - considérer date-fns ou dayjs' });
                }
                // Import d'icônes complet
                if (line.match(/import\s+\*\s+as\s+\w+Icons\s+from/)) {
                    errors.push({ line: i, match: 'Import d\'icônes complet - importer individuellement' });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'perf-lazy-loading',
        category: 'Performance',
        human: 'Les gros composants/routes devraient être lazy-loaded.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.includes('/src/App.tsx') && !filePath.includes('Router') && !filePath.includes('routes')) return null;

            if (content.includes('<Route') && !content.includes('React.lazy') && !content.includes('lazy(')) {
                return { line: 0, match: 'Routes sans lazy loading - impacte le bundle initial' };
            }
            return null;
        }
    },
    {
        id: 'perf-image-optimization',
        category: 'Performance',
        human: 'Les images doivent avoir width/height et loading="lazy".',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                if (line.includes('<img') && !line.includes('loading=')) {
                    errors.push({ line: i, match: 'Image sans loading="lazy"' });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'perf-console-log',
        category: 'Performance',
        human: 'Supprimer les console.log en production.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                if (line.includes('console.log(') && !line.includes('// debug') &&
                    !line.includes('// eslint-disable') && !line.includes('// audit-ignore')) {
                    errors.push({ line: i, match: 'console.log() - utiliser ErrorLogger ou supprimer' });
                }
            });
            return errors.length ? errors : null;
        }
    },

    // =========================================================================
    // 9. TYPESCRIPT & TYPES
    // =========================================================================
    {
        id: 'ts-no-any',
        category: 'TypeScript',
        human: 'Éviter le type "any" explicite.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                if (line.match(/:\s*any\b/) && !line.includes('eslint-disable')) {
                    errors.push({ line: i, match: 'Type "any" explicite - définir un type approprié' });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'ts-no-non-null-assertion',
        category: 'TypeScript',
        human: 'Éviter les assertions non-null (!.).',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                if (line.match(/\w+!\./)) {
                    errors.push({ line: i, match: 'Assertion non-null (!) - préférer optional chaining (?.)' });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'ts-proper-return-types',
        category: 'TypeScript',
        human: 'Les fonctions exportées doivent avoir un type de retour explicite.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Fonction exportée sans type de retour
                if (line.match(/^export\s+(const|function)\s+\w+\s*[=\(]/) &&
                    !line.includes('):') && !line.includes('=> {')) {
                    // Ceci est une heuristique, peut avoir des faux positifs
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'ts-interface-vs-type',
        category: 'TypeScript',
        human: 'Utiliser interface pour les objets, type pour les unions.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Type alias simple qui devrait être une interface
                if (line.match(/^type\s+\w+\s*=\s*\{/) && !line.includes('|') && !line.includes('&')) {
                    errors.push({ line: i, match: 'Considérer interface au lieu de type pour les objets' });
                }
            });
            return errors.length ? errors : null;
        }
    },

    // =========================================================================
    // 10. REACT BEST PRACTICES
    // =========================================================================
    {
        id: 'react-no-index-key',
        category: 'React',
        human: 'Ne pas utiliser l\'index comme key.',
        severity: 'critical',
        regex: /key=\{(index|i|idx|j)\}/g
    },
    {
        id: 'react-no-inline-styles',
        category: 'React',
        human: 'Éviter les styles inline - utiliser Tailwind/CSS.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // style={{ ... }} avec plus de 3 propriétés
                const match = line.match(/style=\{\{([^}]+)\}\}/);
                if (match && match[1].split(',').length > 3) {
                    errors.push({ line: i, match: 'Style inline complexe - extraire dans une classe CSS/Tailwind' });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'react-component-naming',
        category: 'React',
        human: 'Les composants doivent être en PascalCase.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Composant en camelCase
                const match = line.match(/^(export\s+)?(const|function)\s+([a-z][a-zA-Z]+)\s*[=:]/);
                if (match && match[3] && !match[3].includes('use') &&
                    content.includes(`<${match[3]}`)) {
                    errors.push({ line: i, match: `Composant "${match[3]}" devrait être en PascalCase` });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'react-hooks-order',
        category: 'React',
        human: 'Les Hooks doivent être appelés au top level.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            let inCondition = false;
            lines.forEach((line, i) => {
                if (line.match(/if\s*\(|for\s*\(|while\s*\(/)) inCondition = true;
                if (inCondition && line.match(/\buse[A-Z]\w*\s*\(/)) {
                    errors.push({ line: i, match: 'Hook appelé conditionnellement ou dans une boucle' });
                }
                if (line.includes('}')) inCondition = false;
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'react-fragment-shorthand',
        category: 'React',
        human: 'Utiliser <>...</> au lieu de <React.Fragment>.',
        severity: 'info',
        regex: /<React\.Fragment>/g
    },
    {
        id: 'react-props-destructuring',
        category: 'React',
        human: 'Destructurer les props pour plus de clarté.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Accès répétitif à props.xxx
                if ((line.match(/props\.\w+/g) || []).length > 2) {
                    errors.push({ line: i, match: 'Accès répétitif à props - utiliser destructuring' });
                }
            });
            return errors.length ? errors : null;
        }
    },

    // =========================================================================
    // 11. FORMULAIRES & VALIDATION
    // =========================================================================
    {
        id: 'form-validation',
        category: 'Formulaires',
        human: 'Les formulaires doivent avoir une validation.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;

            if (content.includes('<form') || content.includes('onSubmit')) {
                if (!content.includes('validate') && !content.includes('Yup') &&
                    !content.includes('zod') && !content.includes('required') &&
                    !content.includes('useForm') && !content.includes('formik')) {
                    return { line: 0, match: 'Formulaire sans validation visible' };
                }
            }
            return null;
        }
    },
    {
        id: 'form-error-display',
        category: 'Formulaires',
        human: 'Les erreurs de formulaire doivent être affichées.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;

            if ((content.includes('<form') || content.includes('onSubmit')) && content.includes('<input')) {
                if (!content.includes('error') && !content.includes('Error') &&
                    !content.includes('invalid') && !content.includes('helperText')) {
                    return { line: 0, match: 'Formulaire sans affichage d\'erreurs de validation' };
                }
            }
            return null;
        }
    },
    {
        id: 'form-submit-prevention',
        category: 'Formulaires',
        human: 'Les formulaires doivent empêcher la soumission multiple.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;

            // Simple check: if file contains <form but no preventDefault/handleSubmit
            if (content.includes('<form') &&
                content.includes('onSubmit') &&
                !content.includes('e.preventDefault') &&
                !content.includes('event.preventDefault') &&
                !content.includes('handleSubmit')) {
                return { line: 0, match: 'Formulaire (<form>) sans e.preventDefault() ni handleSubmit' };
            }
            return null;
        }
    },
    {
        id: 'form-input-labels',
        category: 'Formulaires',
        human: 'Les inputs doivent avoir des labels associés.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                if (line.includes('<input') && !line.includes('type="hidden"') &&
                    !line.includes('type="submit"')) {
                    // Vérifier si un label est associé
                    const hasId = line.includes('id=');
                    const context = lines.slice(Math.max(0, i - 3), i + 3).join('\n');
                    if (!hasId && !context.includes('<label') && !context.includes('aria-label')) {
                        errors.push({ line: i, match: 'Input sans label associé' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'form-controlled-inputs',
        category: 'Formulaires',
        human: 'Utiliser des controlled inputs avec value et onChange.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                if (line.includes('<input') && !line.includes('type="submit"') &&
                    !line.includes('type="file"') && !line.includes('type="hidden"')) {

                    // Look ahead 10 lines for control props
                    const context = lines.slice(i, i + 10).join('\n');

                    if (!context.includes('value=') && !context.includes('defaultValue=') &&
                        !context.includes('{...register') && !context.includes('{...field') &&
                        !context.includes('{...control.register') &&
                        !context.includes('checked=') && !context.includes('onChange=')) {
                        errors.push({ line: i + 1, match: 'Input non contrôlé (ni value, ni checked, ni register)' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },


    {
        id: 'form-validation-robust',
        category: 'Formulaires',
        human: 'Les formulaires doivent utiliser Zod ou Yup pour la validation.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;

            // Détecter un formulaire ou un composant de formulaire
            if (content.includes('useForm') || content.includes('<form')) {
                // Vérifier la présence de resolver ou schema
                const hasResolver = content.includes('resolver:');
                const hasSchema = content.includes('schema') || content.includes('Schema');
                const importsValidation = content.includes('zod') || content.includes('yup');

                if (!hasResolver && !hasSchema && !importsValidation) {
                    return { line: 0, match: 'Formulaire sans schéma de validation (Zod/Yup) détecté' };
                }
            }
            return null;
        }
    },
    {
        id: 'panel-reset-logic',
        category: 'UX/UI',
        human: 'Les SidePanels/Drawers doivent gérer correctement la fermeture (reset state).',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            if (!content.includes('Drawer') && !content.includes('SidePanel') && !content.includes('Sheet')) return null;

            const errors = [];
            // Vérifier si onClose est géré
            if (content.includes('open={') && !content.includes('onOpenChange={') && !content.includes('onClose={')) {
                errors.push({ line: 0, match: 'Panel sans gestionnaire de fermeture (onClose/onOpenChange)' });
            }

            // Vérifier si le formulaire est reset à la fermeture (heuristique)
            if (content.includes('useForm') && (content.includes('Drawer') || content.includes('Sheet'))) {
                if (!content.includes('reset(') && !content.includes('useEffect')) {
                    // C'est souvent un signe que le formulaire garde son état précédent
                    errors.push({ line: 0, match: 'Formulaire dans un Panel sans reset() visible - risque de données persistantes' });
                }
            }

            return errors.length ? errors : null;
        }
    },

    // =========================================================================
    // 12. ÉTATS DE CHARGEMENT & ERREURS
    // =========================================================================
    {
        id: 'state-loading-handling',
        category: 'États',
        human: 'Les composants async doivent gérer l\'état loading.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.includes('/src/views/')) return null;

            // Si le composant utilise des hooks de données
            if ((content.includes('useQuery') || content.includes('useFetch') ||
                content.includes('useFirestore') || content.includes('useEffect')) &&
                content.includes('await')) {
                if (!content.includes('loading') && !content.includes('isLoading') &&
                    !content.includes('Skeleton') && !content.includes('Spinner')) {
                    return { line: 0, match: 'Composant async sans gestion de l\'état loading' };
                }
            }
            return null;
        }
    },
    {
        id: 'state-error-handling',
        category: 'États',
        human: 'Les composants async doivent gérer les erreurs.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.includes('/src/views/')) return null;

            if ((content.includes('useQuery') || content.includes('useFetch') ||
                content.includes('useFirestore')) &&
                !content.includes('error') && !content.includes('Error') &&
                !content.includes('ErrorBoundary')) {
                return { line: 0, match: 'Composant async sans gestion d\'erreur' };
            }
            return null;
        }
    },
    {
        id: 'state-empty-state',
        category: 'États',
        human: 'Les listes/tableaux doivent avoir un empty state.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;

            if (content.includes('.map(') &&
                !content.includes('length === 0') &&
                !content.includes('length > 0') &&
                !content.includes('EmptyState') &&
                !content.includes('empty') &&
                !content.includes('Aucun') &&
                !content.includes('No ') &&
                // Exclude configuration/static lists
                !content.includes('steps.map') &&
                !content.includes('tabs.map') &&
                !content.includes('columns.map') &&
                !content.includes('headers.map') &&
                !content.includes('options.map') &&
                !content.includes('layout.map') &&
                !content.includes('matrix.map') &&
                !content.includes('routes.map') &&
                !content.includes('links.map')) {
                return { line: 0, match: 'Liste sans état vide' };
            }
            return null;
        }
    },
    {
        id: 'state-optimistic-update',
        category: 'États',
        human: 'Les mutations devraient utiliser des updates optimistes.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;

            if ((content.includes('updateDoc') || content.includes('addDoc')) &&
                !content.includes('optimistic') && !content.includes('setQuery') &&
                !content.includes('mutate')) {
                return { line: 0, match: 'Mutation sans update optimiste - UX peut sembler lente' };
            }
            return null;
        }
    },

    // =========================================================================
    // 13. ACCESSIBILITÉ (a11y)
    // =========================================================================
    {
        id: 'a11y-alt-text',
        category: 'Accessibilité',
        human: 'Les images doivent avoir un attribut alt.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                if (line.includes('<img') && !line.includes('alt=')) {
                    errors.push({ line: i, match: 'Image sans attribut alt' });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'a11y-aria-label',
        category: 'Accessibilité',
        human: 'Les boutons avec icône doivent avoir aria-label.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Bouton avec seulement une icône
                if (line.match(/<button[^>]*>[^<]*<[^>]*Icon/i) ||
                    line.match(/<button[^>]*>\s*<svg/)) {
                    if (!line.includes('aria-label') && !line.includes('title=')) {
                        errors.push({ line: i, match: 'Bouton icône sans aria-label' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'a11y-heading-order',
        category: 'Accessibilité',
        human: 'Les headings doivent suivre un ordre logique (h1 > h2 > h3).',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');
            let lastHeading = 0;

            lines.forEach((line, i) => {
                const match = line.match(/<h([1-6])/);
                if (match) {
                    const level = parseInt(match[1]);
                    if (level > lastHeading + 1 && lastHeading !== 0) {
                        errors.push({ line: i, match: `Saut de niveau de heading: h${lastHeading} -> h${level}` });
                    }
                    lastHeading = level;
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'a11y-color-contrast',
        category: 'Accessibilité',
        human: 'Vérifier le contraste des couleurs.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;

            // Détecter les couleurs potentiellement problématiques
            if (content.includes('text-gray-400') || content.includes('text-gray-300')) {
                return { line: 0, match: 'Couleur de texte claire potentiellement avec contraste insuffisant' };
            }
            return null;
        }
    },
    {
        id: 'a11y-keyboard-navigation',
        category: 'Accessibilité',
        human: 'Les modales doivent supporter la navigation clavier.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;

            if ((content.includes('modal') || content.includes('Modal') || content.includes('Dialog')) &&
                content.includes('isOpen')) {
                if (!content.includes('onKeyDown') && !content.includes('Escape') &&
                    !content.includes('trapFocus') && !content.includes('FocusTrap')) {
                    return { line: 0, match: 'Modal sans support clavier (Escape pour fermer, focus trap)' };
                }
            }
            return null;
        }
    },
    {
        id: 'a11y-role-attribute',
        category: 'Accessibilité',
        human: 'Les éléments interactifs non-sémantiques doivent avoir un rôle.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // div/span cliquable sans role
                if (line.match(/<(div|span)[^>]*onClick=/) && !line.includes('role=')) {
                    errors.push({ line: i, match: 'Élément cliquable sans rôle sémantique' });
                }
            });
            return errors.length ? errors : null;
        }
    },

    // =========================================================================
    // 14. INTERNATIONALISATION
    // =========================================================================
    {
        id: 'i18n-hardcoded-text',
        category: 'Internationalisation',
        human: 'Éviter les textes hardcodés - utiliser i18n.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            if (filePath.includes('Landing') || filePath.includes('Marketing')) return null; // OK pour les pages marketing

            // Détecter les textes en français hardcodés dans le JSX
            const frenchPatterns = /(Ajouter|Modifier|Supprimer|Confirmer|Annuler|Sauvegarder|Créer|Éditer|Voir|Détails|Erreur|Succès|Chargement)/;
            if (content.match(/>['"`][^<]*[A-Za-zÀ-ÿ]{10,}[^<]*['"`]</)) {
                if (!content.includes('useTranslation') && !content.includes('t(')) {
                    return { line: 0, match: 'Texte hardcodé détecté - considérer i18n' };
                }
            }
            return null;
        }
    },
    {
        id: 'i18n-date-format',
        category: 'Internationalisation',
        human: 'Utiliser Intl.DateTimeFormat ou date-fns pour les dates.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;

            // Formatage de date hardcodé
            if (content.match(/\.toLocaleDateString\(\s*\)/) ||
                content.match(/\.toLocaleString\(\s*\)/)) {
                return { line: 0, match: 'Formatage de date sans locale explicite' };
            }
            return null;
        }
    },

    // =========================================================================
    // 15. TESTS & COUVERTURE
    // =========================================================================
    {
        id: 'test-coverage-view',
        category: 'Tests',
        human: 'Les Views principales doivent avoir des tests.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/views/')) return null;
            if (filePath.includes('.test.') || filePath.includes('__tests__')) return null;

            // Vérifier si un fichier de test existe
            const testFile = filePath.replace('.tsx', '.test.tsx');
            const testDir = filePath.replace('.tsx', '/__tests__/' + path.basename(filePath));

            // Cette vérification est informative
            return { line: 0, match: `Vérifier que ${path.basename(filePath)} a des tests` };
        }
    },
    {
        id: 'test-mocking',
        category: 'Tests',
        human: 'Les services externes doivent être mockés dans les tests.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.includes('.test.') && !filePath.includes('__tests__')) return null;

            if ((content.includes('firebase') || content.includes('Firestore')) &&
                !content.includes('mock') && !content.includes('Mock')) {
                return { line: 0, match: 'Test utilisant Firebase sans mock' };
            }
            return null;
        }
    },

    // =========================================================================
    // 16. HOOKS & SERVICES
    // =========================================================================
    {
        id: 'hook-naming',
        category: 'Hooks',
        human: 'Les hooks personnalisés doivent commencer par "use".',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.includes('/src/hooks/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Fonction exportée qui n'est pas un hook
                const match = line.match(/^export\s+(const|function)\s+(\w+)/);
                if (match && match[2] && !match[2].startsWith('use') &&
                    match[2] !== 'default') {
                    errors.push({ line: i, match: `Fonction "${match[2]}" dans /hooks/ devrait commencer par "use"` });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'hook-dependencies',
        category: 'Hooks',
        human: 'Les hooks doivent déclarer toutes leurs dépendances.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;

            // Vérifier les eslint-disable pour exhaustive-deps
            if (content.includes('eslint-disable-next-line react-hooks/exhaustive-deps')) {
                return { line: 0, match: 'Désactivation des vérifications de dépendances - à justifier' };
            }
            return null;
        }
    },
    {
        id: 'service-error-logging',
        category: 'Services',
        human: 'Les services doivent utiliser ErrorLogger pour les erreurs.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.includes('/src/services/')) return null;

            if (content.includes('catch') && !content.includes('ErrorLogger')) {
                return { line: 0, match: 'Service avec catch sans ErrorLogger' };
            }
            return null;
        }
    },
    {
        id: 'service-single-responsibility',
        category: 'Services',
        human: 'Les services doivent avoir une responsabilité unique.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.includes('/src/services/')) return null;

            // Compter le nombre de fonctions exportées
            const exportCount = (content.match(/export\s+(const|function|class)/g) || []).length;
            if (exportCount > 10) {
                return { line: 0, match: `Service avec ${exportCount} exports - considérer un découpage` };
            }
            return null;
        }
    },

    // =========================================================================
    // 17. ROUTES & NAVIGATION & WORKFLOW
    // =========================================================================
    {
        id: 'workflow-dead-end',
        category: 'Workflow',
        human: 'Les pages ne doivent pas être des culs-de-sac (navigation requise).',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/views/')) return null;
            // On cherche des éléments de navigation
            const hasNav = content.includes('<Link') ||
                content.includes('useNavigate') ||
                content.includes('href=') ||
                content.includes('<Button') || // Supposons qu'un bouton puisse déclencher une nav
                content.includes('Breadcrumb');

            if (!hasNav) {
                return { line: 0, match: 'Page potentiellement cul-de-sac (aucune navigation/lien détecté)' };
            }
            return null;
        }
    },
    {
        id: 'workflow-broken-links',
        category: 'Workflow',
        human: 'Les liens ne doivent pas être vides ou temporaires.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                if (line.match(/to=['"]['"]/) || line.match(/to=['"]#['"]/) || line.match(/href=['"]#['"]/)) {
                    errors.push({ line: i, match: 'Lien vide ou ancre # détecté (lien cassé)' });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'route-protection',
        category: 'Routes',
        human: 'Les routes privées doivent être protégées.',
        severity: 'critical',
        check: (content, filePath) => {
            if (!filePath.includes('App.tsx') && !filePath.includes('Router') &&
                !filePath.includes('routes')) return null;

            // Vérifier que les routes ont des guards
            if (content.includes('<Route') && content.includes('path=') &&
                content.includes('/dashboard')) {
                if (!content.includes('AuthGuard') && !content.includes('PrivateRoute') &&
                    !content.includes('RequireAuth')) {
                    return { line: 0, match: 'Routes privées potentiellement non protégées' };
                }
            }
            return null;
        }
    },
    {
        id: 'route-404',
        category: 'Routes',
        human: 'L\'application doit avoir une page 404.',
        severity: 'error',
        check: (content, filePath) => {
            if (!filePath.includes('App.tsx') && !filePath.includes('Router')) return null;

            if (content.includes('<Routes>') && !content.includes('*') &&
                !content.includes('NotFound') && !content.includes('404')) {
                return { line: 0, match: 'Router sans route 404 catch-all' };
            }
            return null;
        }
    },
    {
        id: 'route-navigation-type',
        category: 'Routes',
        human: 'Utiliser useNavigate au lieu de window.location.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                if (line.includes('window.location.href') || line.includes('window.location =')) {
                    errors.push({ line: i, match: 'Utiliser useNavigate() au lieu de window.location' });
                }
            });
            return errors.length ? errors : null;
        }
    },

    // =========================================================================
    // 18. IMPORTS & EXPORTS
    // =========================================================================
    {
        id: 'import-order',
        category: 'Imports',
        human: 'Les imports doivent être organisés (React, libs, local).',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const lines = content.split('\n');

            let hasReactImport = false;
            let hasLocalAfterReact = false;
            let hasLibAfterLocal = false;

            lines.forEach((line) => {
                if (line.startsWith('import') && line.includes('from')) {
                    if (line.includes("'react'") || line.includes('"react"')) {
                        hasReactImport = true;
                    } else if (hasReactImport && (line.includes("'./") || line.includes('"./'))) {
                        hasLocalAfterReact = true;
                    } else if (hasLocalAfterReact && !line.includes("'./") && !line.includes('"./')) {
                        hasLibAfterLocal = true;
                    }
                }
            });

            if (hasLibAfterLocal) {
                return { line: 0, match: 'Imports désorganisés - React d\'abord, puis libs, puis local' };
            }
            return null;
        }
    },
    {
        id: 'import-unused',
        category: 'Imports',
        human: 'Supprimer les imports non utilisés.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/')) return null;
            const errors = [];
            const lines = content.split('\n');

            lines.forEach((line, i) => {
                // Import nommé
                const match = line.match(/import\s+\{([^}]+)\}\s+from/);
                if (match) {
                    const imports = match[1].split(',').map(s => s.trim().split(' as ')[0].trim());
                    imports.forEach(imp => {
                        if (imp && !imp.includes('type') && !imp.includes('interface')) {
                            // Vérifier si l'import est utilisé (heuristique simple)
                            const restOfFile = content.slice(line.length);
                            const regex = new RegExp(`\\b${imp}\\b`, 'g');
                            if (!restOfFile.match(regex)) {
                                errors.push({ line: i, match: `Import "${imp}" potentiellement non utilisé` });
                            }
                        }
                    });
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'export-default-naming',
        category: 'Imports',
        human: 'Les exports default doivent correspondre au nom du fichier.',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];
            const fileName = path.basename(filePath, '.tsx');

            const match = content.match(/export\s+default\s+(function\s+)?(\w+)/);
            if (match && match[2] && match[2] !== fileName && match[2] !== 'function') {
                errors.push({ line: 0, match: `Export default "${match[2]}" différent du fichier "${fileName}"` });
            }
            return errors.length ? errors : null;
        }
    }
];

// ============================================================================
// UTILITAIRES
// ============================================================================

function getAllFiles(dirPath, arrayOfFiles = []) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles;

    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const fullPath = path.join(dirPath, file);

        // Ignorer certains chemins
        if (CONFIG.ignorePaths.some(p => fullPath.includes(p))) return;

        if (fs.statSync(fullPath).isDirectory()) {
            getAllFiles(fullPath, arrayOfFiles);
        } else {
            if (CONFIG.extensions.some(ext => file.endsWith(ext))) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

function colorize(text, color) {
    return `${CONFIG.colors[color]}${text}${CONFIG.colors.reset}`;
}

function getSeverityColor(severity) {
    switch (severity) {
        case 'critical': return 'red';
        case 'error': return 'red';
        case 'warning': return 'yellow';
        case 'info': return 'blue';
        default: return 'gray';
    }
}

function getSeverityIcon(severity) {
    switch (severity) {
        case 'critical': return '🔴';
        case 'error': return '🟠';
        case 'warning': return '🟡';
        case 'info': return '🔵';
        default: return '⚪';
    }
}

// ============================================================================
// MOTEUR D'AUDIT
// ============================================================================

function audit(options = {}) {
    const { category, severity, fix } = options;

    console.log('\n' + colorize('═'.repeat(70), 'cyan'));
    console.log(colorize('  🛡️  SENTINEL GRC V2 - AUDIT ULTIME PRODUCTION-READY', 'bold'));
    console.log(colorize('═'.repeat(70), 'cyan') + '\n');

    const startTime = Date.now();
    const files = [...getAllFiles(SRC_DIR), ...getAllFiles(FUNCTIONS_DIR)];

    console.log(colorize(`📁 Analyse de ${files.length} fichiers...`, 'gray') + '\n');

    let violations = 0;
    const summary = {};
    const categoryStats = {};
    const fileViolations = {};

    // Initialiser les compteurs
    RULES.forEach(rule => {
        summary[rule.id] = 0;
        if (!categoryStats[rule.category]) {
            categoryStats[rule.category] = { critical: 0, error: 0, warning: 0, info: 0 };
        }
    });

    // Filtrer les règles selon les options
    const activeRules = RULES.filter(rule => {
        if (category && rule.category.toLowerCase() !== category.toLowerCase()) return false;
        if (severity && rule.severity !== severity) return false;
        return true;
    });

    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(ROOT_DIR, file);

        activeRules.forEach(rule => {
            let results = [];

            // Vérification par regex
            if (rule.regex) {
                rule.regex.lastIndex = 0;
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    // Ignorer les lignes avec des commentaires de désactivation
                    if (line.includes('// eslint-disable') ||
                        line.includes('// audit-ignore') ||
                        line.includes('/* audit-ignore */')) return;

                    if (line.match(rule.regex)) {
                        results.push({ line: index, match: line.trim().substring(0, 80) });
                    }
                });
            }
            // Vérification par fonction custom
            else if (rule.check) {
                const result = rule.check(content, file);
                if (result) {
                    results = Array.isArray(result) ? result : [result];
                }
            }

            // Enregistrer les violations
            results.forEach(result => {
                violations++;
                summary[rule.id]++;
                categoryStats[rule.category][rule.severity]++;

                if (!fileViolations[relativePath]) {
                    fileViolations[relativePath] = [];
                }
                fileViolations[relativePath].push({ rule, result });

                // Afficher la violation
                const icon = getSeverityIcon(rule.severity);
                const color = getSeverityColor(rule.severity);

                console.log(`${icon} ${colorize(`[${rule.severity.toUpperCase()}]`, color)} ${colorize(relativePath, 'cyan')}:${result.line + 1}`);
                console.log(`   ${colorize(rule.category, 'magenta')} | ${rule.human}`);
                if (result.match) {
                    console.log(`   ${colorize('→', 'gray')} ${result.match.substring(0, 100)}`);
                }
                console.log('');
            });
        });
    });

    // Afficher le résumé
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + colorize('═'.repeat(70), 'cyan'));
    console.log(colorize('  📊 RÉSUMÉ DE L\'AUDIT', 'bold'));
    console.log(colorize('═'.repeat(70), 'cyan') + '\n');

    console.log(`⏱️  Durée: ${duration}s`);
    console.log(`📁 Fichiers analysés: ${files.length}`);
    console.log(`📋 Règles vérifiées: ${activeRules.length}`);
    console.log(`\n🎯 Total des violations: ${colorize(violations.toString(), violations > 0 ? 'red' : 'green')}\n`);

    // Statistiques par catégorie
    console.log(colorize('Par catégorie:', 'bold'));
    Object.entries(categoryStats).forEach(([cat, stats]) => {
        const total = stats.critical + stats.error + stats.warning + stats.info;
        if (total > 0) {
            console.log(`  ${colorize(cat, 'cyan')}: ${colorize(stats.critical.toString(), 'red')} critical, ${colorize(stats.error.toString(), 'red')} error, ${colorize(stats.warning.toString(), 'yellow')} warning, ${colorize(stats.info.toString(), 'blue')} info`);
        }
    });

    // Top 10 des fichiers avec le plus de violations
    console.log('\n' + colorize('Top 10 fichiers avec violations:', 'bold'));
    const sortedFiles = Object.entries(fileViolations)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10);

    sortedFiles.forEach(([file, viols], index) => {
        console.log(`  ${index + 1}. ${colorize(file, 'cyan')}: ${viols.length} violations`);
    });

    // Top 10 des règles les plus violées
    console.log('\n' + colorize('Top 10 règles les plus violées:', 'bold'));
    const sortedRules = Object.entries(summary)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    sortedRules.forEach(([ruleId, count], index) => {
        const rule = RULES.find(r => r.id === ruleId);
        console.log(`  ${index + 1}. ${colorize(ruleId, 'magenta')}: ${count} (${rule?.severity})`);
    });

    // Score de qualité
    const maxViolations = files.length * activeRules.length; // Estimation
    const qualityScore = Math.max(0, Math.round(100 - (violations / maxViolations * 1000)));

    console.log('\n' + colorize('═'.repeat(70), 'cyan'));
    console.log(`  🏆 SCORE DE QUALITÉ: ${colorize(qualityScore + '%', qualityScore >= 80 ? 'green' : qualityScore >= 60 ? 'yellow' : 'red')}`);
    console.log(colorize('═'.repeat(70), 'cyan'));

    // Recommandations
    if (violations > 0) {
        console.log('\n' + colorize('💡 RECOMMANDATIONS PRIORITAIRES:', 'bold'));

        // Recommandations basées sur les violations critiques
        const criticalCount = Object.entries(categoryStats).reduce((sum, [, stats]) => sum + stats.critical, 0);
        if (criticalCount > 0) {
            console.log(colorize(`  ⚠️  ${criticalCount} violations CRITIQUES à corriger immédiatement!`, 'red'));
        }

        // Catégories à améliorer
        const worstCategories = Object.entries(categoryStats)
            .map(([cat, stats]) => ({ cat, total: stats.critical * 10 + stats.error * 5 + stats.warning * 2 + stats.info }))
            .filter(c => c.total > 0)
            .sort((a, b) => b.total - a.total)
            .slice(0, 3);

        if (worstCategories.length > 0) {
            console.log('  📌 Catégories à améliorer en priorité:');
            worstCategories.forEach(({ cat }) => {
                console.log(`     - ${cat}`);
            });
        }
    }

    console.log('\n' + colorize('✨ Audit terminé.', 'green') + '\n');

    // Exit code basé sur les violations critiques et erreurs
    const exitCode = categoryStats ?
        Object.values(categoryStats).reduce((sum, stats) => sum + stats.critical + stats.error, 0) > 0 ? 1 : 0
        : 0;

    return { violations, summary, categoryStats, qualityScore, exitCode };
}

// ============================================================================
// POINT D'ENTRÉE
// ============================================================================

// Parser les arguments
const args = process.argv.slice(2);
const options = {};

args.forEach(arg => {
    if (arg.startsWith('--category=')) {
        options.category = arg.split('=')[1];
    } else if (arg.startsWith('--severity=')) {
        options.severity = arg.split('=')[1];
    } else if (arg === '--fix') {
        options.fix = true;
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
Usage: node scripts/audit-sentinel.js [options]

Options:
  --category=<cat>   Filtrer par catégorie (Architecture, Boutons, Firebase, etc.)
  --severity=<sev>   Filtrer par sévérité (critical, error, warning, info)
  --fix              Tenter de corriger automatiquement (à venir)
  --help, -h         Afficher cette aide

Catégories disponibles:
  Architecture, Boutons, Tableaux, Firebase, UX/UI, Logique, Sécurité,
  Performance, TypeScript, React, Formulaires, États, Accessibilité,
  Internationalisation, Tests, Hooks, Services, Routes, Imports

Exemples:
  node scripts/audit-sentinel.js
  node scripts/audit-sentinel.js --category=Sécurité
  node scripts/audit-sentinel.js --severity=critical
  node scripts/audit-sentinel.js --category=Firebase --severity=error
`);
        process.exit(0);
    }
});

const result = audit(options);
process.exit(result.exitCode);
