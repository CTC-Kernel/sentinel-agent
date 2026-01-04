import type { Meta, StoryObj } from '@storybook/react';
import { DashboardCard } from '../components/dashboard/DashboardCard';

const meta: Meta<typeof DashboardCard> = {
  title: 'Components/DashboardCard',
  component: DashboardCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: 'Carte de dashboard avec expansion et accessibilité complète.',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: 'Titre de la carte',
    },
    subtitle: {
      control: 'text',
      description: 'Sous-titre de la carte',
    },
    expandable: {
      control: 'boolean',
      description: 'Permet l\'expansion en plein écran',
    },
    loading: {
      control: 'boolean',
      description: 'Affiche l\'état de chargement',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Risques Critiques',
    subtitle: '5 risques identifiés',
    expandable: true,
    children: (
      <div className=\"p-6\">
        <div className=\"space-y-4\">
          <div className=\"p-4 bg-red-50 rounded-lg border border-red-200\">
            <h4 className=\"font-semibold text-red-800\">Risque Élevé</h4>
            <p className=\"text-sm text-red-600 mt-1\">Données sensibles exposées</p>
          </div>
          <div className=\"p-4 bg-yellow-50 rounded-lg border border-yellow-200\">
            <h4 className=\"font-semibold text-yellow-800\">Risque Moyen</h4>
            <p className=\"text-sm text-yellow-600 mt-1\">Mise à jour requise</p>
          </div>
        </div>
      </div>
    ),
  },
};

export const WithoutExpansion: Story = {
  args: {
    title: 'Statistiques',
    subtitle: 'Vue d\'ensemble',
    expandable: false,
    children: (
      <div className=\"p-6\">
        <div className=\"grid grid-cols-2 gap-4\">
          <div className=\"text-center\">
            <div className=\"text-2xl font-bold text-blue-600\">87%</div>
            <div className=\"text-sm text-gray-600\">Conformité</div>
          </div>
          <div className=\"text-center\">
            <div className=\"text-2xl font-bold text-green-600\">12</div>
            <div className=\"text-sm text-gray-600\">Actifs</div>
          </div>
        </div>
      </div>
    ),
  },
};

export const Loading: Story = {
  args: {
    title: 'Chargement...',
    subtitle: 'Récupération des données',
    loading: true,
  },
};

export const WithIcon: Story = {
  args: {
    title: 'Sécurité',
    subtitle: 'État des contrôles',
    expandable: true,
    icon: (
      <div className=\"p-2 rounded-lg bg-blue-100\">
        <span className=\"text-blue-600 text-xl\">🛡️</span>
      </div>
    ),
    children: (
      <div className=\"p-6\">
        <div className=\"space-y-3\">
          <div className=\"flex items-center justify-between\">
            <span>Contrôle d\'accès</span>
            <span className=\"text-green-600\">✓ Actif</span>
          </div>
          <div className=\"flex items-center justify-between\">
            <span>Chiffrement</span>
            <span className=\"text-green-600\">✓ Actif</span>
          </div>
          <div className=\"flex items-center justify-between\">
            <span>Audit logs</span>
            <span className=\"text-yellow-600\">⚠ Vérifier</span>
          </div>
        </div>
      </div>
    ),
  },
};

export const WithHeaderAction: Story = {
  args: {
    title: 'Rapports',
    subtitle: 'Génération en cours',
    expandable: true,
    headerAction: (
      <button className=\"p-2 hover:bg-gray-100 rounded-lg transition-colors\">
        <span className=\"text-gray-600\">⚙️</span>
      </button>
    ),
    children: (
      <div className=\"p-6\">
        <div className=\"space-y-4\">
          <div className=\"p-4 bg-blue-50 rounded-lg\">
            <h4 className=\"font-semibold text-blue-800\">Rapport Mensuel</h4>
            <p className=\"text-sm text-blue-600 mt-1\">Généré le 1er janvier</p>
          </div>
        </div>
      </div>
    ),
  },
};
