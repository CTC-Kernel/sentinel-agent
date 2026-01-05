import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface LoadingScreenProps {
    message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message: _externalMessage }) => {
    const [lines, setLines] = useState<string[]>([]);
    const [showCursor, setShowCursor] = useState(true);

    // Sequence of messages to display
    useEffect(() => {
        const sequence = [
            { text: ">CHARGEMENT DES MODULES DE SÉCURITÉ...", delay: 100 },
            { text: ">ÉTABLISSEMENT DE LA LIAISON SÉCURISÉE...", delay: 800 },
            { text: ">ACCÈS AUTORISÉ.", delay: 1800 },
        ];

        const timeouts: NodeJS.Timeout[] = [];

        sequence.forEach(({ text, delay }) => {
            const timeout = setTimeout(() => {
                setLines(prev => [...prev, text]);
            }, delay);
            timeouts.push(timeout);
        });

        return () => timeouts.forEach(clearTimeout);
    }, []);

    // Blinking cursor effect
    useEffect(() => {
        const interval = setInterval(() => {
            setShowCursor(prev => !prev);
        }, 500);
        return () => clearInterval(interval);
    }, []);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-max h-[100dvh] w-screen bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-mono text-sm sm:text-base md:text-lg">
            <div className="w-full max-w-2xl px-8 flex flex-col gap-2">
                {lines.map((line, index) => (
                    <div
                        key={index}
                        className={`tracking-wider ${index === 2 ? 'text-emerald-400 font-bold' : 'text-slate-300'
                            }`}
                    >
                        {line}
                    </div>
                ))}

                {/* Always show cursor on a new line or after the last line */}
                <div className="text-emerald-500 h-6">
                    {lines.length > 0 && lines.length < 3 && (
                        <span className="animate-pulse">_</span>
                    )}
                    {lines.length === 3 && (
                        <span className="text-emerald-500">{'>'} <span className={`${showCursor ? 'opacity-100' : 'opacity-0'}`}>_</span></span>
                    )}
                </div>
            </div>

            {/* Subtle background effects for professional feel */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-slate-950 to-slate-950"></div>
            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent opacity-50"></div>
        </div>,
        document.body
    );
};
