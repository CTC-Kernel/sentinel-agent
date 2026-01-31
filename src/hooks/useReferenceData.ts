import { useFirestoreCollection } from './useFirestore';
import { useStore } from '../store';
import { where } from 'firebase/firestore';
import { UserProfile, Control, Risk } from '../types';

export const useReferenceData = () => {
    const { user } = useStore();
    const orgId = user?.organizationId || '';

    // Users (Cached, Non-realtime)
    // Used for dropdowns, assignments, etc.
    const { data: users, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', orgId)],
        { realtime: false, logError: true, enabled: !!user?.organizationId }
    );

    // Controls (Cached, Non-realtime)
    // Used for linking acts, risks, etc.
    const { data: controls, loading: controlsLoading } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', orgId)],
        { realtime: false, logError: true, enabled: !!user?.organizationId }
    );

    // Risks (Cached, Non-realtime)
    // Sometimes needed for reference
    const { data: risks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', orgId)],
        { realtime: false, logError: true, enabled: !!user?.organizationId }
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
