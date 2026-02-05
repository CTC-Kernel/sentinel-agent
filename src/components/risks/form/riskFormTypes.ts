/**
 * Shared types for RiskForm sub-components
 * Extracted from RiskForm.tsx for reusability
 */

import { Risk, Control, Asset, UserProfile, BusinessProcess, Supplier } from '../../../types';
import { RiskFormData } from '../../../schemas/riskSchema';
import { Control as RHFControl, UseFormSetValue, UseFormGetValues, FieldErrors } from 'react-hook-form';

export interface RiskFormTabProps {
 control: RHFControl<RiskFormData>;
 errors: FieldErrors<RiskFormData>;
 readOnly?: boolean;
}

export interface RiskFormContextTabProps extends RiskFormTabProps {
 assets: Asset[];
 usersList: UserProfile[];
 processes: BusinessProcess[];
 suppliers: Supplier[];
 framework: string;
 setValue: UseFormSetValue<RiskFormData>;
}

export interface RiskFormIdentificationTabProps extends RiskFormTabProps {
 assets: Asset[];
 getValues: UseFormGetValues<RiskFormData>;
 setValue: UseFormSetValue<RiskFormData>;
 showLibraryModal: boolean;
 setShowLibraryModal: (show: boolean) => void;
}

export interface RiskFormAssessmentTabProps extends RiskFormTabProps {
 probability: number;
 impact: number;
 residualProbability: number;
 residualImpact: number;
 setValue: UseFormSetValue<RiskFormData>;
}

export interface RiskFormTreatmentTabProps extends RiskFormTabProps {
 existingRisk?: Risk | null;
 controls: Control[];
 usersList: UserProfile[];
 getValues: UseFormGetValues<RiskFormData>;
 setValue: UseFormSetValue<RiskFormData>;
 strategy: string;
 probability: number;
 impact: number;
 mitigationControlIds: string[];
 suggestedControlIds: string[];
}
