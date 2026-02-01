import { useFirestoreCollection } from './useFirestore';
import { useStore } from '../store';
import { where } from 'firebase/firestore';
import { UserProfile, Control, Risk } from '../types';

export const useReferenceData = () => {
    const { user } = useStore();
    const orgId = user?.organizationId;

    // Users (Cached, Non-realtime)
    // Used for dropdowns, assignments, etc.
    const { data: users, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        orgId ? [where('organizationId', '==', orgId)] : [],
        { realtime: false, logError: true, enabled: !!orgId }
    );

    // Controls (Cached, Non-realtime)
    // Used for linking acts, risks, etc.
    const { data: controls, loading: controlsLoading } = useFirestoreCollection<Control>(
        'controls',
        orgId ? [where('organizationId', '==', orgId)] : [],
        { realtime: false, logError: true, enabled: !!orgId }
    );

    // Risks (Cached, Non-realtime)
    // Sometimes needed for reference
    const { data: risks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks',
        orgId ? [where('organizationId', '==', orgId)] : [],
        { realtime: false, logError: true, enabled: !!orgId }
    );

    return {
        users,
        usersLoading,
        controls,
        controlsLoading,
        risks,
        risksLoading
    };
};
