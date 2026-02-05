import React from 'react';
import { Play, Clock, Users, CheckCircle } from '../ui/Icons';
import { Button } from '../ui/button';

interface TutorialStepProps {
 step: number;
 title: string;
 description: string;
 action?: string;
 isCompleted?: boolean;
 isCurrent?: boolean;
}

const TutorialStep: React.FC<TutorialStepProps> = ({
 step,
 title,
 description,
 action,
 isCompleted = false,
 isCurrent = false
}) => {
 return (
 <div className={`flex gap-4 p-4 rounded-3xl border transition-all ${isCurrent
 ? 'bg-primary/10 border-primary/30 shadow-lg'
 : isCompleted
 ? 'bg-green-50 dark:bg-green-900/30 border-green-200'
 : 'bg-white border-border/40'
 }`}>
 <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted
 ? 'bg-green-500 text-white'
 : isCurrent
 ? 'bg-primary text-primary-foreground'
 : 'bg-muted text-muted-foreground'
 }`}>
 {isCompleted ? (
 <CheckCircle className="w-4 h-4" />
 ) : (
 <span className="text-sm font-bold">{step}</span>
 )}
 </div>
 <div className="flex-1">
 <h3 className={`font-bold mb-1 ${isCurrent ? 'text-primary' : isCompleted ? 'text-green-700' : 'text-foreground'
 }`}>
 {title}
 </h3>
 <p className="text-sm text-muted-foreground mb-2">{description}</p>
 {action && isCurrent && (
 <Button size="sm" className="text-xs">
 {action}
 </Button>
 )}
 </div>
 </div>
 );
};

interface InteractiveTutorialProps {
 title: string;
 description: string;
 duration: string;
 difficulty: 'Débutant' | 'Intermédiaire' | 'Avancé';
 audience: string;
 steps: Array<{
 title: string;
 description: string;
 action?: string;
 }>;
}

export const InteractiveTutorial: React.FC<InteractiveTutorialProps> = ({
 title,
 description,
 duration,
 difficulty,
 audience,
 steps
}) => {
 const [currentStep, setCurrentStep] = React.useState(0);
 const [completedSteps, setCompletedSteps] = React.useState<number[]>([]);

 const handleNextStep = () => {
 if (currentStep < steps.length - 1) {
 setCompletedSteps([...completedSteps, currentStep]);
 setCurrentStep(currentStep + 1);
 }
 };

 const handlePreviousStep = () => {
 if (currentStep > 0) {
 setCurrentStep(currentStep - 1);
 }
 };

 const getDifficultyColor = (difficulty: string) => {
 switch (difficulty) {
 case 'Débutant': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
 case 'Intermédiaire': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
 case 'Avancé': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
 default: return 'bg-muted text-foreground';
 }
 };

 return (
 <div className="bg-white rounded-3xl border border-border/40 p-6 space-y-6">
 {/* Header */}
 <div className="border-b border-border/40 pb-4">
 <div className="flex items-start justify-between mb-3">
 <div className="flex-1">
 <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
 <p className="text-muted-foreground">{description}</p>
 </div>
 <div className="flex items-center gap-2 ml-4">
 <Play className="w-5 h-5 text-primary" />
 <span className="text-sm font-medium text-primary">Tutoriel interactif</span>
 </div>
 </div>

 {/* Metadata */}
 <div className="flex flex-wrap gap-3 text-sm">
 <div className="flex items-center gap-1.5 text-muted-foreground">
 <Clock className="w-4 h-4" />
 <span>{duration}</span>
 </div>
 <div className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(difficulty)}`}>
 {difficulty}
 </div>
 <div className="flex items-center gap-1.5 text-muted-foreground">
 <Users className="w-4 h-4" />
 <span>{audience}</span>
 </div>
 </div>
 </div>

 {/* Progress */}
 <div className="space-y-2">
 <div className="flex justify-between text-sm text-muted-foreground">
 <span>Progression</span>
 <span>{currentStep + 1} / {steps.length}</span>
 </div>
 <div className="w-full bg-muted rounded-full h-2">
 <div
 className="bg-primary h-2 rounded-full transition-all duration-300"
 style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
 />
 </div>
 </div>

 {/* Steps */}
 <div className="space-y-3">
 {steps.map((step, index) => (
 <TutorialStep
 key={index || 'unknown'}
 step={index + 1}
 title={step.title}
 description={step.description}
 action={step.action}
 isCompleted={completedSteps.includes(index)}
 isCurrent={index === currentStep}
 />
 ))}
 </div>

 {/* Navigation */}
 <div className="flex justify-between pt-4 border-t border-border/40">
 <Button
 variant="outline"
 onClick={handlePreviousStep}
 disabled={currentStep === 0}
 >
 Étape précédente
 </Button>
 <Button
 onClick={handleNextStep}
 disabled={currentStep === steps.length - 1}
 >
 {currentStep === steps.length - 1 ? 'Terminer' : 'Étape suivante'}
 </Button>
 </div>
 </div>
 );
};
