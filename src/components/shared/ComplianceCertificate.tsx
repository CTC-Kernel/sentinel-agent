import React from 'react';
import { Award, ShieldCheck, Download, Calendar } from '../ui/Icons';
import { MasterpieceBackground } from '../ui/MasterpieceBackground';

interface ComplianceCertificateProps {
    type: string;
    score: number;
    issueDate?: Date;
    recipientName: string;
}

export const ComplianceCertificate: React.FC<ComplianceCertificateProps> = ({
    type = "ISO 27001",
    score = 0,
    issueDate = new Date(),
    recipientName
}) => {
    return (
        <div className="max-w-2xl mx-auto my-8 relative">
            {/* Certificate Frame */}
            <div className="bg-white text-slate-900 border-[10px] border-double border-slate-200 p-8 shadow-2xl relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                    <MasterpieceBackground />
                </div>

                {/* Corner Decoration */}
                <div className="absolute top-0 right-0 p-4">
                    <Award className="h-16 w-16 text-brand-500 opacity-20" />
                </div>

                <div className="text-center space-y-6 relative z-10">
                    <div className="flex justify-center mb-4">
                        <div className="h-20 w-20 rounded-full bg-brand-50 flex items-center justify-center border-4 border-brand-100">
                            <ShieldCheck className="h-10 w-10 text-brand-600" />
                        </div>
                    </div>

                    <div>
                        <h2 className="text-3xl font-serif font-bold text-slate-800 tracking-wide mb-1">CERTIFICAT DE CONFORMITÉ</h2>
                        <p className="text-brand-600 font-bold uppercase tracking-widest text-sm">Sentinel GRC Platform</p>
                    </div>

                    <div className="py-6 border-t border-b border-slate-100">
                        <p className="text-slate-500 italic mb-4">Ce document certifie que</p>
                        <h3 className="text-2xl font-bold text-slate-900 mb-4">{recipientName}</h3>
                        <p className="text-slate-500 italic mb-2">a atteint un score de conformité de</p>
                        <div className="inline-block px-6 py-2 bg-slate-900 text-white rounded-full font-mono text-xl font-bold">
                            {score}%
                        </div>
                        <p className="text-slate-500 italic mt-4">pour le référentiel <span className="font-bold text-slate-700 not-italic">{type}</span></p>
                    </div>

                    <div className="flex justify-between items-end pt-8 px-8">
                        <div className="text-left">
                            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Délivré le</p>
                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                <Calendar className="h-4 w-4" />
                                {issueDate.toLocaleDateString()}
                            </div>
                        </div>

                        <div className="text-right">
                            <div className="h-12 w-32 border-b border-slate-300 mb-1 flex items-end justify-end pb-1">
                                <span className="font-dancing text-xl text-slate-600">Sentinel System</span>
                            </div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider">Signature</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-center gap-4">
                <button className="flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg shadow-brand-500/20 font-bold transition-all hover:-translate-y-1">
                    <Download className="h-5 w-5" />
                    Télécharger PDF
                </button>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');
                .font-dancing { font-family: 'Dancing Script', cursive; }
            `}</style>
        </div>
    );
};
