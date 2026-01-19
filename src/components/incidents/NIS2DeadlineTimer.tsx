import React, { useEffect, useState } from 'react';
import { Incident } from '../../types';
import { getIncidentDeadlines, DeadlineStatus } from '../../utils/nis2Utils';
import { Clock, AlertTriangle, CheckCircle, AlertCircle } from '../ui/Icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
    incident: Incident;
    compact?: boolean;
}

export const NIS2DeadlineTimer: React.FC<Props> = ({ incident, compact = false }) => {
    const [deadlines, setDeadlines] = useState(getIncidentDeadlines(incident));

    useEffect(() => {
        const interval = setInterval(() => {
            setDeadlines(getIncidentDeadlines(incident));
        }, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [incident]);

    if (!incident.isSignificant) return null;

    if (compact) {
        // Find most urgent pending deadline
        const urgent = deadlines.find(d => !d.isCompleted && d.status !== DeadlineStatus.OK) || deadlines.find(d => !d.isCompleted);

        if (!urgent) return (
            <div className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                <CheckCircle className="w-3 h-3" />
                <span>NIS2 OK</span>
            </div>
        );

        const colorClass = urgent.status === DeadlineStatus.OVERDUE ? 'text-red-600 bg-red-50' :
            urgent.status === DeadlineStatus.WARNING ? 'text-orange-600 bg-orange-50' :
                'text-blue-600 bg-blue-50';

        return (
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${colorClass}`} title={urgent.label}>
                <Clock className="w-3 h-3" />
                <span>{urgent.remainingHours > 0 ? `${urgent.remainingHours}h` : 'Retard'}</span>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {deadlines.map((d, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${d.isCompleted ? 'bg-slate-50 border-slate-200 text-slate-500' :
                        d.status === DeadlineStatus.OVERDUE ? 'bg-red-50 border-red-200 text-red-700' :
                            d.status === DeadlineStatus.WARNING ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                'bg-blue-50 border-blue-200 text-blue-700'
                    }`}>
                    <div className="flex items-center gap-3">
                        {d.isCompleted ? <CheckCircle className="w-5 h-5" /> :
                            d.status === DeadlineStatus.OVERDUE ? <AlertCircle className="w-5 h-5" /> :
                                d.status === DeadlineStatus.WARNING ? <AlertTriangle className="w-5 h-5" /> :
                                    <Clock className="w-5 h-5" />}

                        <div>
                            <p className="text-sm font-semibold">{d.label}</p>
                            <p className="text-xs opacity-80">
                                {d.isCompleted ? 'Notifié' : `Échéance : ${format(d.deadlineDate, 'dd/MM HH:mm', { locale: fr })}`}
                            </p>
                        </div>
                    </div>

                    {!d.isCompleted && (
                        <div className="text-right">
                            <span className="text-lg font-bold">
                                {d.remainingHours > 0 ? `${d.remainingHours}h` : 'EXPIRÉ'}
                            </span>
                            {d.remainingHours > 0 && <p className="text-[10px] uppercase">Restant</p>}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
