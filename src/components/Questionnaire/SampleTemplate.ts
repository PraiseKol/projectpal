import { QuestionnaireData } from './types';

export const sampleTemplate: QuestionnaireData = {
  title: 'Customer Service Satisfaction Survey',
  subtitle: 'We value your feedback',
  introText: 'Please take a few minutes to complete this survey. Your responses will help us improve our services.',
  labels: ['Customer Feedback', 'Service Review'],
  sections: [
    {
      id: crypto.randomUUID(),
      title: 'General Information',
      description: 'Tell us about your experience with our service.',
      questions: [
        {
          id: crypto.randomUUID(),
          text: 'Have you used our services before?',
          type: 'yes_no',
        },
        {
          id: crypto.randomUUID(),
          text: 'Which department did you interact with?',
          helperText: 'e.g., Sales, Support, Billing',
          type: 'short_text',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: 'Service Quality',
      description: 'Rate the quality of service you received.',
      questions: [
        {
          id: crypto.randomUUID(),
          text: 'How would you rate the overall quality of service?',
          type: 'rating_scale',
          scaleDirection: '1to5',
        },
        {
          id: crypto.randomUUID(),
          text: 'How would you rate the responsiveness of our staff?',
          helperText: 'Consider how quickly your queries were addressed.',
          type: 'rating_scale',
          scaleDirection: '1to5',
        },
        {
          id: crypto.randomUUID(),
          text: 'Please describe any issues you encountered.',
          type: 'long_text',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: 'Recommendations',
      questions: [
        {
          id: crypto.randomUUID(),
          text: 'Would you recommend our services to others?',
          type: 'yes_no',
        },
        {
          id: crypto.randomUUID(),
          text: 'Any additional comments or suggestions?',
          type: 'long_text',
        },
      ],
    },
  ],
};
