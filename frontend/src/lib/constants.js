export const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian',
  'Chinese (Simplified)', 'Chinese (Traditional)', 'Chinese (Traditional, Taiwan)',
  'Chinese (Traditional, Hong Kong)', 'Japanese', 'Korean', 'Arabic',
  'Hindi', 'Dutch', 'Swedish', 'Polish', 'Turkish', 'Vietnamese', 'Thai', 'Indonesian', 'Greek',
];

export const TRANSLATION_TYPES = [
  { group: null, options: ['Help me to decide'] },
  { group: 'Creative Studio', options: ['Literary', 'Marketing'] },
  { group: 'Legal & Business', options: ['Legal', 'Business'] },
  { group: 'Science & Medical', options: ['Academic', 'Technical', 'Medical'] },
  { group: 'News & Media', options: ['News'] },
  { group: 'Solo expert', options: ['Master Translator'] },
];

export const OUTPUT_FORMATS = [
  { value: 'docx', label: 'Word (.docx)' },
  { value: 'txt', label: 'Plain text (.txt)' },
  { value: 'md', label: 'Markdown (.md)' },
  { value: 'html', label: 'HTML (.html)' },
  { value: 'json', label: 'JSON (.json)' },
];

export const PROVIDERS = [
  { id: 'openrouter', label: 'OpenRouter', keyUrl: 'https://openrouter.ai/keys' },
  { id: 'openai', label: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', label: 'Anthropic', keyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'google', label: 'Google Gemini', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'xai', label: 'xAI', keyUrl: 'https://console.x.ai' },
];

export const MODELS = {
  openrouter: [
    'anthropic/claude-sonnet-5-5',
    'openai/gpt-6-luna',
    'openai/gpt-6-sol',
    'google/gemini-3.8-flash',
    'x-ai/grok-4.7',
  ],
  openai: ['gpt-6-luna', 'gpt-6.1-sol', 'gpt-6-astra', 'gpt-5.6-terra', 'gpt-5.6-luna'],
  anthropic: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1', 'claude-haiku-4-5'],
  google: ['gemini-3.8-flash'],
  xai: ['grok-4.7', 'grok-4.6'],
};

export const DOMAIN_TEMPERATURES = {
  literary: { label: 'Literary', value: 0.8 },
  marketing: { label: 'Marketing', value: 0.8 },
  legal: { label: 'Legal', value: 0.65 },
  business: { label: 'Business', value: 0.7 },
  academic: { label: 'Academic', value: 0.7 },
  technical: { label: 'Technical', value: 0.65 },
  medical: { label: 'Medical', value: 0.6 },
  news: { label: 'News', value: 0.7 },
  master: { label: 'Master', value: 0.7 },
};

export const PIPELINE_STEPS = [
  { id: 'brief', label: 'Brief' },
  { id: 'chunk', label: 'Chunk' },
  { id: 'analyse', label: 'Analyse' },
  { id: 'translate', label: 'Translate' },
  { id: 'edit', label: 'Edit' },
  { id: 'terms', label: 'Terms' },
  { id: 'bind', label: 'Bind' },
  { id: 'deliver', label: 'Deliver' },
];

export const DOC_ACCEPT = '.pdf,.docx,.pptx,.json,.html,.htm,.txt,.md';
export const GLOSSARY_ACCEPT = '.csv,.tsv,.xlsx,.json,.txt';
export const STYLE_ACCEPT = '.txt,.md,.docx,.pdf,.html,.htm,.json';
