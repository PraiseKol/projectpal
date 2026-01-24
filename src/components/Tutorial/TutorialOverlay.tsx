import React, { useEffect, useState } from 'react';
import { useTutorial } from '@/hooks/useTutorial';
import { TutorialTooltip } from './TutorialTooltip';

export const TutorialOverlay: React.FC = () => {
  const { isActive, currentStep, getElementRect } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isActive || !currentStep) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const rect = getElementRect(currentStep.targetId);
      setTargetRect(rect);
    };

    // Initial update
    updateRect();

    // Update on scroll/resize
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    // Poll for element position changes
    const interval = setInterval(updateRect, 100);

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      clearInterval(interval);
    };
  }, [isActive, currentStep, getElementRect]);

  if (!isActive || !currentStep) {
    return null;
  }

  const padding = 8;
  const spotlightStyle = targetRect
    ? {
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Dark overlay with spotlight cutout */}
      <div className="absolute inset-0 pointer-events-auto">
        <svg className="w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlightStyle && (
                <rect
                  x={spotlightStyle.left}
                  y={spotlightStyle.top}
                  width={spotlightStyle.width}
                  height={spotlightStyle.height}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.7)"
            mask="url(#spotlight-mask)"
          />
        </svg>
      </div>

      {/* Spotlight border glow */}
      {spotlightStyle && (
        <div
          className="absolute border-2 border-primary rounded-lg shadow-lg shadow-primary/30 transition-all duration-300 ease-out"
          style={{
            top: spotlightStyle.top,
            left: spotlightStyle.left,
            width: spotlightStyle.width,
            height: spotlightStyle.height,
          }}
        />
      )}

      {/* Tooltip */}
      {targetRect && (
        <TutorialTooltip targetRect={targetRect} />
      )}
    </div>
  );
};
