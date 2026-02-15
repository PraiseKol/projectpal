import { QuestionnaireData } from './types';

export const sampleTemplate: QuestionnaireData = {
  title: 'ProjectPal User Experience Survey',
  subtitle: 'Help us improve your experience',
  introText: 'Thank you for taking the time to complete this survey. Your feedback is invaluable in helping us enhance ProjectPal and deliver the best possible experience. All responses are anonymous and will be used solely for product improvement.',
  labels: ['User Feedback', 'Product Research'],
  sections: [
    {
      id: crypto.randomUUID(),
      title: 'Demographics',
      description: 'Tell us a little about yourself so we can better understand our user base.',
      questions: [
        {
          id: crypto.randomUUID(),
          text: 'What is your age range?',
          type: 'multiple_choice',
          options: ['Under 16', '16 – 20', '21 – 24', '25 – 30', '31 – 40', '41 and above'],
        },
        {
          id: crypto.randomUUID(),
          text: 'What is your highest level of education?',
          type: 'multiple_choice',
          options: ['Secondary School', 'Undergraduate', 'Postgraduate', 'Doctorate', 'Other'],
        },
        {
          id: crypto.randomUUID(),
          text: 'What is your field of study or work?',
          helperText: 'e.g., Computer Science, Business, Medicine, Engineering',
          type: 'short_text',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: 'Platform Usage',
      description: 'Help us understand how you interact with ProjectPal.',
      questions: [
        {
          id: crypto.randomUUID(),
          text: 'How long have you been using ProjectPal?',
          type: 'multiple_choice',
          options: ['Less than 1 month', '1 – 3 months', '3 – 6 months', '6 – 12 months', 'Over 1 year'],
        },
        {
          id: crypto.randomUUID(),
          text: 'Which ProjectPal features have you used?',
          helperText: 'Select the one you use most frequently.',
          type: 'multiple_choice',
          options: ['AI Chat Assistant', 'Document Editor', 'PPT Generator', 'Data Analysis', 'Questionnaire Builder', 'Paraphraser'],
        },
        {
          id: crypto.randomUUID(),
          text: 'How often do you use ProjectPal?',
          type: 'multiple_choice',
          options: ['Daily', 'Several times a week', 'Weekly', 'Monthly', 'Rarely'],
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: 'Feature Satisfaction',
      description: 'Rate your satisfaction with each ProjectPal feature you have used.',
      questions: [
        {
          id: crypto.randomUUID(),
          text: 'How would you rate the AI Chat Assistant?',
          helperText: 'Consider accuracy, relevance, and usefulness of responses.',
          type: 'rating_scale',
          scaleDirection: '1to5',
        },
        {
          id: crypto.randomUUID(),
          text: 'How would you rate the Document Editor?',
          helperText: 'Consider ease of editing, AI suggestions, and export quality.',
          type: 'rating_scale',
          scaleDirection: '1to5',
        },
        {
          id: crypto.randomUUID(),
          text: 'How would you rate the PPT Generator?',
          helperText: 'Consider template variety, content quality, and design output.',
          type: 'rating_scale',
          scaleDirection: '1to5',
        },
        {
          id: crypto.randomUUID(),
          text: 'How would you rate the Data Analysis tool?',
          helperText: 'Consider file support, analysis accuracy, and visualisations.',
          type: 'rating_scale',
          scaleDirection: '1to5',
        },
        {
          id: crypto.randomUUID(),
          text: 'How would you rate the Questionnaire Builder?',
          helperText: 'Consider ease of use, question types, and export formats.',
          type: 'rating_scale',
          scaleDirection: '1to5',
        },
        {
          id: crypto.randomUUID(),
          text: 'How would you rate the Paraphraser tool?',
          helperText: 'Consider paraphrase quality, tone options, and speed.',
          type: 'rating_scale',
          scaleDirection: '1to5',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: 'Usability and Support',
      description: 'Let us know how easy it is to use ProjectPal and about your support experience.',
      questions: [
        {
          id: crypto.randomUUID(),
          text: 'How easy is it to navigate the ProjectPal platform?',
          type: 'rating_scale',
          scaleDirection: '1to5',
        },
        {
          id: crypto.randomUUID(),
          text: 'Have you encountered any technical issues while using ProjectPal?',
          type: 'yes_no',
        },
        {
          id: crypto.randomUUID(),
          text: 'If yes, please describe the issues you encountered.',
          helperText: 'Include details such as the feature affected and what happened.',
          type: 'long_text',
        },
        {
          id: crypto.randomUUID(),
          text: 'How would you rate the customer support experience?',
          helperText: 'Consider response time, helpfulness, and resolution quality.',
          type: 'rating_scale',
          scaleDirection: '1to5',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: 'Overall Experience and Recommendations',
      description: 'Share your overall thoughts on ProjectPal.',
      questions: [
        {
          id: crypto.randomUUID(),
          text: 'How satisfied are you with ProjectPal overall?',
          type: 'rating_scale',
          scaleDirection: '1to5',
        },
        {
          id: crypto.randomUUID(),
          text: 'Would you recommend ProjectPal to a colleague or friend?',
          type: 'yes_no',
        },
        {
          id: crypto.randomUUID(),
          text: 'What do you like most about ProjectPal?',
          helperText: 'Feel free to mention specific features, workflows, or experiences.',
          type: 'long_text',
        },
        {
          id: crypto.randomUUID(),
          text: 'What improvements or new features would you suggest?',
          helperText: 'Your ideas help shape the future of ProjectPal.',
          type: 'long_text',
        },
      ],
    },
  ],
};
