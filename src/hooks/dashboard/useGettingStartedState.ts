
import { useState, useEffect } from 'react';
import { ErrorLogger } from '../../services/errorLogger';

type WidgetState = 'expanded' | 'retracted' | 'closed';

export const useGettingStartedState = (userId: string | undefined) => {
 const storageKey = `getting-started-widget-${userId}`;

 // Initialize state
 const [state, setState] = useState<WidgetState>(() => {
 // Default to expanded until we know the user
 if (!userId) return 'expanded';
 try {
 const saved = localStorage.getItem(storageKey);
 return saved ? (JSON.parse(saved) as WidgetState) : 'expanded';
 } catch {
 return 'expanded';
 }
 });

 const [lastUserId, setLastUserId] = useState(userId);

 // Handle user change - update state immediately to prevent cascading renders
 if (userId !== lastUserId) {
 setLastUserId(userId);
 if (userId) {
 try {
 const saved = localStorage.getItem(storageKey);
 if (saved) {
  setState(JSON.parse(saved) as WidgetState);
 } else {
  setState('expanded');
 }
 } catch (error) {
 ErrorLogger.warn('Failed to read widget state', 'useGettingStartedState', { metadata: { error } });
 setState('expanded');
 }
 }
 }

 // Effect to write to storage when state changes
 useEffect(() => {
 if (!userId) return;
 try {
 localStorage.setItem(storageKey, JSON.stringify(state));
 } catch (error) {
 ErrorLogger.warn('Failed to save widget state', 'useGettingStartedState', { metadata: { error } });
 }
 }, [state, userId, storageKey]);

 return [state, setState] as const;
};
