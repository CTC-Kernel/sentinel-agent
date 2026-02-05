import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, enableNetwork, disableNetwork } from 'firebase/firestore';

export const useConnectivity = () => {
 const [isOnline, setIsOnline] = useState(navigator.onLine);
 const [authConnected, setAuthConnected] = useState(true); // Assumed true initially if online
 const [dbConnected, setDbConnected] = useState(true);

 useEffect(() => {
 const handleOnline = () => {
 setIsOnline(true);
 setAuthConnected(true);
 setDbConnected(true);
 // Re-enable firestore network
 try {
 const db = getFirestore();
 enableNetwork(db);
 } catch {
 // Network enable failed, but continue
 }
 };

 const handleOffline = () => {
 setIsOnline(false);
 setAuthConnected(false);
 setDbConnected(false);
 // Disable firestore network (optional, but good for consistent state)
 try {
 const db = getFirestore();
 disableNetwork(db);
 } catch {
 // Network disable failed, but continue
 }
 };

 window.addEventListener('online', handleOnline);
 window.addEventListener('offline', handleOffline);

 // Firebase Auth listener to confirm we can actually talk to auth
 const auth = getAuth();
 const unsubscribe = onAuthStateChanged(auth, () => {
 // If this fires, we have some connection to Auth (or local state is valid)
 // It's a rough proxy for "Auth Service is responsive"
 setAuthConnected(true);
 }, (_error) => {
 setAuthConnected(false);
 });

 return () => {
 window.removeEventListener('online', handleOnline);
 window.removeEventListener('offline', handleOffline);
 unsubscribe();
 };
 }, []);

 return {
 isOnline,
 authStatus: authConnected && isOnline ? 'operational' : 'downtime',
 dbStatus: dbConnected && isOnline ? 'operational' : 'downtime',
 storageStatus: isOnline ? 'operational' : 'downtime', // Proxy via isOnline
 edgeStatus: isOnline ? 'operational' : 'downtime' // Proxy via isOnline
 };
};
