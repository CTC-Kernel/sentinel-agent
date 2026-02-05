/**
 * Exemple d'intégration de sécurité dans AssetForm
 *
 * Ce fichier montre 2 approches pour sécuriser le formulaire AssetForm:
 * 1. Migration complète vers useSecureForm (recommandé pour nouveaux formulaires)
 * 2. Ajout de sécurité au formulaire react-hook-form existant (migration progressive)
 *
 * CHOISISSEZ L'APPROCHE QUI CONVIENT À VOTRE PROJET
 */

import React, { useState } from 'react';
import { useForm, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assetSchema, AssetFormData } from '../schemas/assetSchema';
import { Asset, UserProfile, Supplier } from '../types';
import { RateLimiter } from '../services/rateLimitService';
import { InputSanitizer } from '../services/inputSanitizationService';
import { SessionMonitor } from '../services/sessionMonitoringService';
import { useSecureFormWithZod } from '../hooks/useSecureForm';
import { toast } from '@/lib/toast';
import { ErrorLogger } from '../services/errorLogger';
import { useStore } from '../store';

interface AssetFormProps {
    onSubmit: (data: AssetFormData) => Promise<void>;
    onCancel: () => void;
    initialData?: Asset | null;
    usersList: UserProfile[];
    suppliers: Supplier[];
    isEditing?: boolean;
    isLoading?: boolean;
    readOnly?: boolean;
}

// =====================================================
// APPROCHE 1: Migration complète vers useSecureForm
// RECOMMANDÉ pour nouveaux formulaires ou refactoring complet
// =====================================================

