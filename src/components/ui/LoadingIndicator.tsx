import React from 'react';
import { motion } from 'framer-motion';
import { Spinner } from './Spinner';

interface LoadingIndicatorProps {
    message?: string;
    className?: string;
    type?: 'spinner' | 'pulse' | 'bar';
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
    message,
    className = '',
    type = 'spinner'
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-12 transition-all duration-500 animate-in fade-in zoom-in-95 ${className}`}>
            <div className="relative">
                {type === 'spinner' && (
                    <>
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                        <Spinner size="lg" className="text-brand-500 relative z-10" />
                    </>
                )}

                {type === 'pulse' && (
                    <div className="flex gap-1.5 items-center">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1, ease: "easeInOut", delay: 0 }}
                            className="w-2.5 h-2.5 bg-brand-500 rounded-full shadow-[0_0_8px_rgba(var(--brand-500-rgb),0.5)]"
                        />
                        <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1, ease: "easeInOut", delay: 0.2 }}
                            className="w-2.5 h-2.5 bg-brand-500 rounded-full shadow-[0_0_8px_rgba(var(--brand-500-rgb),0.5)]"
                        />
                        <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1, ease: "easeInOut", delay: 0.4 }}
                            className="w-2.5 h-2.5 bg-brand-500 rounded-full shadow-[0_0_8px_rgba(var(--brand-500-rgb),0.5)]"
                        />
                    </div>
                )}

                {type === 'bar' && (
                    <div className="w-48 h-1 bg-muted rounded-full overflow-hidden relative">
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: '100%' }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-brand-500 to-transparent shadow-[0_0_8px_rgba(var(--brand-500-rgb),0.5)]"
                        />
                    </div>
                )}
            </div>

            {message && (
                <motion.p
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 text-sm font-medium text-muted-foreground tracking-wide uppercase"
                >
                    {message}
                </motion.p>
            )}
        </div>
    );
};
