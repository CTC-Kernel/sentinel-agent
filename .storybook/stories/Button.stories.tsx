import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: 'Bouton principal avec protection double-submit intégrée et variants standardisés.',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: 'text',
      description: 'Contenu du bouton',
    },
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'glass', 'premium'],
      description: 'Variant visuel du bouton',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon', 'xl'],
      description: 'Taille du bouton',
    },
    disabled: {
      control: 'boolean',
      description: 'Désactive le bouton',
    },
    isLoading: {
      control: 'boolean',
      description: 'Affiche l\'état de chargement',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Bouton principal',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Bouton secondaire',
    variant: 'secondary',
  },
};

export const Destructive: Story = {
  args: {
    children: 'Supprimer',
    variant: 'destructive',
  },
};

export const Outline: Story = {
  args: {
    children: 'Bouton outline',
    variant: 'outline',
  },
};

export const Ghost: Story = {
  args: {
    children: 'Bouton fantôme',
    variant: 'ghost',
  },
};

export const Glass: Story = {
  args: {
    children: 'Bouton glass',
    variant: 'glass',
  },
};

export const Premium: Story = {
  args: {
    children: 'Bouton premium',
    variant: 'premium',
  },
};

export const Small: Story = {
  args: {
    children: 'Petit',
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    children: 'Grand',
    size: 'lg',
  },
};

export const Icon: Story = {
  args: {
    children: '🔍',
    size: 'icon',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Désactivé',
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    children: 'Chargement...',
    isLoading: true,
  },
};

export const WithAccessibility: Story = {
  args: {
    children: 'Bouton accessible',
    'aria-label': 'Action principale',
  },
  parameters: {
    docs: {
      description: 'Bouton avec attributs ARIA pour accessibilité complète.',
    },
  },
};
