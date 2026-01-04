import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import { ChatMessage } from '../../services/aiService';
import { aiService } from '../../services/aiService';

type FirestoreTimestampLike = { toDate?: () => Date };
type FirestoreMessage = {
  id?: unknown;
  role?: unknown;
  content?: unknown;
  timestamp?: unknown;
  isError?: unknown;
};

export const useAIConversation = (userId: string | undefined, enabled: boolean = true) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Bonjour je suis **Sentinel AI**. \n\nComment puis-je vous aider à sécuriser votre organisation aujourd'hui ?",
      timestamp: new Date()
    }
  ]);

  // Conversation reference (single 'default' conversation per user)
  const conversationRef = useMemo(() => {
    if (!userId || !enabled) return null;
    return doc(db, 'users', userId, 'conversations', 'default');
  }, [userId, enabled]);

  // Load messages from Firestore with real-time updates
  useEffect(() => {
    if (!conversationRef) return;

    const unsubscribe = onSnapshot(
      conversationRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.messages && Array.isArray(data.messages)) {
            // Convert Firestore timestamps to Date objects
            const loadedMessages: ChatMessage[] = data.messages
              .map((m: unknown) => {
                const fm = m as FirestoreMessage;
                const id = typeof fm.id === 'string' ? fm.id : '';
                const role: ChatMessage['role'] = fm.role === 'user' || fm.role === 'assistant' ? fm.role : 'assistant';
                const content = typeof fm.content === 'string' ? fm.content : '';

                const ts = fm.timestamp as FirestoreTimestampLike | string | number | Date | undefined;
                const timestamp =
                  ts && typeof (ts as FirestoreTimestampLike).toDate === 'function'
                    ? (ts as FirestoreTimestampLike).toDate!()
                    : ts instanceof Date
                      ? ts
                      : typeof ts === 'string' || typeof ts === 'number'
                        ? new Date(ts)
                        : new Date();

                const isError = typeof fm.isError === 'boolean' ? fm.isError : undefined;

                return { id, role, content, timestamp, isError };
              })
              .filter((m) => m.id.length > 0 && m.content.length > 0);
            setMessages(loadedMessages);
          }
        } else {
          // Initialize conversation if not exists
          if (userId) {
            aiService.initConversation(userId).catch(e =>
              ErrorLogger.error(e, 'useAIConversation.initConversation')
            );
          }
        }
      },
      (error) => {
        ErrorLogger.error(error, 'useAIConversation.onSnapshot');
      }
    );

    return () => unsubscribe();
  }, [conversationRef, userId]);

  // Add message to Firestore
  const addMessage = async (message: ChatMessage) => {
    if (!conversationRef) {
      throw new Error('No conversation reference available');
    }

    try {
      await updateDoc(conversationRef, {
        messages: arrayUnion(message),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      ErrorLogger.error(error, 'useAIConversation.addMessage');
      throw error;
    }
  };

  return {
    messages,
    conversationRef,
    addMessage
  };
};
