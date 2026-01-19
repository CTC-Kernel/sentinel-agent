/**
 * EBIOS Analysis Detail View
 * Detail page with wizard for managing a specific EBIOS RM analysis
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { useAutoSave } from '../hooks/useAutoSave';
import { Spinner } from '../components/ui/Spinner';
import { EbiosWizard } from '../components/ebios/EbiosWizard';
import { Workshop1Content } from '../components/ebios/workshops/Workshop1Content';
import { Workshop2Content } from '../components/ebios/workshops/Workshop2Content';
import { Workshop3Content } from '../components/ebios/workshops/Workshop3Content';
import { Workshop4Content } from '../components/ebios/workshops/Workshop4Content';
import { Workshop5Content } from '../components/ebios/workshops/Workshop5Content';
import { EbiosService } from '../services/ebiosService';
import { ErrorLogger } from '../services/errorLogger';
import { toast } from '@/lib/toast';
import type {
  EbiosAnalysis,
  EbiosWorkshopNumber,
  Workshop1Data,
  Workshop2Data,
  Workshop3Data,
  Workshop4Data,
  Workshop5Data,
} from '../types/ebios';

export const EbiosAnalysisDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useStore();
  const { user } = useAuth();
  const organizationId = user?.organizationId;
  const navigate = useNavigate();

  // State
  const [analysis, setAnalysis] = useState<EbiosAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track changes for auto-save
  type WorkshopDataType = Workshop1Data | Workshop2Data | Workshop3Data | Workshop4Data | Workshop5Data;
  const [pendingChanges, setPendingChanges] = useState<{
    workshopNumber: EbiosWorkshopNumber;
    data: Partial<WorkshopDataType>;
  } | null>(null);

  // Fetch analysis
  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!organizationId || !id) return;

      try {
        setLoading(true);
        const data = await EbiosService.getAnalysis(organizationId, id);
        if (data) {
          setAnalysis(data);
        } else {
          toast.error(t('ebios.errors.notFound'));
          navigate('/ebios');
        }
      } catch (error) {
        ErrorLogger.error(error, 'EbiosAnalysisDetail.fetchAnalysis');
        toast.error(t('ebios.errors.fetchFailed'));
        navigate('/ebios');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [organizationId, id, t, navigate]);

  // Auto-save functionality
  const saveChanges = useCallback(async () => {
    if (!pendingChanges || !analysis || !organizationId || !user?.uid) return;

    try {
      setSaving(true);
      await EbiosService.saveWorkshopData(
        organizationId,
        analysis.id,
        pendingChanges.workshopNumber,
        pendingChanges.data,
        user.uid
      );
      setHasUnsavedChanges(false);
      setPendingChanges(null);
    } catch (error) {
      ErrorLogger.error(error, 'EbiosAnalysisDetail.saveChanges');
      toast.error(t('ebios.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [pendingChanges, analysis, organizationId, user?.uid, t]);

  // Use auto-save hook
  useAutoSave({
    data: pendingChanges,
    onSave: saveChanges,
    enabled: hasUnsavedChanges,
    debounceMs: 2000,
  });

  // Workshop change handler
  const handleWorkshopChange = useCallback(async (workshopNumber: EbiosWorkshopNumber) => {
    if (!analysis || !organizationId || !user?.uid) return;

    // Save any pending changes first
    if (hasUnsavedChanges && pendingChanges) {
      await saveChanges();
    }

    try {
      await EbiosService.navigateToWorkshop(
        organizationId,
        analysis.id,
        workshopNumber,
        user.uid
      );
      setAnalysis((prev) => prev ? { ...prev, currentWorkshop: workshopNumber } : null);
    } catch (error) {
      ErrorLogger.error(error, 'EbiosAnalysisDetail.handleWorkshopChange');
      toast.error(t('ebios.errors.workshopChangeFailed'));
    }
  }, [analysis, organizationId, user?.uid, hasUnsavedChanges, pendingChanges, saveChanges, t]);

  // Workshop data change handlers
  const handleWorkshop1DataChange = useCallback((data: Partial<Workshop1Data>) => {
    if (!analysis) return;

    const updatedWorkshop1 = {
      ...analysis.workshops[1],
      data: {
        ...analysis.workshops[1].data,
        ...data,
        scope: data.scope
          ? { ...analysis.workshops[1].data.scope, ...data.scope }
          : analysis.workshops[1].data.scope,
      },
    };

    setAnalysis((prev) => prev ? {
      ...prev,
      workshops: {
        ...prev.workshops,
        1: updatedWorkshop1,
      },
    } : null);

    setPendingChanges({
      workshopNumber: 1,
      data: updatedWorkshop1.data,
    });
    setHasUnsavedChanges(true);
  }, [analysis]);

  const handleWorkshop2DataChange = useCallback((data: Partial<Workshop2Data>) => {
    if (!analysis) return;

    const updatedWorkshop2 = {
      ...analysis.workshops[2],
      data: {
        ...analysis.workshops[2].data,
        ...data,
      },
    };

    setAnalysis((prev) => prev ? {
      ...prev,
      workshops: {
        ...prev.workshops,
        2: updatedWorkshop2,
      },
    } : null);

    setPendingChanges({
      workshopNumber: 2,
      data: updatedWorkshop2.data,
    });
    setHasUnsavedChanges(true);
  }, [analysis]);

  const handleWorkshop3DataChange = useCallback((data: Partial<Workshop3Data>) => {
    if (!analysis) return;

    const updatedWorkshop3 = {
      ...analysis.workshops[3],
      data: {
        ...analysis.workshops[3].data,
        ...data,
      },
    };

    setAnalysis((prev) => prev ? {
      ...prev,
      workshops: {
        ...prev.workshops,
        3: updatedWorkshop3,
      },
    } : null);

    setPendingChanges({
      workshopNumber: 3,
      data: updatedWorkshop3.data,
    });
    setHasUnsavedChanges(true);
  }, [analysis]);

  const handleWorkshop4DataChange = useCallback((data: Partial<Workshop4Data>) => {
    if (!analysis) return;

    const updatedWorkshop4 = {
      ...analysis.workshops[4],
      data: {
        ...analysis.workshops[4].data,
        ...data,
      },
    };

    setAnalysis((prev) => prev ? {
      ...prev,
      workshops: {
        ...prev.workshops,
        4: updatedWorkshop4,
      },
    } : null);

    setPendingChanges({
      workshopNumber: 4,
      data: updatedWorkshop4.data,
    });
    setHasUnsavedChanges(true);
  }, [analysis]);

  const handleWorkshop5DataChange = useCallback((data: Partial<Workshop5Data>) => {
    if (!analysis) return;

    const updatedWorkshop5 = {
      ...analysis.workshops[5],
      data: {
        ...analysis.workshops[5].data,
        ...data,
      },
    };

    setAnalysis((prev) => prev ? {
      ...prev,
      workshops: {
        ...prev.workshops,
        5: updatedWorkshop5,
      },
    } : null);

    setPendingChanges({
      workshopNumber: 5,
      data: updatedWorkshop5.data,
    });
    setHasUnsavedChanges(true);
  }, [analysis]);

  // Manual save handler
  const handleManualSave = useCallback(async () => {
    await saveChanges();
    toast.success(t('common.saved'));
  }, [saveChanges, t]);

  // Complete analysis handler
  const handleCompleteAnalysis = useCallback(async () => {
    if (!analysis || !organizationId || !user?.uid) return;

    try {
      await EbiosService.updateAnalysis(
        organizationId,
        analysis.id,
        { status: 'completed' },
        user.uid
      );
      toast.success(t('ebios.analysisCompleted'));
      navigate('/ebios');
    } catch (error) {
      ErrorLogger.error(error, 'EbiosAnalysisDetail.handleCompleteAnalysis');
      toast.error(t('ebios.errors.completeFailed'));
    }
  }, [analysis, organizationId, user?.uid, t, navigate]);

  // Render workshop content based on current workshop
  const renderWorkshopContent = useMemo(() => {
    if (!analysis) return null;

    switch (analysis.currentWorkshop) {
      case 1:
        return (
          <Workshop1Content
            data={analysis.workshops[1].data}
            onDataChange={handleWorkshop1DataChange}
          />
        );
      case 2:
        return (
          <Workshop2Content
            data={analysis.workshops[2].data}
            onDataChange={handleWorkshop2DataChange}
          />
        );
      case 3:
        return (
          <Workshop3Content
            data={analysis.workshops[3].data}
            workshop1Data={analysis.workshops[1].data}
            workshop2Data={analysis.workshops[2].data}
            onDataChange={handleWorkshop3DataChange}
          />
        );
      case 4:
        return (
          <Workshop4Content
            data={analysis.workshops[4].data}
            workshop3Data={analysis.workshops[3].data}
            onDataChange={handleWorkshop4DataChange}
          />
        );
      case 5:
        return (
          <Workshop5Content
            data={analysis.workshops[5].data}
            workshop4Data={analysis.workshops[4].data}
            workshop3Data={analysis.workshops[3].data}
            onDataChange={handleWorkshop5DataChange}
          />
        );
      default:
        return null;
    }
  }, [
    analysis,
    handleWorkshop1DataChange,
    handleWorkshop2DataChange,
    handleWorkshop3DataChange,
    handleWorkshop4DataChange,
    handleWorkshop5DataChange,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <EbiosWizard
      analysis={analysis}
      onWorkshopChange={handleWorkshopChange}
      onSave={handleManualSave}
      onComplete={analysis.currentWorkshop === 5 ? handleCompleteAnalysis : undefined}
      isSaving={saving}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      {renderWorkshopContent}
    </EbiosWizard>
  );
};

export default EbiosAnalysisDetail;
