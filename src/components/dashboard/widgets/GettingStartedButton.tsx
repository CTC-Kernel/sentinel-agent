import React from 'react';
import { Rocket } from '../../ui/Icons';
import { useStore } from '../../../store';

interface GettingStartedButtonProps {
    onShow: () => void;
}

export const GettingStartedButton: React.FC<GettingStartedButtonProps> = ({ onShow }) => {
    const { t } = useStore();

    const handleShow = () => {
        onShow();
    };

    return (
        <button
            onClick={handleShow}
            className="group fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-2xl shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300 border border-brand-400/20 backdrop-blur-sm"
        >
            <div className="p-2 bg-white/20 rounded-xl">
                <Rocket className="h-5 w-5" />
            </div>
            <div className="text-left">
                <div className="font-bold text-sm">{t('dashboard.gettingStarted')}</div>
                <div className="text-xs opacity-90">{t('dashboard.setupProgress')}</div>
            </div>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        </button>
    );
};
