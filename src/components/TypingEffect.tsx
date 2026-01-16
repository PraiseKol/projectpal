import { useState, useEffect, useCallback } from "react";

interface TypingEffectProps {
  text: string;
  onComplete?: () => void;
  onSkip?: () => void;
  speed?: number;
  children: (displayedText: string, isComplete: boolean) => React.ReactNode;
}

export const TypingEffect = ({ 
  text, 
  onComplete, 
  onSkip,
  speed = 20, // 1.5x faster (was 30)
  children 
}: TypingEffectProps) => {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const skipAnimation = useCallback(() => {
    setDisplayedText(text);
    setCurrentIndex(text.length);
    setIsComplete(true);
    onComplete?.();
    onSkip?.();
  }, [text, onComplete, onSkip]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const char = text[currentIndex];
      
      // Add variable delays for natural typing (scaled down for faster speed)
      let delay = speed;
      if (char === '.' || char === '!' || char === '?') {
        delay = speed * 2; // Reduced from 3
      } else if (char === ',' || char === ';' || char === ':') {
        delay = speed * 1.5; // Reduced from 2
      } else if (char === '\n') {
        delay = speed * 1.2; // Reduced from 1.5
      }

      const timer = setTimeout(() => {
        setDisplayedText((prev) => prev + char);
        setCurrentIndex((prev) => prev + 1);
      }, delay);

      return () => clearTimeout(timer);
    } else if (currentIndex === text.length && !isComplete) {
      setIsComplete(true);
      onComplete?.();
    }
  }, [currentIndex, text, speed, onComplete, isComplete]);

  // Reset when text changes
  useEffect(() => {
    setDisplayedText("");
    setCurrentIndex(0);
    setIsComplete(false);
  }, [text]);

  // Expose skip function via window for external access
  useEffect(() => {
    (window as any).__skipTypingAnimation = skipAnimation;
    return () => {
      delete (window as any).__skipTypingAnimation;
    };
  }, [skipAnimation]);

  return <>{children(displayedText, isComplete)}</>;
};
