export interface TutorialStep {
  id: string;
  stage: 1 | 2 | 3 | 4;
  targetId: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  showArrow?: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  // Stage 1: Upload
  {
    id: 'welcome-progress',
    stage: 1,
    targetId: 'tutorial-progress-indicator',
    title: 'Track Your Progress',
    description: 'This shows your journey through the 4 stages: Upload → Configure → Analyze → View Results.',
    position: 'bottom',
    showArrow: true,
  },
  {
    id: 'upload-dropzone',
    stage: 1,
    targetId: 'tutorial-upload-dropzone',
    title: 'Upload Your Data',
    description: 'Drag and drop your Excel (.xlsx, .xls) or CSV file here, or click to browse. Maximum file size is 10MB.',
    position: 'bottom',
    showArrow: true,
  },
  {
    id: 'upload-requirements',
    stage: 1,
    targetId: 'tutorial-upload-tips',
    title: 'Data Requirements',
    description: 'Your first row should contain column headers (variable names). Each column represents a variable for analysis.',
    position: 'top',
    showArrow: true,
  },

  // Stage 2: Configure Columns
  {
    id: 'config-table',
    stage: 2,
    targetId: 'tutorial-column-table',
    title: 'Configure Your Columns',
    description: 'Here you\'ll see all columns detected in your file. Review the sample values to understand your data.',
    position: 'top',
    showArrow: true,
  },
  {
    id: 'config-include',
    stage: 2,
    targetId: 'tutorial-include-checkbox',
    title: 'Include/Exclude Columns',
    description: 'Check the columns you want to include in your analysis. Uncheck irrelevant columns like ID numbers.',
    position: 'right',
    showArrow: true,
  },
  {
    id: 'config-type',
    stage: 2,
    targetId: 'tutorial-type-selector',
    title: 'Select Data Types',
    description: 'Choose the correct type: Numeric for continuous values (age, scores), Likert for scales (1-5), Categorical for groups (gender, faculty).',
    position: 'left',
    showArrow: true,
  },
  {
    id: 'config-continue',
    stage: 2,
    targetId: 'tutorial-continue-btn',
    title: 'Continue When Ready',
    description: 'Once you\'ve configured at least 2 columns, click Continue to select your analyses.',
    position: 'top',
    showArrow: true,
  },

  // Stage 3: Select Analyses
  {
    id: 'analysis-summary',
    stage: 3,
    targetId: 'tutorial-column-summary',
    title: 'Your Data Summary',
    description: 'This shows a breakdown of your selected columns by type. Different analyses require different column types.',
    position: 'bottom',
    showArrow: true,
  },
  {
    id: 'analysis-cards',
    stage: 3,
    targetId: 'tutorial-analysis-grid',
    title: 'Choose Your Analyses',
    description: 'Select the statistical analyses you want to run. Grayed-out options aren\'t compatible with your current data types.',
    position: 'top',
    showArrow: true,
  },
  {
    id: 'analysis-credits',
    stage: 3,
    targetId: 'tutorial-credits-display',
    title: 'Credit Cost',
    description: 'Each analysis has a credit cost. Selecting 3+ analyses gives you a 15% bundle discount!',
    position: 'left',
    showArrow: true,
  },
  {
    id: 'analysis-run',
    stage: 3,
    targetId: 'tutorial-run-btn',
    title: 'Run Your Analysis',
    description: 'When you\'re ready, click this button to start processing. Complex analyses may take a few moments.',
    position: 'top',
    showArrow: true,
  },

  // Stage 4: Results
  {
    id: 'results-tabs',
    stage: 4,
    targetId: 'tutorial-results-tabs',
    title: 'View Different Results',
    description: 'Switch between your different analysis results using these tabs. Each analysis has its own detailed report.',
    position: 'bottom',
    showArrow: true,
  },
  {
    id: 'results-content',
    stage: 4,
    targetId: 'tutorial-results-content',
    title: 'Statistical Tables & Charts',
    description: 'View your statistical tables, p-values, and visualizations here. These are formatted for academic Chapter 4 writing.',
    position: 'top',
    showArrow: true,
  },
  {
    id: 'results-export',
    stage: 4,
    targetId: 'tutorial-export-btn',
    title: 'Export Your Results',
    description: 'Download your complete Chapter 4 analysis as a professionally formatted Word document, PDF, or text file.',
    position: 'left',
    showArrow: true,
  },
];

export const getStepsForStage = (stage: number): TutorialStep[] => {
  return TUTORIAL_STEPS.filter(step => step.stage === stage);
};

export const getTotalSteps = (): number => TUTORIAL_STEPS.length;

export const getStepIndex = (stepId: string): number => {
  return TUTORIAL_STEPS.findIndex(step => step.id === stepId);
};
