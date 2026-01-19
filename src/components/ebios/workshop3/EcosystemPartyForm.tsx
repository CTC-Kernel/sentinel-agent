/**
 * Ecosystem Party Form
 * Story 17.1: Cartographie de l'Écosystème
 *
 * Modal form for creating and editing ecosystem parties
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Globe, Save, Trash2, Users, Building, Cloud, Truck } from '../../ui/Icons';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../utils/cn';
import { GlassCard } from '../../ui/GlassCard';
import { Button } from '../../ui/button';
import type { EcosystemParty, EcosystemPartyType } from '../../../types/ebios';

const PARTY_TYPES: EcosystemPartyType[] = [
  'supplier',
  'partner',
  'customer',
  'regulator',
  'subcontractor',
  'cloud_provider',
  'software_vendor',
  'service_provider',
  'other',
];

const PARTY_TYPE_LABELS: Record<EcosystemPartyType, { fr: string; en: string }> = {
  supplier: { fr: 'Fournisseur', en: 'Supplier' },
  partner: { fr: 'Partenaire', en: 'Partner' },
  customer: { fr: 'Client', en: 'Customer' },
  regulator: { fr: 'Régulateur', en: 'Regulator' },
  subcontractor: { fr: 'Sous-traitant', en: 'Subcontractor' },
  cloud_provider: { fr: 'Fournisseur Cloud', en: 'Cloud Provider' },
  software_vendor: { fr: 'Éditeur logiciel', en: 'Software Vendor' },
  service_provider: { fr: 'Prestataire', en: 'Service Provider' },
  other: { fr: 'Autre', en: 'Other' },
};

const PARTY_TYPE_ICONS: Record<EcosystemPartyType, typeof Users> = {
  supplier: Truck,
  partner: Users,
  customer: Users,
  regulator: Building,
  subcontractor: Truck,
  cloud_provider: Cloud,
  software_vendor: Cloud,
  service_provider: Building,
  other: Globe,
};

// Form validation schema
const ecosystemPartySchema = z.object({
  name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  description: z.string().optional(),
  type: z.string().refine(
    (val): val is EcosystemPartyType => PARTY_TYPES.includes(val as EcosystemPartyType),
    { message: 'Type requis' }
  ),
  category: z.union([z.literal('internal'), z.literal('external')]),
  trustLevel: z.number().min(1).max(5),
  exposure: z.number().min(1).max(5),
  cyberDependency: z.number().min(1).max(5),
  penetration: z.number().min(1).max(5),
});

type EcosystemPartyFormData = z.infer<typeof ecosystemPartySchema>;

interface EcosystemPartyFormProps {
  party?: EcosystemParty | null;
  onSave: (party: EcosystemParty) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export const EcosystemPartyForm: React.FC<EcosystemPartyFormProps> = ({
  party,
  onSave,
  onDelete,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const isEditing = !!party?.name;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = useForm<EcosystemPartyFormData>({
    resolver: zodResolver(ecosystemPartySchema),
    defaultValues: {
      name: party?.name || '',
      description: party?.description || '',
      type: party?.type || 'supplier',
      category: party?.category || 'external',
      trustLevel: party?.trustLevel || 3,
      exposure: party?.exposure || 3,
      cyberDependency: party?.cyberDependency || 3,
      penetration: party?.penetration || 3,
    },
  });

  const watchedType = useWatch({ control, name: 'type' });
  const watchedTrustLevel = useWatch({ control, name: 'trustLevel' });
  const watchedExposure = useWatch({ control, name: 'exposure' });
  const watchedCyberDependency = useWatch({ control, name: 'cyberDependency' });
  const watchedPenetration = useWatch({ control, name: 'penetration' });

  useEffect(() => {
    if (party) {
      reset({
        name: party.name,
        description: party.description || '',
        type: party.type,
        category: party.category,
        trustLevel: party.trustLevel,
        exposure: party.exposure,
        cyberDependency: party.cyberDependency,
        penetration: party.penetration,
      });
    }
  }, [party, reset]);

  const onSubmit = (data: EcosystemPartyFormData) => {
    const ecosystemParty: EcosystemParty = {
      id: party?.id || uuidv4(),
      name: data.name,
      description: data.description,
      type: data.type as EcosystemPartyType,
      category: data.category,
      trustLevel: data.trustLevel as 1 | 2 | 3 | 4 | 5,
      exposure: data.exposure as 1 | 2 | 3 | 4 | 5,
      cyberDependency: data.cyberDependency as 1 | 2 | 3 | 4 | 5,
      penetration: data.penetration as 1 | 2 | 3 | 4 | 5,
      position: party?.position,
    };

    onSave(ecosystemParty);
  };

  const handleDelete = () => {
    if (party && onDelete) {
      if (window.confirm(t('ebios.workshop3.confirmDeleteParty', 'Êtes-vous sûr de vouloir supprimer cette partie prenante ?'))) {
        onDelete(party.id);
      }
    }
  };

  const Icon = PARTY_TYPE_ICONS[watchedType as EcosystemPartyType] || Globe;

  const renderSlider = (
    name: 'trustLevel' | 'exposure' | 'cyberDependency' | 'penetration',
    label: string,
    description: string,
    lowLabel: string,
    highLabel: string,
    value: number
  ) => {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
          <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            {value}/5
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-2">{description}</p>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => setValue(name, parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <GlassCard className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isEditing
                  ? t('ebios.workshop3.editParty', 'Modifier la partie prenante')
                  : t('ebios.workshop3.addParty', 'Ajouter une partie prenante')}
              </h3>
              <p className="text-sm text-gray-500">
                {t('ebios.workshop3.partyFormHelp', 'Définir les caractéristiques de cette partie')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('ebios.workshop3.partyName', 'Nom')} *
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder={t('ebios.workshop3.partyNamePlaceholder', 'Ex: AWS, Salesforce, ANSSI...')}
              className={cn(
                "w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-gray-800",
                errors.name
                  ? "border-red-500"
                  : "border-gray-200 dark:border-gray-700"
              )}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Type & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('ebios.workshop3.partyType', 'Type')} *
              </label>
              <select
                {...register('type')}
                className={cn(
                  "w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-gray-800",
                  errors.type
                    ? "border-red-500"
                    : "border-gray-200 dark:border-gray-700"
                )}
              >
                {PARTY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PARTY_TYPE_LABELS[type]?.[locale] || type}
                  </option>
                ))}
              </select>
              {errors.type && (
                <p className="mt-1 text-sm text-red-500">{errors.type.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('ebios.workshop3.partyCategory', 'Catégorie')} *
              </label>
              <select
                {...register('category')}
                className={cn(
                  "w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-gray-800",
                  errors.category
                    ? "border-red-500"
                    : "border-gray-200 dark:border-gray-700"
                )}
              >
                <option value="external">{t('ebios.workshop3.external', 'Externe')}</option>
                <option value="internal">{t('ebios.workshop3.internal', 'Interne')}</option>
              </select>
              {errors.category && (
                <p className="mt-1 text-sm text-red-500">{errors.category.message}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('ebios.workshop3.partyDescription', 'Description')}
            </label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder={t('ebios.workshop3.partyDescriptionPlaceholder', 'Description de cette partie prenante...')}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 resize-none"
            />
          </div>

          {/* Evaluation Sliders */}
          <div className="space-y-5 pt-2">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {t('ebios.workshop3.evaluation', 'Évaluation')}
            </h4>

            {renderSlider(
              'trustLevel',
              t('ebios.workshop3.trustLevel', 'Niveau de confiance'),
              t('ebios.workshop3.trustLevelHelp', 'Fiabilité et réputation de cette partie'),
              t('ebios.workshop3.lowTrust', 'Faible'),
              t('ebios.workshop3.highTrust', 'Élevée'),
              watchedTrustLevel
            )}

            {renderSlider(
              'exposure',
              t('ebios.workshop3.exposure', 'Exposition'),
              t('ebios.workshop3.exposureHelp', 'Niveau d\'accès à vos systèmes et données'),
              t('ebios.workshop3.lowExposure', 'Limitée'),
              t('ebios.workshop3.highExposure', 'Forte'),
              watchedExposure
            )}

            {renderSlider(
              'cyberDependency',
              t('ebios.workshop3.cyberDependency', 'Cyber-dépendance'),
              t('ebios.workshop3.cyberDependencyHelp', 'Dépendance de vos opérations à cette partie'),
              t('ebios.workshop3.lowDependency', 'Faible'),
              t('ebios.workshop3.highDependency', 'Critique'),
              watchedCyberDependency
            )}

            {renderSlider(
              'penetration',
              t('ebios.workshop3.penetration', 'Maturité cyber'),
              t('ebios.workshop3.penetrationHelp', 'Niveau de maturité cyber de cette partie'),
              t('ebios.workshop3.lowMaturity', 'Faible'),
              t('ebios.workshop3.highMaturity', 'Élevée'),
              watchedPenetration
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <div>
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDelete}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('common.delete', 'Supprimer')}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel', 'Annuler')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? t('common.save', 'Enregistrer') : t('common.add', 'Ajouter')}
              </Button>
            </div>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};

export default EcosystemPartyForm;
