// Amazon Bedrock integration service for ContentFlow AI

import { 
  BedrockRuntimeClient, 
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from './aws-clients';
import { 
  BedrockRequest, 
  BedrockResponse, 
  ContentType, 
  Platform, 
  ContentIntent,
  UserPreferences,
  AudienceProfile,
} from '../types';
import { 
  getAppConfig, 
  logError, 
  logInfo, 
  retryOperation, 
  measureExecutionTime,
  getPlatformConstraints,
} from '../utils';

const config = getAppConfig();

// Bedrock model configurations
export const BEDROCK_MODELS = {
  CLAUDE_3_SONNET: 'anthropic.claude-3-sonnet-20240229-v1:0',
  CLAUDE_3_HAIKU: 'anthropic.claude-3-haiku-20240307-v1:0',
  CLAUDE_3_OPUS: 'anthropic.claude-3-opus-20240229-v1:0',
  TITAN_TEXT_G1_LARGE: 'amazon.titan-text-lite-v1',
  TITAN_TEXT_G1_EXPRESS: 'amazon.titan-text-express-v1',
} as const;

// Content generation parameters for different models
export const MODEL_PARAMETERS = {
  [BEDROCK_MODELS.CLAUDE_3_SONNET]: {
    maxTokens: 4096,
    temperature: 0.7,
    topP: 0.9,
    stopSequences: ['Human:', 'Assistant:'],
  },
  [BEDROCK_MODELS.CLAUDE_3_HAIKU]: {
    maxTokens: 4096,
    temperature: 0.6,
    topP: 0.8,
    stopSequences: ['Human:', 'Assistant:'],
  },
  [BEDROCK_MODELS.CLAUDE_3_OPUS]: {
    maxTokens: 4096,
    temperature: 0.8,
    topP: 0.9,
    stopSequences: ['Human:', 'Assistant:'],
  },
  [BEDROCK_MODELS.TITAN_TEXT_G1_LARGE]: {
    maxTokenCount: 4096,
    temperature: 0.7,
    topP: 0.9,
    stopSequences: [],
  },
  [BEDROCK_MODELS.TITAN_TEXT_G1_EXPRESS]: {
    maxTokenCount: 8192,
    temperature: 0.7,
    topP: 0.9,
    stopSequences: [],
  },
} as const;

// Prompt templates for different content types
export class PromptTemplates {
  static getBlogPostPrompt(
    contentIdea: string,
    audience: AudienceProfile | null,
    preferences: UserPreferences | null,
    intent: ContentIntent
  ): string {
    const audienceContext = audience ? `
Target Audience:
- Age Range: ${audience.demographics.ageRange}
- Location: ${audience.demographics.location}
- Interests: ${audience.demographics.interests.join(', ')}
- Preferred Content Types: ${audience.behaviorPatterns.preferredContentTypes.join(', ')}
` : '';

    const brandVoice = preferences?.brandVoice || 'professional and engaging';
    const contentStyle = preferences?.contentStyle || 'informative';

    return `Human: You are an expert content writer specializing in ${intent} blog posts. Create a comprehensive blog post based on the following content idea.

Content Idea: "${contentIdea}"

${audienceContext}

Brand Voice: ${brandVoice}
Content Style: ${contentStyle}
Intent: ${intent}

Requirements:
- Write a blog post between 800-2000 words
- Include an engaging title and meta description
- Use proper headings (H1, H2, H3) for structure
- Include SEO-optimized keywords naturally
- Add a compelling introduction and conclusion
- Make it ${intent} and valuable for the target audience
- Maintain the specified brand voice throughout
- Include relevant examples or case studies where appropriate

Format your response as:
TITLE: [Blog post title]
META_DESCRIPTION: [SEO meta description under 160 characters]
KEYWORDS: [5-7 SEO keywords separated by commas]

[Blog post content with proper markdown formatting]
Assistant: I'll create a comprehensive blog post for you.

TITLE: [Generated title based on content idea]
META_DESCRIPTION: [Generated meta description]
KEYWORDS: [Generated keywords]

[Generated blog post content]`;
  }

  static getSocialMediaPrompt(
    contentIdea: string,
    platform: Platform,
    audience: AudienceProfile | null,
    preferences: UserPreferences | null,
    intent: ContentIntent
  ): string {
    const constraints = getPlatformConstraints(platform);
    const audienceContext = audience ? `
Target Audience:
- Age Range: ${audience.demographics.ageRange}
- Interests: ${audience.demographics.interests.join(', ')}
- Platform Usage: ${audience.behaviorPatterns.platformUsage[platform]?.frequency || 'regular'}
` : '';

    const brandVoice = preferences?.brandVoice || 'engaging and authentic';

    return `Human: You are a social media expert specializing in ${platform} content. Create an engaging ${platform} post based on the following content idea.

Content Idea: "${contentIdea}"

${audienceContext}

Platform: ${platform}
Brand Voice: ${brandVoice}
Intent: ${intent}
Character Limit: ${constraints.maxLength || 'No specific limit'}
Optimal Hashtag Count: ${constraints.optimalHashtags || constraints.hashtagLimit || 'No specific limit'}

Requirements:
- Create content optimized for ${platform}
- Stay within character limits
- Include relevant hashtags (${constraints.hashtagLimit ? `max ${constraints.hashtagLimit}` : 'appropriate amount'})
- Make it ${intent} and engaging for the target audience
- Include a clear call-to-action if appropriate
- Use platform-specific best practices
- Maintain the specified brand voice

Format your response as:
POST_TEXT: [The main post content]
HASHTAGS: [Relevant hashtags separated by spaces]
CTA: [Call-to-action if applicable]
Assistant: I'll create an engaging ${platform} post for you.

POST_TEXT: [Generated post content]
HASHTAGS: [Generated hashtags]
CTA: [Generated call-to-action]`;
  }

  static getCaptionPrompt(
    contentIdea: string,
    platform: Platform,
    audience: AudienceProfile | null,
    preferences: UserPreferences | null,
    intent: ContentIntent
  ): string {
    const constraints = getPlatformConstraints(platform);
    const audienceContext = audience ? `
Target Audience:
- Age Range: ${audience.demographics.ageRange}
- Interests: ${audience.demographics.interests.join(', ')}
` : '';

    const brandVoice = preferences?.brandVoice || 'engaging and relatable';

    return `Human: You are a caption writing expert specializing in ${platform} content. Create an engaging caption based on the following content idea.

Content Idea: "${contentIdea}"

${audienceContext}

Platform: ${platform}
Brand Voice: ${brandVoice}
Intent: ${intent}
Character Limit: ${constraints.maxLength || 'Platform appropriate'}

Requirements:
- Create a compelling caption for ${platform}
- Include relevant hashtags (${constraints.optimalHashtags || constraints.hashtagLimit || '5-10'} hashtags)
- Make it ${intent} and engaging
- Include emojis where appropriate
- Add a strong call-to-action
- Encourage engagement (likes, comments, shares)
- Maintain the specified brand voice

Format your response as:
CAPTION: [The main caption text with emojis]
HASHTAGS: [Relevant hashtags separated by spaces]
CTA: [Specific call-to-action]
Assistant: I'll create an engaging caption for your ${platform} content.

CAPTION: [Generated caption with emojis]
HASHTAGS: [Generated hashtags]
CTA: [Generated call-to-action]`;
  }

  static getScriptPrompt(
    contentIdea: string,
    audience: AudienceProfile | null,
    preferences: UserPreferences | null,
    intent: ContentIntent,
    duration?: number
  ): string {
    const audienceContext = audience ? `
Target Audience:
- Age Range: ${audience.demographics.ageRange}
- Interests: ${audience.demographics.interests.join(', ')}
` : '';

    const brandVoice = preferences?.brandVoice || 'conversational and engaging';
    const targetDuration = duration || 60; // Default 60 seconds

    return `Human: You are a script writing expert specializing in video content. Create an engaging script based on the following content idea.

Content Idea: "${contentIdea}"

${audienceContext}

Brand Voice: ${brandVoice}
Intent: ${intent}
Target Duration: ${targetDuration} seconds
Words per minute: ~150 (adjust for natural pacing)

Requirements:
- Create a script for approximately ${targetDuration} seconds
- Include timing cues and speaker notes
- Make it ${intent} and engaging for the target audience
- Include clear introduction, main content, and conclusion
- Add visual cues and action notes where appropriate
- Include pauses and emphasis markers
- Maintain the specified brand voice
- Make it suitable for video/audio production

Format your response as:
TITLE: [Script title]
DURATION: [Estimated duration]
WORD_COUNT: [Approximate word count]

[TIMING] SPEAKER NOTES: Action/Visual cues
[00:00-00:05] INTRO: [Opening lines with energy and hook]
[00:05-00:15] MAIN_POINT_1: [First key point with supporting details]
[Continue with timing cues and content...]
Assistant: I'll create an engaging script for your video content.

TITLE: [Generated script title]
DURATION: [Estimated duration]
WORD_COUNT: [Word count]

[Generated script with timing cues and speaker notes]`;
  }
}

// Content generation request interface
export interface ContentGenerationOptions {
  contentIdea: string;
  contentType: ContentType;
  platform?: Platform;
  audience?: AudienceProfile | null;
  preferences?: UserPreferences | null;
  intent: ContentIntent;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  variations?: number;
  duration?: number; // For scripts
}

// Content generation response interface
export interface BedrockContentResponse {
  content: string;
  metadata: {
    modelId: string;
    processingTime: number;
    tokenUsage: {
      inputTokens: number;
      outputTokens: number;
    };
    contentType: ContentType;
    platform?: Platform;
    wordCount: number;
    characterCount: number;
  };
  variations?: BedrockContentResponse[];
}

// Export utility functions for content generation
export const generateBlogPost = async (
  contentIdea: string,
  audience?: AudienceProfile | null,
  preferences?: UserPreferences | null,
  intent: ContentIntent = 'informational'
): Promise<BedrockContentResponse> => {
  const { bedrockService } = await import('./bedrock-service');
  return bedrockService.generateContent({
    contentIdea,
    contentType: 'blog-post',
    audience,
    preferences,
    intent,
  });
};

export const generateSocialPost = async (
  contentIdea: string,
  platform: Platform,
  audience?: AudienceProfile | null,
  preferences?: UserPreferences | null,
  intent: ContentIntent = 'promotional'
): Promise<BedrockContentResponse> => {
  const { bedrockService } = await import('./bedrock-service');
  return bedrockService.generateContent({
    contentIdea,
    contentType: 'social-post',
    platform,
    audience,
    preferences,
    intent,
  });
};

export const generateCaption = async (
  contentIdea: string,
  platform: Platform,
  audience?: AudienceProfile | null,
  preferences?: UserPreferences | null,
  intent: ContentIntent = 'entertainment'
): Promise<BedrockContentResponse> => {
  const { bedrockService } = await import('./bedrock-service');
  return bedrockService.generateContent({
    contentIdea,
    contentType: 'caption',
    platform,
    audience,
    preferences,
    intent,
  });
};

export const generateScript = async (
  contentIdea: string,
  duration: number = 60,
  audience?: AudienceProfile | null,
  preferences?: UserPreferences | null,
  intent: ContentIntent = 'educational'
): Promise<BedrockContentResponse> => {
  const { bedrockService } = await import('./bedrock-service');
  return bedrockService.generateContent({
    contentIdea,
    contentType: 'script',
    audience,
    preferences,
    intent,
    duration,
  });
};