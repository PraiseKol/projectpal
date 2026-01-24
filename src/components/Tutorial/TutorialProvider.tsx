import React, { createContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { TUTORIAL_STEPS, TutorialStep, getStepsForStage } from './tutorialSteps';

interface TutorialContextType {
  isActive: boolean;
  currentStep: TutorialStep | null;
  currentStepIndex: number;
  totalSteps: number;
  currentStage: number;
  hasCompletedTutorial: boolean;
  startTutorial: () => void;
  endTutorial: (markComplete?: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipToStage: (stage: number) => void;
  registerElement: (id: string, element: HTMLElement | null) => void;
  getElementRect: (id: string) => DOMRect | null;
}

export const TutorialContext = createContext<TutorialContextType | null>(null);

const TUTORIAL_STORAGE_KEY = 'projectpal_tutorial_completed';

interface TutorialProviderProps {
  children: ReactNode;
  currentStage: number;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({ children, currentStage }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(() => {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
  });
  const [elements, setElements] = useState<Map<string, HTMLElement>>(new Map());

  const currentStep = isActive ? TUTORIAL_STEPS[currentStepIndex] || null : null;
  const totalSteps = TUTORIAL_STEPS.length;

  // When stage changes, jump to the first step of that stage
  useEffect(() => {
    if (isActive) {
      const stageSteps = getStepsForStage(currentStage);
      if (stageSteps.length > 0) {
        const firstStepOfStage = TUTORIAL_STEPS.findIndex(s => s.id === stageSteps[0].id);
        if (firstStepOfStage !== -1 && TUTORIAL_STEPS[currentStepIndex]?.stage !== currentStage) {
          setCurrentStepIndex(firstStepOfStage);
        }
      }
    }
  }, [currentStage, isActive]);

  const startTutorial = useCallback(() => {
    const stageSteps = getStepsForStage(currentStage);
    if (stageSteps.length > 0) {
      const firstStepOfStage = TUTORIAL_STEPS.findIndex(s => s.id === stageSteps[0].id);
      setCurrentStepIndex(firstStepOfStage !== -1 ? firstStepOfStage : 0);
    } else {
      setCurrentStepIndex(0);
    }
    setIsActive(true);
  }, [currentStage]);

  const endTutorial = useCallback((markComplete = false) => {
    setIsActive(false);
    if (markComplete) {
      setHasCompletedTutorial(true);
      localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    }
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      const nextIdx = currentStepIndex + 1;
      const nextStepItem = TUTORIAL_STEPS[nextIdx];
      
      // If next step is in a different stage, end tutorial for now
      if (nextStepItem.stage !== currentStage) {
        endTutorial();
        return;
      }
      
      setCurrentStepIndex(nextIdx);
    } else {
      endTutorial(true);
    }
  }, [currentStepIndex, currentStage, endTutorial]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      const prevStepItem = TUTORIAL_STEPS[prevIdx];
      
      // Don't go back to previous stage
      if (prevStepItem.stage !== currentStage) {
        return;
      }
      
      setCurrentStepIndex(prevIdx);
    }
  }, [currentStepIndex, currentStage]);

  const skipToStage = useCallback((stage: number) => {
    const stageSteps = getStepsForStage(stage);
    if (stageSteps.length > 0) {
      const firstStepOfStage = TUTORIAL_STEPS.findIndex(s => s.id === stageSteps[0].id);
      if (firstStepOfStage !== -1) {
        setCurrentStepIndex(firstStepOfStage);
      }
    }
  }, []);

  const registerElement = useCallback((id: string, element: HTMLElement | null) => {
    setElements(prev => {
      const next = new Map(prev);
      if (element) {
        next.set(id, element);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const getElementRect = useCallback((id: string): DOMRect | null => {
    const element = elements.get(id);
    return element ? element.getBoundingClientRect() : null;
  }, [elements]);

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStep,
        currentStepIndex,
        totalSteps,
        currentStage,
        hasCompletedTutorial,
        startTutorial,
        endTutorial,
        nextStep,
        prevStep,
        skipToStage,
        registerElement,
        getElementRect,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};
