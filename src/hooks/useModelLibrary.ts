import { useContext } from 'react';
import { ModelLibraryContext } from '../context/ModelLibraryContextDefinition';
import { ModelLibrary } from '../context/modelLibraryConstants';

export const useModelLibrary = (): ModelLibrary => {
    const context = useContext(ModelLibraryContext);
    if (!context) {
        throw new Error('ModelLibraryContext must be used within ModelLibraryProvider');
    }
    return context;
};
