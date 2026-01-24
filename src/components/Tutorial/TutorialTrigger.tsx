import React, { useEffect, useRef, ReactNode } from 'react';
import { useTutorial } from '@/hooks/useTutorial';

interface TutorialTriggerProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export const TutorialTrigger: React.FC<TutorialTriggerProps> = ({ 
  id, 
  children, 
  className = '' 
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { registerElement, isActive, currentStep } = useTutorial();

  useEffect(() => {
    registerElement(id, ref.current);
    return () => registerElement(id, null);
  }, [id, registerElement]);

  const isHighlighted = isActive && currentStep?.targetId === id;

  return (
    <div 
      ref={ref} 
      className={`${className} ${isHighlighted ? 'relative z-[60]' : ''}`}
      data-tutorial-id={id}
    >
      {children}
    </div>
  );
};
