import React, { useMemo } from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Risk } from '../../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../../store';
import { Loader2 } from 'lucide-react';

interface RiskHeatmapWidgetProps {
    navigate?: (path: string) => void;
    t?: (key: string) => string;
}

export const RiskHeatmapWidget: React.FC<RiskHeatmapWidgetProps> = ({ navigate, t = (k) => k }) => {
    const { user } = useStore();

    // Fetch risks directly within the widget
    const { data: risks, loading } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const matrixData = useMemo(() => {
        const matrix = Array(5).fill(0).map(() => Array(5).fill(0));
        risks.forEach(risk => {
            const p = Math.min(Math.max(risk.residualProbability || risk.probability || 1, 1), 5) - 1;
            const i = Math.min(Math.max(risk.residualImpact || risk.impact || 1, 1), 5) - 1;
            matrix[4 - p][i]++; // Invert Y axis for visualization (5 top)
        });
        return matrix;
    }, [risks]);

    const getCellColor = (p: number, i: number) => {
        const score = (5 - p) * (i + 1); // 5-p because row 0 is probability 5
        if (score >= 15) return 'bg-red-500/90 text-white';
        if (score >= 8) return 'bg-orange-500/90 text-white';
        if (score >= 4) return 'bg-yellow-500/90 text-white';
        return 'bg-emerald-500/90 text-white';
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center min-h-[300px]">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="glass-panel h-full flex flex-col p-4 border border-glass-border rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
            <div className="relative z-10 h-full flex flex-col">
                <h3 className="text-lg font-bold mb-4">{t('dashboard.riskHeatmap')}</h3>

                <div className="flex-1 flex flex-col justify-center items-center relative gap-2">
                    <div className="grid grid-cols-[auto_1fr] gap-4 w-full h-full max-w-[400px] aspect-square">
                        {/* Y Axis Label */}
                        <div className="flex items-center justify-center -rotate-90 w-6">
                            <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">{t('risks.probability')}</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            {/* Matrix */}
                            <div className="flex-1 grid grid-cols-5 gap-1">
                                {matrixData.map((row, rowIndex) => (
                                    <React.Fragment key={rowIndex}>
                                        {row.map((count, colIndex) => (
                                            <div
                                                key={`${rowIndex}-${colIndex}`}
                                                className={`rounded-md flex items-center justify-center text-xs font-bold transition-transform hover:scale-105 cursor-pointer ${getCellColor(rowIndex, colIndex)} ${count === 0 ? 'opacity-30' : 'shadow-sm'}`}
                                                onClick={() => navigate && navigate('/risks')}
                                                title={`Prob: ${5 - rowIndex}, Impact: ${colIndex + 1}`}
                                            >
                                                {count > 0 && count}
                                            </div>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </div>

                            {/* X Axis Label */}
                            <div className="h-6 flex items-center justify-center">
                                <span className="text-xs font-bold text-muted-foreground">{t('risks.impact')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
