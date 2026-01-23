import { createContext } from 'react';
import { LazyModelLibrary } from './modelLibraryConstants';

export const ModelLibraryContext = createContext<LazyModelLibrary | null>(null);
