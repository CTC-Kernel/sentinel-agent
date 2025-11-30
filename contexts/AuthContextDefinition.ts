import { createContext } from 'react';
import { User } from 'firebase/auth';
import { UserProfile } from '../types';

export interface AuthContextType {
    user: UserProfile | null;
    firebaseUser: User | null;
    loading: boolean;
    error: Error | null;
    isAdmin: boolean;
    refreshSession: () => Promise<void>;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
