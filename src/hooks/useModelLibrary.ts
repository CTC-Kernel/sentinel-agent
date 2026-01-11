import { useContext } from 'react';
import { ModelLibraryContext } from '../contexts/ModelLibraryContextDefinition';
import { ModelLibrary } from '../contexts/modelLibraryConstants';

export const useModelLibrary = (): ModelLibrary => {
    const context = useContext(ModelLibraryContext);
    if (!context) {
        throw new Error('ModelLibraryContext must be used within ModelLibraryProvider');
    }
    return context;
};
