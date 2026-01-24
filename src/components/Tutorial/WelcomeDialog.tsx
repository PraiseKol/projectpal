import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GraduationCap, BarChart3, FileSpreadsheet, Download } from 'lucide-react';
import { useTutorial } from '@/hooks/useTutorial';

const WELCOME_SHOWN_KEY = 'projectpal_data_analysis_welcome_shown';

export const WelcomeDialog: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { startTutorial, hasCompletedTutorial } = useTutorial();

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem(WELCOME_SHOWN_KEY) === 'true';
    
    // Show welcome dialog if user hasn't seen it and hasn't completed tutorial
    if (!hasSeenWelcome && !hasCompletedTutorial) {
      // Small delay to let the page render first
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedTutorial]);

  const handleStartTutorial = () => {
    localStorage.setItem(WELCOME_SHOWN_KEY, 'true');
    setIsOpen(false);
    startTutorial();
  };

  const handleSkip = () => {
    localStorage.setItem(WELCOME_SHOWN_KEY, 'true');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Welcome to Data Analysis!
          </DialogTitle>
          <DialogDescription className="text-center">
            Analyze your survey data and generate professional Chapter 4 results for your research.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Upload Your Data</p>
              <p className="text-xs text-muted-foreground">
                Excel or CSV files with survey responses
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Run Statistical Analyses</p>
              <p className="text-xs text-muted-foreground">
                T-tests, ANOVA, regression, factor analysis & more
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Download className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Export Results</p>
              <p className="text-xs text-muted-foreground">
                Get formatted Word/PDF reports for Chapter 4
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleSkip} className="w-full sm:w-auto">
            Skip for Now
          </Button>
          <Button onClick={handleStartTutorial} className="w-full sm:w-auto">
            Start Quick Tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
