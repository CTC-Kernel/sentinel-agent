import React, { useEffect, useState } from 'react';
import { Bell, Check } from '../ui/Icons';
import { PushNotificationService } from '../../services/pushNotificationService';

export const NotificationPermissionBanner: React.FC = () => {
 const [show, setShow] = useState(false);
 const [permission, setPermission] = useState<NotificationPermission>(() =>
 typeof Notification !== 'undefined' ? Notification.permission : 'default'
 );

 useEffect(() => {
 // Vérifier si les notifications sont supportées
 if (!PushNotificationService.isSupported()) {
 return;
 }

 // Si déjà accordé, on ne fait rien ici pour éviter l'erreur "user gesture"
 // Le service sera initialisé à la demande ou via un autre flux si nécessaire
 if (permission === 'granted') {
 return;
 }

 // Afficher la bannière si la permission n'a pas été demandée
 if (permission === 'default') {
 // Attendre 3 secondes avant d'afficher pour ne pas être intrusif
 const timer = setTimeout(() => setShow(true), 3000);
 return () => clearTimeout(timer);
 }
 }, [permission]);

 const handleEnable = async () => {
 const granted = await PushNotificationService.initialize();
 if (granted) {
 setPermission('granted');
 setShow(false);
 // Sauvegarder l'état activé pour ne plus afficher
 localStorage.setItem('notification-banner-action', 'granted');

 // Envoyer une notification de test
 await PushNotificationService.sendNotification({
 title: '🎉 Notifications Activées',
 body: 'Vous recevrez maintenant des alertes importantes en temps réel'
 });
 } else {
 setPermission('denied');
 localStorage.setItem('notification-banner-action', 'denied');
 }
 };

 const handleDismiss = () => {
 setShow(false);
 // Sauvegarder dans localStorage pour ne plus afficher
 localStorage.setItem('notification-banner-dismissed', 'true');
 };

 if (!show || permission !== 'default') {
 return null;
 }

 // Ne pas afficher si déjà géré (activé, refusé ou ignoré)
 if (localStorage.getItem('notification-banner-dismissed') || localStorage.getItem('notification-banner-action')) {
 return null;
 }

 return (
 <div className="fixed bottom-6 right-6 z-toast max-w-md animate-slide-up">
 <div className="glass-premium rounded-2xl shadow-2xl border border-border/40 p-6">
 <div className="flex items-start gap-4">
  <div className="p-3 bg-primary/10 dark:bg-primary rounded-3xl">
  <Bell className="h-6 w-6 text-primary" />
  </div>

  <div className="flex-1">
  <h3 className="text-lg font-bold text-foreground mb-1">
  Activer les Notifications
  </h3>
  <p className="text-sm text-muted-foreground mb-4">
  Recevez des alertes en temps réel pour les incidents critiques, audits imminents et risques non traités.
  </p>

  <div className="flex gap-3">
  <button
  onClick={handleEnable}
  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-3xl text-sm font-bold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 "
  >
  <Check className="h-4 w-4" />
  Activer
  </button>

  <button
  onClick={handleDismiss}
  className="px-4 py-2 bg-muted text-foreground rounded-3xl text-sm font-bold hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
  >
  Plus tard
  </button>
  </div>
  </div>
 </div>
 </div>
 </div>
 );
};