export const AssetFormSecure_Approach1: React.FC<AssetFormProps> = ({
    onSubmit,
    onCancel,
    initialData,
    usersList: _usersList,
    suppliers: _suppliers,
    isEditing = false,
    isLoading: _isLoading = false,
    readOnly = false
}) => {
    const { t } = useStore();

    // Utiliser useSecureFormWithZod au lieu de useForm
    const form = useSecureFormWithZod<AssetFormData>({
        schema: assetSchema as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        initialValues: {
            name: initialData?.name || '',
            type: initialData?.type || 'Matériel',
            owner: initialData?.owner || '',
            // ... autres champs
        },
        onSubmit: async (sanitizedData: AssetFormData) => {
            // Les données sont automatiquement sanitizées
            // Le rate limiting est automatiquement appliqué

            // Enregistrer l'activité
            SessionMonitor.recordActivity();

            try {
                await onSubmit(sanitizedData);
                toast.success(t('assets.saved') || 'Actif sauvegardé avec succès');
            } catch (error) {
                ErrorLogger.error(error, 'AssetFormSecure.onSubmit');
                toast.error(t('assets.saveError') || 'Erreur lors de la sauvegarde');
                throw error;
            }
        },
        rateLimitOperation: 'api',
        onError: () => {
            toast.error(t('common.unexpectedError') || 'Une erreur est survenue');
        }
    });

    return (
        <form onSubmit={form.handleSubmit} className="space-y-4">
            {/* Nom */}
            <div>
                <label htmlFor="asset-name" className="block text-sm font-medium mb-1">
                    Nom de l'actif *
                </label>
                <input
                    id="asset-name"
                    type="text"
                    value={form.values.name}
                    onChange={(e) => form.handleChange('name')(e.target.value)}
                    onBlur={form.handleBlur('name')}
                    disabled={readOnly || form.isSubmitting}
                    className={`w-full px-3 py-2 border rounded-md ${form.errors.name && form.touched.name ? 'border-red-500' : ''
                        }`}
                />
                {form.errors.name && form.touched.name && (
                    <p className="mt-1 text-sm text-red-600">{form.errors.name}</p>
                )}
            </div>

            {/* Type */}
            <div>
                <label htmlFor="asset-type" className="block text-sm font-medium mb-1">
                    Type *
                </label>
                <select
                    id="asset-type"
                    value={form.values.type}
                    onChange={(e) => form.handleChange('type')(e.target.value)}
                    disabled={readOnly || form.isSubmitting}
                    className="w-full px-3 py-2 border rounded-md"
                >
                    <option value="Matériel">Matériel</option>
                    <option value="Logiciel">Logiciel</option>
                    <option value="Service">Service</option>
                    <option value="Humain">Humain</option>
                    <option value="Données">Données</option>
                </select>
            </div>

            {/* Boutons */}
            <div className="flex gap-4 pt-4">
                <button
                    type="submit"
                    disabled={form.isSubmitting || !form.isValid || readOnly}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground"
                >
                    {form.isSubmitting ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={form.isSubmitting}
                    className="px-4 py-2 border rounded-md"
                >
                    Annuler
                </button>
            </div>
        </form>
    );
};

// =====================================================
// APPROCHE 2: Ajout de sécurité au formulaire existant
// RECOMMANDÉ pour migration progressive
// =====================================================

export const AssetFormSecure_Approach2: React.FC<AssetFormProps> = ({
    onSubmit,
    onCancel,
    initialData,
    usersList: _usersList,
    suppliers: _suppliers,
    isEditing = false,
    isLoading = false,
    readOnly = false
}) => {
    const user = useStore((state: any) => state.user); // eslint-disable-line @typescript-eslint/no-explicit-any
    const t = useStore((state: any) => state.t); // eslint-disable-line @typescript-eslint/no-explicit-any
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Garder react-hook-form existant
    const { handleSubmit } = useForm<AssetFormData>({
        resolver: zodResolver(assetSchema) as Resolver<AssetFormData>,
        mode: 'onBlur',
        defaultValues: {
            name: initialData?.name || '',
            type: initialData?.type || 'Matériel',
            owner: initialData?.owner || '',
            // ... autres champs
        }
    });

    // Wrapper pour ajouter la sécurité
    const handleSecureSubmit = async (data: AssetFormData) => {
        // 1. Rate Limiting
        if (!RateLimiter.checkLimit('api', user?.uid)) {
            const waitTime = RateLimiter.getWaitTime('api', user?.uid);
            toast.error(t('common.rateLimited') || `Trop de requêtes. Veuillez patienter ${Math.ceil(waitTime / 1000)}s.`);
            return;
        }

        // 2. Enregistrer l'activité
        SessionMonitor.recordActivity();

        // 3. Sanitization des données
        const sanitizedData = sanitizeAssetData(data);

        // 4. Détection des tentatives d'attaque
        detectMaliciousInput(sanitizedData);

        setIsSubmitting(true);

        try {
            await onSubmit(sanitizedData);
            toast.success(t('assets.saved') || 'Actif sauvegardé avec succès');
        } catch (error) {
            ErrorLogger.error(error, 'AssetForm.handleSecureSubmit', {
                metadata: {
                    userId: user?.uid,
                    assetName: sanitizedData.name
                }
            });
            toast.error(t('assets.saveError') || 'Erreur lors de la sauvegarde');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Fonction de sanitization spécifique aux actifs
    const sanitizeAssetData = (data: AssetFormData): AssetFormData => {
        return {
            ...data,
            name: InputSanitizer.sanitizeString(data.name, { maxLength: 200 }),
            owner: InputSanitizer.sanitizeEmail(data.owner),
            location: data.location ? InputSanitizer.sanitizeString(data.location, { maxLength: 200 }) : '',
            ipAddress: data.ipAddress ? sanitizeIPAddress(data.ipAddress) : undefined,
            version: data.version ? InputSanitizer.sanitizeString(data.version, { maxLength: 50 }) : undefined,
            email: data.email ? InputSanitizer.sanitizeEmail(data.email) : undefined,
            // URL de service
            serviceDetails: data.serviceDetails ? {
                ...data.serviceDetails,
                providerUrl: data.serviceDetails.providerUrl ? InputSanitizer.sanitizeURL(data.serviceDetails.providerUrl) : undefined,
                supportContact: data.serviceDetails.supportContact ? InputSanitizer.sanitizeEmail(data.serviceDetails.supportContact) : undefined
            } : undefined
        };
    };

    // Validation supplémentaire d'adresse IP
    const sanitizeIPAddress = (ip: string): string => {
        const sanitized = InputSanitizer.sanitizeString(ip, { maxLength: 45 }); // IPv6 max length

        // Valider format IPv4 ou IPv6
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;

        if (!ipv4Regex.test(sanitized) && !ipv6Regex.test(sanitized)) {
            ErrorLogger.warn('Invalid IP address format', 'AssetForm.sanitizeIPAddress', {
                metadata: { ip: sanitized }
            });
            return '';
        }

        // Vérifier que ce n'est pas une IP privée pour les actifs critiques
        // (optionnel, selon les besoins métier)
        const privateRanges = ['192.168.', '10.', '172.16.', '127.0.0.1'];
        const isPrivate = privateRanges.some(range => sanitized.startsWith(range));

        if (isPrivate) {
            ErrorLogger.info('Private IP address detected', 'AssetForm.sanitizeIPAddress', {
                metadata: { ip: sanitized }
            });
        }

        return sanitized;
    };

    // Détection des tentatives malveillantes
    const detectMaliciousInput = (data: AssetFormData) => {
        const dataString = JSON.stringify(data);

        // SQL Injection
        if (InputSanitizer.detectSQLInjection(dataString)) {
            ErrorLogger.warn('SQL injection attempt in AssetForm', 'AssetForm.detectMaliciousInput', {
                metadata: {
                    userId: user?.uid,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Path Traversal
        if (InputSanitizer.detectPathTraversal(dataString)) {
            ErrorLogger.warn('Path traversal attempt in AssetForm', 'AssetForm.detectMaliciousInput', {
                metadata: {
                    userId: user?.uid,
                    timestamp: new Date().toISOString()
                }
            });
        }
    };

    return (
        <form onSubmit={handleSubmit(handleSecureSubmit)} className="space-y-4">
            {/* Votre formulaire existant reste inchangé */}
            {/* ... tous les champs ... */}

            {/* Boutons */}
            <div className="flex gap-4 pt-4">
                <button
                    type="submit"
                    disabled={isSubmitting || isLoading || readOnly}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground"
                >
                    {isSubmitting ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting || isLoading}
                    className="px-4 py-2 border rounded-md"
                >
                    Annuler
                </button>
            </div>
        </form>
    );
};

// =====================================================
// COMPARAISON DES APPROCHES
// =====================================================

/**
 * APPROCHE 1: useSecureFormWithZod
 * ✅ PRO:
 *    - Sécurité intégrée automatiquement
 *    - Moins de code à écrire
 *    - API simple et cohérente
 *    - Idéal pour nouveaux formulaires
 *
 * ❌ CON:
 *    - Nécessite refactoring du formulaire existant
 *    - Changement d'API (useForm → useSecureForm)
 *    - Migration plus lourde
 *
 * TEMPS DE MIGRATION: 15-30 minutes par formulaire
 *
 * ---
 *
 * APPROCHE 2: Wrapper de sécurité
 * ✅ PRO:
 *    - Garde le code existant
 *    - Migration progressive
 *    - Compatible avec react-hook-form
 *    - Contrôle fin de la sanitization
 *
 * ❌ CON:
 *    - Plus de code à maintenir
 *    - Sécurité à appliquer manuellement
 *    - Risque d'oubli
 *
 * TEMPS DE MIGRATION: 5-10 minutes par formulaire
 *
 * ---
 *
 * RECOMMANDATION:
 * - Nouveaux formulaires: Approche 1
 * - Formulaires existants complexes: Approche 2
 * - Migration progressive: Approche 2 → puis Approche 1
 */

// =====================================================
// INSTRUCTIONS D'INTÉGRATION
// =====================================================

export const AssetFormIntegrationInstructions = `
OPTION A: Migration vers useSecureForm (Approche 1)
===================================================

1. Remplacer l'import:
   - Supprimer: import { useForm } from 'react-hook-form';
   - Ajouter: import { useSecureFormWithZod } from '../../hooks/useSecureForm';

2. Remplacer useForm par useSecureFormWithZod:
   const form = useSecureFormWithZod({
     schema: assetSchema,
     initialValues: { ... },
     onSubmit: async (data) => { ... }
   });

3. Adapter le JSX:
   - value={form.values.fieldName}
   - onChange={(e) => form.handleChange('fieldName')(e.target.value)}
   - onBlur={form.handleBlur('fieldName')}

4. Utiliser form.errors et form.touched pour l'affichage d'erreurs

TEMPS: ~20 minutes


OPTION B: Ajout de sécurité au formulaire existant (Approche 2)
================================================================

1. Ajouter les imports:
   import { RateLimiter } from '../../services/rateLimitService';
   import { InputSanitizer } from '../../services/inputSanitizationService';
   import { SessionMonitor } from '../../services/sessionMonitoringService';

2. Créer une fonction handleSecureSubmit qui wrappe le handleSubmit:
   - Vérifier rate limiting
   - Sanitizer les données
   - Détecter les attaques
   - Appeler onSubmit

3. Remplacer onSubmit={handleSubmit(onSubmit)}
   par onSubmit={handleSubmit(handleSecureSubmit)}

TEMPS: ~10 minutes


TESTS APRÈS INTÉGRATION:
========================

✅ Soumettre le formulaire normalement → Doit fonctionner
✅ Entrer <script>alert('xss')</script> → Doit être sanitizé
✅ Entrer une URL locale (http://localhost) → Doit être rejetée
✅ Soumettre 100 fois rapidement → Doit être rate-limité
✅ Vérifier les logs ErrorLogger → Doit logger les tentatives d'attaque
`;
