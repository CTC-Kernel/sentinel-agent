import { useContext } from 'react';
import { ModelLibraryContext } from '../contexts/ModelLibraryContextDefinition';
import { LazyModelLibrary } from '../contexts/modelLibraryConstants';

export const useModelLibrary = (): LazyModelLibrary => {
 const context = useContext(ModelLibraryContext);
 if (!context) {
 throw new Error('ModelLibraryContext must be used within ModelLibraryProvider');
 }
 return context;
};
