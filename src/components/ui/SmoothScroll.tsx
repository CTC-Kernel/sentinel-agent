import React from 'react';

interface SmoothScrollProps {
    children: React.ReactNode;
    className?: string;
    id?: string;
    enabled?: boolean;
}

export const SmoothScroll: React.FC<SmoothScrollProps> = ({ children, className, id, enabled = true }) => {
    return (
        <main id={id} className={`flex flex-col ${className || ''}`}>
            <div className={`w-full flex flex-col flex-1 ${enabled ? 'min-h-full' : 'h-full'}`}>
                {children}
            </div>
        </main>
    );
};
