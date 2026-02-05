import React from 'react';
import { Button } from './button';
import { createPortal } from 'react-dom';
import { Lock } from './Icons';
import { useLocale } from '../../hooks/useLocale';

interface LoadingScreenProps {
 message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
 const [showTimeout, setShowTimeout] = React.useState(false);
 const { t } = useLocale();

 React.useEffect(() => {
 const timer = setTimeout(() => {
 setShowTimeout(true);
 }, 10000); // 10 seconds timeout

 return () => clearTimeout(timer);
 }, []);

 if (typeof document === 'undefined') return null;

 return createPortal(
 <div className="fixed inset-0 z-max h-[100dvh] w-screen grid place-items-center bg-background transition-colors overflow-hidden">
 <div className="absolute inset-0 pointer-events-none">
 <div className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] bg-primary/15/20 rounded-full mix-blend-multiply filter blur-[100px] animate-float"></div>
 </div>
 <div className="relative z-10 flex flex-col items-center">
 <div className="w-20 h-20 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl flex items-center justify-center shadow-xl animate-pulse mb-8 border border-border/40">
  <Lock className="h-10 w-10 text-primary" strokeWidth={2.5} />
 </div>
 {!showTimeout ? (
  <div className="flex space-x-2">
  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
  </div>
 ) : (
  <div className="flex flex-col items-center animate-fade-in">
  <p className="text-sm text-muted-foreground mb-4 text-center px-4">
  {message || t('ui.loadingScreen.timeout', { defaultValue: 'Le chargement prend plus de temps que prévu...' })}
  </p>
  <Button
  onClick={() => window.location.reload()}
  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
  >
  {t('ui.loadingScreen.reload', { defaultValue: 'Recharger la page' })}
  </Button>
  </div>
 )}
 </div>
 </div>,
 document.body
 );
};
