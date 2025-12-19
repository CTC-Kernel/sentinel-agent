// ReactNode removed as it was unused

export interface TourStep {
    id: string;
    target: string; // CSS Selector
    title: string;
    description: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    onNext?: () => void;
    onPrev?: () => void;
}

export interface OnboardingState {
    isActive: boolean;
    currentStepIndex: number;
    steps: TourStep[];
    startTour: (steps: TourStep[]) => void;
    nextStep: () => void;
    prevStep: () => void;
    endTour: () => void;
    skipTour: () => void;
}
