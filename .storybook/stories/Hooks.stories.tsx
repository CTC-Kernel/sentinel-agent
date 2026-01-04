import type { Meta, StoryObj } from '@storybook/react';
import { useAccessibility } from '../hooks/useAccessibility';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { useDoubleSubmitPrevention } from '../hooks/useDoubleSubmitPrevention';

const meta: Meta = {
  title: 'Hooks/Accessibility',
  parameters: {
    layout: 'centered',
    docs: {
      description: 'Hooks utilitaires pour accessibilité et gestion d\'erreurs.',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AccessibilityDemo: Story = {
  render: () => {
    const { generateId, getIconButtonProps, getFormProps, keyboardHandlers } = useAccessibility();
    
    const buttonId = generateId('btn');
    const formProps = getFormProps('Formulaire de contact', 'Remplissez les champs ci-dessous');
    
    return (
      <div className=\"p-6 max-w-md mx-auto space-y-4\">
        <h2 className=\"text-xl font-bold\">Démonstration Accessibilité</h2>
        
        <button
          {...getIconButtonProps('Bouton d\'action', buttonId)}
          className=\"px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700\"
        >
          Action
        </button>
        
        <form
          {...formProps}
          className=\"space-y-4 p-4 border rounded-lg\"
        >
          <div>
            <label htmlFor={formProps.titleProps.id} className=\"block text-sm font-medium mb-1\">
              {formProps.titleProps.id}
            </label>
            <input
              type=\"text\"
              id={formProps.titleProps.id}
              className=\"w-full px-3 py-2 border rounded-md\"
              placeholder=\"Entrez le titre\"
            />
          </div>
          
          <button
            type=\"submit\"
            className=\"px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700\"
          >
            Soumettre
          </button>
        </form>
        
        <div className=\"text-sm text-gray-600\">
          <p>✅ IDs uniques générés</p>
          <p>✅ Labels ARIA ajoutés</p>
          <p>✅ Navigation clavier supportée</p>
        </div>
      </div>
    );
  },
};

export const ErrorHandlerDemo: Story = {
  render: () => {
    const { handleError } = useErrorHandler();
    
    const handleNetworkError = () => {
      const error = new Error('Échec de connexion au serveur');
      error.name = 'NetworkError';
      handleError(error, 'Demo Network Error');
    };
    
    const handleValidationError = () => {
      const error = new Error('Le champ email est requis');
      error.name = 'ValidationError';
      handleError(error, 'Demo Validation Error');
    };
    
    return (
      <div className=\"p-6 max-w-md mx-auto space-y-4\">
        <h2 className=\"text-xl font-bold\">Démonstration Gestion d\'Erreurs</h2>
        
        <div className=\"space-y-3\">
          <button
            onClick={handleNetworkError}
            className=\"px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700\"
          >
            Simuler Erreur Réseau
          </button>
          
          <button
            onClick={handleValidationError}
            className=\"px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700\"
          >
            Simuler Erreur Validation
          </button>
        </div>
        
        <div className=\"text-sm text-gray-600\">
          <p>✅ Types d\'erreurs structurés</p>
          <p>✅ Messages utilisateurs contextuels</p>
          <p>✅ Logging intelligent</p>
        </div>
      </div>
    );
  },
};

export const DoubleSubmitDemo: Story = {
  render: () => {
    const { isSubmitting, handleSubmit } = useDoubleSubmitPrevention();
    
    const simulateSubmit = async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Formulaire soumis!');
    };
    
    return (
      <div className=\"p-6 max-w-md mx-auto space-y-4\">
        <h2 className=\"text-xl font-bold\">Démonstration Anti Double-Submit</h2>
        
        <button
          onClick={() => handleSubmit(simulateSubmit)}
          disabled={isSubmitting}
          className=\"px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed\"
        >
          {isSubmitting ? (
            <span className=\"flex items-center\">
              <span className=\"animate-spin mr-2\">⟳</span>
              Soumission en cours...
            </span>
          ) : (
            'Soumettre le Formulaire'
          )}
        </button>
        
        <div className=\"text-sm text-gray-600\">
          <p>🔄 Cliquez rapidement pour tester</p>
          <p>✅ Protection automatique activée</p>
          <p>⏱️ Timeout de sécurité intégré</p>
        </div>
      </div>
    );
  },
};
