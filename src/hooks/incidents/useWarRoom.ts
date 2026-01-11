
import { useMemo } from 'react';
import { orderBy, limit, Timestamp } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';

export interface WarRoomMessage {
    id: string;
    content: string;
    sender: string;
    senderId: string;
    role: string;
    timestamp: Timestamp; // Firestore Timestamp
    isSystem: boolean;
}

export const useWarRoom = (incidentId: string) => {
    const { user, demoMode } = useStore();

    // Messages Sub-collection
    const collectionPath = `incidents/${incidentId}/war_room_messages`;

    // Fetch messages in real-time
    const {
        data: rawMessages,
        loading,
        add
    } = useFirestoreCollection<WarRoomMessage>(
        collectionPath,
        [orderBy('timestamp', 'asc'), limit(100)],
        { realtime: true, enabled: !!incidentId && !demoMode }
    );

    const messages = useMemo(() => {
        // If needed, we can process messages here (e.g. format dates)
        return rawMessages.map(msg => ({
            ...msg,
            // Ensure Javascript Date object for UI if it's a Firestore Timestamp
            timestamp: msg.timestamp instanceof Timestamp ? msg.timestamp.toDate() : new Date(msg.timestamp as unknown as string | number | Date)
        }));
    }, [rawMessages]);

    const sendMessage = async (content: string) => {
        if (!user || !incidentId) return;

        try {
            await add({
                content,
                sender: user.displayName || user.email || 'Utilisateur',
                senderId: user.uid,
                role: user.role || 'User',
                timestamp: new Date(), // useFirestoreCollection or Firebase SDK handles Date -> Timestamp conversion usually, or we might need serverTimestamp()
                isSystem: false
            });
        } catch (error) {
            ErrorLogger.error(error, 'useWarRoom.sendMessage');
            throw error;
        }
    };

    return {
        messages,
        loading,
        sendMessage
    };
};
