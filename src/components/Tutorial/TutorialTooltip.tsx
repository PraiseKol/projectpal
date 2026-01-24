import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTutorial } from '@/hooks/useTutorial';
import { getStepsForStage } from './tutorialSteps';

interface TutorialTooltipProps {
  targetRect: DOMRect;
}

export const TutorialTooltip: React.FC<TutorialTooltipProps> = ({ targetRect }) => {
  const { 
    currentStep, 
    currentStepIndex, 
    currentStage,
    nextStep, 
    prevStep, 
    endTutorial 
  } = useTutorial();

  const stageSteps = getStepsForStage(currentStage);
  const stageStepIndex = stageSteps.findIndex(s => s.id === currentStep?.id) + 1;
  const totalStageSteps = stageSteps.length;

  const isFirstStep = stageStepIndex === 1;
  const isLastStep = stageStepIndex === totalStageSteps;

  const position = useMemo(() => {
    if (!currentStep) return { top: 0, left: 0 };

    const tooltipWidth = 320;
    const tooltipHeight = 180;
    const offset = 16;
    const padding = 8;

    let top = 0;
    let left = 0;

    const adjustedRect = {
      top: targetRect.top - padding,
      left: targetRect.left - padding,
      width: targetRect.width + padding * 2,
      height: targetRect.height + padding * 2,
      bottom: targetRect.bottom + padding,
      right: targetRect.right + padding,
    };

    switch (currentStep.position) {
      case 'top':
        top = adjustedRect.top - tooltipHeight - offset;
        left = adjustedRect.left + adjustedRect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = adjustedRect.bottom + offset;
        left = adjustedRect.left + adjustedRect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = adjustedRect.top + adjustedRect.height / 2 - tooltipHeight / 2;
        left = adjustedRect.left - tooltipWidth - offset;
        break;
      case 'right':
        top = adjustedRect.top + adjustedRect.height / 2 - tooltipHeight / 2;
        left = adjustedRect.right + offset;
        break;
    }

    // Keep tooltip within viewport
    const viewportPadding = 16;
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipWidth - viewportPadding));
    top = Math.max(viewportPadding, Math.min(top, window.innerHeight - tooltipHeight - viewportPadding));

    return { top, left };
  }, [currentStep, targetRect]);

  if (!currentStep) return null;

  return (
    <Card
      className="fixed w-80 shadow-2xl border-primary/20 pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        top: position.top,
        left: position.left,
        zIndex: 60,
      }}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">
            Step {stageStepIndex} of {totalStageSteps}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mr-2 -mt-1"
            onClick={() => endTutorial()}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <h4 className="font-semibold text-foreground mb-1">
          {currentStep.title}
        </h4>
        <p className="text-sm text-muted-foreground mb-4">
          {currentStep.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => endTutorial()}
            className="text-muted-foreground hover:text-foreground"
          >
            Skip Tutorial
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevStep}
              disabled={isFirstStep}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={nextStep}
            >
              {isLastStep ? 'Done' : 'Next'}
              {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
