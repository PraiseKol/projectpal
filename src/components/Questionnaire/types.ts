export type QuestionType = 'yes_no' | 'short_text' | 'long_text' | 'rating_scale' | 'multiple_choice';
export type ScaleDirection = '1to5' | '5to1';

export interface Question {
  id: string;
  text: string;
  helperText?: string;
  type: QuestionType;
  scaleDirection?: ScaleDirection;
  options?: string[];
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export interface QuestionnaireData {
  title: string;
  subtitle?: string;
  introText?: string;
  labels?: string[];
  sections: Section[];
}

export const SCALE_LABELS = ['Very Poor', 'Poor', 'Average', 'Good', 'Very Good'];

export function getScaleLabels(direction: ScaleDirection): { value: number; label: string }[] {
  if (direction === '1to5') {
    return SCALE_LABELS.map((label, i) => ({ value: i + 1, label }));
  }
  return SCALE_LABELS.map((label, i) => ({ value: 5 - i, label }));
}

export const createEmptyQuestion = (): Question => ({
  id: crypto.randomUUID(),
  text: '',
  type: 'short_text',
});

export const createEmptySection = (): Section => ({
  id: crypto.randomUUID(),
  title: '',
  questions: [createEmptyQuestion()],
});

export const createEmptyQuestionnaire = (): QuestionnaireData => ({
  title: '',
  sections: [createEmptySection()],
});
