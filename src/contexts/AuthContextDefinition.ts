import { createContext } from 'react';
import { User } from 'firebase/auth';
import { UserProfile } from '../types';

export interface AuthContextType {
    user: UserProfile | null;
    firebaseUser: User | null;
    loading: boolean;
    error: Error | null;
    profileError?: Error | null;
    isBlocked?: boolean;
    dismissBlockerError: () => void;
    isAdmin: boolean;
    refreshSession: () => Promise<void>;
    logout: () => Promise<void>;
    enrollMFA: () => Promise<string>; // Returns QR Code URL
    verifyMFA: (verificationId: string, code: string) => Promise<void>;
    unenrollMFA: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
