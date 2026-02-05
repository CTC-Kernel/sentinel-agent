import { create } from 'zustand';
import { OnboardingState, TourStep } from './types';

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
 isActive: false,
 currentStepIndex: 0,
 steps: [],

 startTour: (steps: TourStep[]) => {
 set({ isActive: true, steps, currentStepIndex: 0 });
 },

 nextStep: () => {
 const { currentStepIndex, steps } = get();
 if (currentStepIndex < steps.length - 1) {
 set({ currentStepIndex: currentStepIndex + 1 });
 // Execute onNext callback if exists for the *completed* step? Or the new one?
 // Usually, we might want to do something *before* moving, but here we just moved.
 // Let's execute logic in the components if needed using useEffect on step change.
 } else {
 get().endTour();
 }
 },

 prevStep: () => {
 const { currentStepIndex } = get();
 if (currentStepIndex > 0) {
 set({ currentStepIndex: currentStepIndex - 1 });
 }
 },

 endTour: () => {
 set({ isActive: false, currentStepIndex: 0, steps: [] });
 },

 skipTour: () => {
 set({ isActive: false, currentStepIndex: 0, steps: [] });
 }
}));
