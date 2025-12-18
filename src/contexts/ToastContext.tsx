import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertTriangle, AlertOctagon, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type: ToastType) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 5000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            {createPortal(
                <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                    {toasts.map((toast) => (
                        <div
                            key={toast.id}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-in slide-in-from-right fade-in duration-300 ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
                                    toast.type === 'error' ? 'bg-red-50 text-red-900 border-red-200' :
                                        toast.type === 'warning' ? 'bg-amber-50 text-amber-900 border-amber-200' :
                                            'bg-blue-50 text-blue-900 border-blue-200'
                                }`}
                        >
                            {toast.type === 'success' && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                            {toast.type === 'error' && <AlertOctagon className="h-5 w-5 text-red-500" />}
                            {toast.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                            {toast.type === 'info' && <Info className="h-5 w-5 text-blue-500" />}
                            <p className="text-sm font-medium">{toast.message}</p>
                            <button onClick={() => removeToast(toast.id)} className="ml-2 hover:opacity-70">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
};
