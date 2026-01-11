import { createContext } from 'react';
import { ModelLibrary } from './modelLibraryConstants';

export const ModelLibraryContext = createContext<ModelLibrary | null>(null);
