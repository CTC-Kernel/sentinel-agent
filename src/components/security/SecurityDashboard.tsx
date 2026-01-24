/**
 * Tableau de bord de sécurité BMAD
 *
 * Affiche les métriques de sécurité en temps réel:
 * - Anomalies de session
 * - Rate limiting stats
 * - Tentatives d'attaque détectées
 * - Métriques de session
 * - Health check général
 *
 * Usage:
 * <SecurityDashboard /> dans une page admin
 */

import React, { useCallback, useEffect, useState } from 'react';
import { SessionMonitor } from '../../services/sessionMonitoringService';
import { ErrorLogger } from '../../services/errorLogger';
import { Shield, AlertTriangle, Activity, Clock, Users } from '../ui/Icons';

interface SecurityMetrics {
  sessionMetrics: {
    duration: number;
    activityCount: number;
    idleTime: number;
    lastActivity: number;
  } | null;
  anomalies: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    recent: Array<{
      type: string;
      severity: string;
      message: string;
      timestamp: number;
    }>;
  };
  rateLimiting: {
    authRemaining: number;
    apiRemaining: number;
    searchRemaining: number;
  };
  healthScore: number; // 0-100
}

export const SecurityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateHealthScore = useCallback((
    anomalyStats: { critical: number; high: number; medium: number; low: number },
    sessionMetrics: { duration: number; idleTime: number } | null
  ): number => {
    let score = 100;

    // Pénalités pour anomalies
    score -= anomalyStats.critical * 20;
    score -= anomalyStats.high * 10;
    score -= anomalyStats.medium * 5;
    score -= anomalyStats.low * 2;

    // Pénalité pour inactivité prolongée
    if (sessionMetrics && sessionMetrics.idleTime > 15 * 60 * 1000) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }, []);

  const loadMetrics = useCallback(() => {
    try {
      const rawMetrics = SessionMonitor.getMetrics();
      const sessionMetrics = rawMetrics ? {
        duration: rawMetrics.sessionDuration,
        activityCount: rawMetrics.activityCount,
        idleTime: rawMetrics.idleTime,
        lastActivity: rawMetrics.lastActivity
      } : null;

      const anomalies = SessionMonitor.getAnomalies();

      // Compter les anomalies par sévérité
      const anomalyStats = anomalies.reduce((acc, anomaly) => {
        acc.total++;
        acc[anomaly.severity]++;
        return acc;
      }, { total: 0, critical: 0, high: 0, medium: 0, low: 0 });

      // Anomalies récentes (dernières 24h)
      const recentAnomalies = anomalies
        .filter(a => Date.now() - a.timestamp < 24 * 60 * 60 * 1000)
        .slice(0, 10);

      // Calculer le health score
      const healthScore = calculateHealthScore(anomalyStats, sessionMetrics);

      setMetrics({
        sessionMetrics,
        anomalies: {
          ...anomalyStats,
          recent: recentAnomalies
        },
        rateLimiting: {
          authRemaining: 5, // Mock value
          apiRemaining: 100,
          searchRemaining: 30
        },
        healthScore
      });

      setLoading(false);
    } catch (error) {
      ErrorLogger.error(error, 'SecurityDashboard.loadMetrics');
      setLoading(false);
    }
  }, [calculateHealthScore]);

  // Charger les métriques au montage et toutes les 10 secondes
  useEffect(() => {
    // Rafraîchir toutes les 10 secondes
    const interval = setInterval(loadMetrics, 10000);

    return () => clearInterval(interval);
  }, [loadMetrics]);

  // Chargement initial
  useEffect(() => {
    const timer = setTimeout(loadMetrics, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const getHealthColor = (score: number): string => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    if (score >= 50) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Chargement des métriques de sécurité...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Impossible de charger les métriques</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Tableau de Bord Sécurité BMAD
          </h2>
          <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
            Monitoring en temps réel des métriques de sécurité
          </p>
        </div>

        {/* Health Score */}
        <div className={`px-6 py-4 rounded-lg ${getHealthColor(metrics.healthScore)}`}>
          <div className="text-sm font-medium opacity-75">Health Score</div>
          <div className="text-3xl font-bold">{metrics.healthScore}%</div>
        </div>
      </div>

      {/* Cartes de métriques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Session Duration */}
        {metrics.sessionMetrics && (
          <MetricCard
            icon={<Clock className="w-5 h-5" />}
            label="Durée de session"
            value={formatDuration(metrics.sessionMetrics.duration)}
            color="blue"
          />
        )}

        {/* Activity Count */}
        {metrics.sessionMetrics && (
          <MetricCard
            icon={<Activity className="w-5 h-5" />}
            label="Activités"
            value={metrics.sessionMetrics.activityCount.toString()}
            color="green"
          />
        )}

        {/* Anomalies */}
        <MetricCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Anomalies totales"
          value={metrics.anomalies.total.toString()}
          color={metrics.anomalies.critical > 0 ? 'red' : metrics.anomalies.high > 0 ? 'orange' : 'gray'}
          subtitle={metrics.anomalies.critical > 0 ? `${metrics.anomalies.critical} critiques` : undefined}
        />

        {/* Idle Time */}
        {metrics.sessionMetrics && (
          <MetricCard
            icon={<Users className="w-5 h-5" />}
            label="Temps d'inactivité"
            value={formatDuration(metrics.sessionMetrics.idleTime)}
            color={metrics.sessionMetrics.idleTime > 15 * 60 * 1000 ? 'orange' : 'gray'}
          />
        )}
      </div>

      {/* Anomalies Details */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Anomalies Détectées (24h)
        </h3>

        {metrics.anomalies.recent.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            ✅ Aucune anomalie détectée
          </div>
        ) : (
          <div className="space-y-3">
            {metrics.anomalies.recent.map((anomaly, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(anomaly.severity)}`}>
                  {anomaly.severity}
                </span>
                <div className="flex-1">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {anomaly.type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-muted-foreground">
                    {anomaly.message}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {new Date(anomaly.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Info */}
      {metrics.sessionMetrics && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Informations de Session
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-slate-600 dark:text-muted-foreground">Durée totale</div>
              <div className="text-lg font-medium text-slate-900 dark:text-white">
                {formatDuration(metrics.sessionMetrics.duration)}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-600 dark:text-muted-foreground">Dernière activité</div>
              <div className="text-lg font-medium text-slate-900 dark:text-white">
                {new Date(metrics.sessionMetrics.lastActivity).toLocaleTimeString()}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-600 dark:text-muted-foreground">Nombre d'actions</div>
              <div className="text-lg font-medium text-slate-900 dark:text-white">
                {metrics.sessionMetrics.activityCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommandations */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-blue-900 dark:text-blue-100">
          💡 Recommandations
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          {metrics.healthScore < 70 && (
            <li>⚠️ Le score de santé est faible. Vérifiez les anomalies critiques.</li>
          )}
          {metrics.anomalies.critical > 0 && (
            <li>🔴 Anomalies critiques détectées. Contactez votre administrateur.</li>
          )}
          {metrics.sessionMetrics && metrics.sessionMetrics.idleTime > 15 * 60 * 1000 && (
            <li>⏰ Session inactive depuis longtemps. Activité recommandée.</li>
          )}
          {metrics.healthScore >= 90 && (
            <li>✅ Tout est en ordre. Sécurité optimale.</li>
          )}
        </ul>
      </div>
    </div>
  );
};

/**
 * Carte de métrique réutilisable
 */
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'red' | 'orange' | 'gray';
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, color, subtitle }) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    red: 'text-red-600 bg-red-100',
    orange: 'text-orange-600 bg-orange-100',
    gray: 'text-slate-600 bg-slate-100'
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-2 rounded ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="text-sm text-slate-600 dark:text-muted-foreground">{label}</div>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      {subtitle && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</div>
      )}
    </div>
  );
};

/**
 * Widget compact pour afficher dans une sidebar
 */
export const SecurityWidgetCompact: React.FC = () => {
  const [criticalCount, setCriticalCount] = useState(0);

  useEffect(() => {
    const checkAnomalies = () => {
      setCriticalCount(SessionMonitor.getCriticalAnomaliesCount());
    };

    checkAnomalies();
    const interval = setInterval(checkAnomalies, 30000);

    return () => clearInterval(interval);
  }, []);

  if (criticalCount === 0) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <Shield className="w-4 h-4" />
        <span className="text-sm">Sécurité OK</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-red-600">
      <AlertTriangle className="w-4 h-4" />
      <span className="text-sm font-medium">{criticalCount} alerte(s)</span>
    </div>
  );
};
