
import { useState, useMemo, useCallback, useEffect } from 'react';
import { orderBy, limit, Timestamp, serverTimestamp, onSnapshot, collection, addDoc, query, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { db } from '../../firebase';
import { sanitizeData } from '../../utils/dataSanitizer';

export interface WarRoomMessage {
    id: string;
    content: string;
    sender: string;
    senderId: string;
    role: string;
    timestamp: Timestamp | Date;
    isSystem: boolean;
    attachments?: { name: string; url: string; type: string }[];
}

export interface WarRoomPresence {
    id: string;
    displayName: string;
    photoURL?: string;
    role: string;
    joinedAt: Date;
    lastActive: Date;
}

// Demo mode mock messages
const getInitialDemoMessages = (): (WarRoomMessage & { id: string })[] => [
    {
        id: 'demo-msg-1',
        content: 'War Room activé. Canal sécurisé établi.',
        sender: 'Système',
        senderId: 'system',
        role: 'System',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        isSystem: true
    },
    {
        id: 'demo-msg-2',
        content: 'J\'analyse les logs du pare-feu. Plusieurs tentatives d\'intrusion détectées depuis 192.168.1.100.',
        sender: 'Sophie Martin',
        senderId: 'user-2',
        role: 'RSSI',
        timestamp: new Date(Date.now() - 1000 * 60 * 3),
        isSystem: false
    },
    {
        id: 'demo-msg-3',
        content: 'IP bloquée. Je prépare le rapport d\'incident pour la direction.',
        sender: 'Thomas Dubois',
        senderId: 'user-3',
        role: 'Analyste',
        timestamp: new Date(Date.now() - 1000 * 60 * 1),
        isSystem: false
    }
];

export const useWarRoom = (incidentId: string) => {
    const { user, demoMode } = useStore();

    // Demo mode local state
    const [demoMessages, setDemoMessages] = useState<(WarRoomMessage & { id: string })[]>(() =>
        getInitialDemoMessages()
    );
    const [demoLoading, setDemoLoading] = useState(false);

    // Presence state
    const [presence, setPresence] = useState<WarRoomPresence[]>([]);

    // Messages Sub-collection
    const collectionPath = `incidents/${incidentId}/war_room_messages`;
    const presencePath = `incidents/${incidentId}/war_room_presence`;

    // Fetch messages in real-time (only when not in demo mode)
    const {
        data: rawMessages,
        loading: firestoreLoading,
        add
    } = useFirestoreCollection<WarRoomMessage>(
        collectionPath,
        [orderBy('timestamp', 'asc'), limit(100)],
        { realtime: true, enabled: !!incidentId && !demoMode }
    );

    // Real-time presence tracking (only when not in demo mode)
    useEffect(() => {
        if (demoMode || !incidentId || !user) return;

        // Register presence
        const presenceRef = doc(db, presencePath, user.uid);
        const presenceData = {
            displayName: user.displayName || user.email || 'Utilisateur',
            photoURL: user.photoURL || null,
            role: user.role || 'user',
            joinedAt: serverTimestamp(),
            lastActive: serverTimestamp()
        };

        setDoc(presenceRef, sanitizeData(presenceData)).catch(err =>
            ErrorLogger.warn('Failed to set presence', 'useWarRoom.presence', { metadata: { error: err } })
        );

        // Update last active every 30 seconds
        const heartbeatInterval = setInterval(() => {
            setDoc(presenceRef, sanitizeData({ lastActive: serverTimestamp() }), { merge: true }).catch((err) => ErrorLogger.debug(err, 'useWarRoom'));
        }, 30000);

        // Listen to presence changes
        const presenceQuery = query(collection(db, presencePath));
        const unsubscribe = onSnapshot(presenceQuery, (snapshot) => {
            const users = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                joinedAt: d.data().joinedAt?.toDate() || new Date(),
                lastActive: d.data().lastActive?.toDate() || new Date()
            })) as WarRoomPresence[];

            // Filter out stale presence (more than 2 minutes inactive)
            const activeUsers = users.filter(u =>
                Date.now() - u.lastActive.getTime() < 120000
            );
            setPresence(activeUsers);
        }, (err) => {
            ErrorLogger.warn('Presence listener error', 'useWarRoom.presence', { metadata: { error: err } });
        });

        // Cleanup on unmount with delayed deletion to handle React StrictMode
        // double-mount and fast remounts. The 2-second delay allows a remount
        // to re-establish presence before the old cleanup deletes it.
        return () => {
            clearInterval(heartbeatInterval);
            unsubscribe();
            setTimeout(() => {
                deleteDoc(presenceRef).catch((err) => ErrorLogger.debug(err, 'useWarRoom'));
            }, 2000);
        };
    }, [incidentId, demoMode, user, presencePath]);

    // Demo mode presence
    useEffect(() => {
        if (!demoMode || !user) return;

        const demoPresence: WarRoomPresence[] = [
            {
                id: user.uid || 'demo-user',
                displayName: user.displayName || 'Demo User',
                photoURL: user.photoURL || undefined,
                role: user.role || 'admin',
                joinedAt: new Date(),
                lastActive: new Date()
            },
            {
                id: 'user-2',
                displayName: 'Sophie Martin',
                photoURL: 'https://i.pravatar.cc/150?u=sophie',
                role: 'rssi',
                joinedAt: new Date(Date.now() - 1000 * 60 * 10),
                lastActive: new Date()
            }
        ];

        const timer = setTimeout(() => {
            setPresence(demoPresence);
        }, 0);

        return () => clearTimeout(timer);
    }, [demoMode, user]);

    const messages = useMemo(() => {
        if (demoMode) {
            return demoMessages.map(msg => ({
                ...msg,
                timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp as unknown as string | number)
            }));
        }

        return rawMessages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp instanceof Timestamp ? msg.timestamp.toDate() : new Date(msg.timestamp as unknown as string | number | Date)
        }));
    }, [demoMode, demoMessages, rawMessages]);

    const loading = demoMode ? demoLoading : firestoreLoading;

    const sendMessage = useCallback(async (content: string, attachments?: { name: string; url: string; type: string }[]) => {
        if (!user || !incidentId) return;

        const newMessage: Omit<WarRoomMessage, 'id'> = {
            content,
            sender: user.displayName || user.email || 'Utilisateur',
            senderId: user.uid,
            role: user.role || 'User',
            timestamp: new Date(),
            isSystem: false,
            attachments: attachments || []
        };

        if (demoMode) {
            // Demo mode: add to local state
            setDemoLoading(true);
            await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay

            const messageWithId = {
                ...newMessage,
                id: `demo-msg-${Date.now()}`
            };
            setDemoMessages(prev => [...prev, messageWithId]);
            setDemoLoading(false);
            return;
        }

        try {
            await add(sanitizeData({
                ...newMessage,
                timestamp: serverTimestamp()
            }));
        } catch (error) {
            ErrorLogger.error(error, 'useWarRoom.sendMessage');
            throw error;
        }
    }, [user, incidentId, demoMode, add]);

    const sendSystemMessage = useCallback(async (content: string) => {
        if (!incidentId) return;

        const systemMessage: Omit<WarRoomMessage, 'id'> = {
            content,
            sender: 'Système',
            senderId: 'system',
            role: 'System',
            timestamp: new Date(),
            isSystem: true
        };

        if (demoMode) {
            const messageWithId = {
                ...systemMessage,
                id: `demo-sys-${Date.now()}`
            };
            setDemoMessages(prev => [...prev, messageWithId]);
            return;
        }

        try {
            await addDoc(collection(db, collectionPath), sanitizeData({
                ...systemMessage,
                timestamp: serverTimestamp()
            }));
        } catch (error) {
            ErrorLogger.error(error, 'useWarRoom.sendSystemMessage');
        }
    }, [incidentId, demoMode, collectionPath]);

    return {
        messages,
        loading,
        sendMessage,
        sendSystemMessage,
        presence
    };
};
