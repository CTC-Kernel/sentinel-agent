import { useState, useEffect } from 'react';
import { ErrorLogger } from '../services/errorLogger';

/**
 * A hook that syncs state with localStorage.
 * @param key The localStorage key
 * @param initialValue The initial value if no value is found in localStorage
 * @returns [value, setValue]
 */
export function usePersistedState<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
 // Initialize state from localStorage or initialValue
 const [state, setState] = useState<T>(() => {
 try {
 const item = localStorage.getItem(key);
 return item ? JSON.parse(item) : initialValue;
 } catch (error) {
 ErrorLogger.warn(`Error reading localStorage key "${key}":`, 'usePersistedState', { metadata: { error } });
 return initialValue;
 }
 });

 // Update localStorage whenever state changes
 useEffect(() => {
 try {
 localStorage.setItem(key, JSON.stringify(state));
 } catch (error) {
 ErrorLogger.warn(`Error writing localStorage key "${key}":`, 'usePersistedState', { metadata: { error } });
 }
 }, [key, state]);

 return [state, setState];
}
