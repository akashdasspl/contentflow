// Tests for Amazon Bedrock integration service

import { 
  PromptTemplates,
  BEDROCK_MODELS,
  generateBlogPost,
  generateSocialPost,
  generateCaption,
  generateScript,
} from '../src/services/bedrock';
import { BedrockService } from '../src/services/bedrock-service';
import { 
  ContentIntent, 
  Platform, 
  AudienceProfile, 
  UserPreferences 
} from '../src/types';

// Mock AWS SDK
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  InvokeModelCommand: jest.fn().mockImplementation((params) => ({ params })),
  InvokeModelWithResponseStreamCommand: jest.fn().mockImplementation((params) => ({ params })),
}));

jest.mock('../src/services/aws-clients', () => ({
  bedrockClient: {
    send: jest.fn(),
  },
}));

jest.mock('../src/utils', () => ({
  getAppConfig: jest.fn(() => ({
    aws: {
      bedrock: {
        modelIds: {
          textGeneration: 'anthropic.claude-3-sonnet-20240229-v1:0',
          textAnalysis: 'anthropic.claude-3-haiku-20240307-v1:0',
        },
      },
    },
  })),
  logError: jest.fn(),
  logInfo: jest.fn(),
  retryOperation: jest.fn((operation) => operation()),
  measureExecutionTime: jest.fn(async (operation) => ({
    result: await operation(),
    executionTime: 1000,
  })),
  getPlatformConstraints: jest.fn((platform: string) => ({
    twitter: { maxLength: 280, hashtagLimit: 2 },
    instagram: { maxLength: 2200, hashtagLimit: 30, optimalHashtags: 11 },
    blog: { minLength: 800, maxLength: 2000 },
  }[platform] || {})),
}));

describe('BedrockService', () => {
  let service: BedrockService;
  const mockSend = jest.fn();

  beforeEach(() => {
    service = new BedrockService();
    mockSend.mockClear();
    (service as any).client = { send: mockSend };
  });

  describe('Content Generation', () => {
    const mockClaudeResponse = {
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'Generated content here' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 100,
          output_tokens: 200,
        },
      })),
    };

    const mockTitanResponse = {
      body: new TextEncoder().encode(JSON.stringify({
        results: [{
          outputText: 'Generated content here',
          completionReason: 'FINISH',
          tokenCount: 200,
        }],
        inputTextTokenCount: 100,
      })),
    };

    it('should generate blog post content', async () => {
      mockSend.mockResolvedValue(mockClaudeResponse);

      const result = await service.generateContent({
        contentIdea: 'How to improve productivity',
        contentType: 'blog-post',
        intent: 'educational',
      });

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.contentType).toBe('blog-post');
      expect(result.metadata.wordCount).toBeGreaterThan(0);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should generate social media post content', async () => {
      mockSend.mockResolvedValue(mockClaudeResponse);

      const result = await service.generateContent({
        contentIdea: 'New product launch',
        contentType: 'social-post',
        platform: 'twitter',
        intent: 'promotional',
      });

      expect(result).toHaveProperty('content');
      expect(result.metadata.contentType).toBe('social-post');
      expect(result.metadata.platform).toBe('twitter');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should generate caption content', async () => {
      mockSend.mockResolvedValue(mockClaudeResponse);

      const result = await service.generateContent({
        contentIdea: 'Behind the scenes photo',
        contentType: 'caption',
        platform: 'instagram',
        intent: 'entertainment',
      });

      expect(result).toHaveProperty('content');
      expect(result.metadata.contentType).toBe('caption');
      expect(result.metadata.platform).toBe('instagram');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should generate script content', async () => {
      mockSend.mockResolvedValue(mockClaudeResponse);

      const result = await service.generateContent({
        contentIdea: 'Tutorial video script',
        contentType: 'script',
        intent: 'educational',
        duration: 120,
      });

      expect(result).toHaveProperty('content');
      expect(result.metadata.contentType).toBe('script');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should work with Titan models', async () => {
      mockSend.mockResolvedValue(mockTitanResponse);

      const result = await service.generateContent({
        contentIdea: 'Test content',
        contentType: 'social-post',
        platform: 'twitter',
        intent: 'informational',
        modelId: BEDROCK_MODELS.TITAN_TEXT_G1_EXPRESS,
      });

      expect(result).toHaveProperty('content');
      expect(result.metadata.tokenUsage.inputTokens).toBe(100);
      expect(result.metadata.tokenUsage.outputTokens).toBe(200);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should generate multiple variations when requested', async () => {
      mockSend.mockResolvedValue(mockClaudeResponse);

      const result = await service.generateContent({
        contentIdea: 'Test content',
        contentType: 'social-post',
        platform: 'twitter',
        intent: 'informational',
        variations: 3,
      });

      expect(result).toHaveProperty('variations');
      expect(result.variations).toHaveLength(2); // 3 total - 1 main = 2 variations
      expect(mockSend).toHaveBeenCalledTimes(3); // 1 main + 2 variations
    });

    it('should handle audience and preferences', async () => {
      mockSend.mockResolvedValue(mockClaudeResponse);

      const audience: AudienceProfile = {
        profileId: 'profile_1',
        userId: 'user_1',
        demographics: {
          ageRange: '25-34',
          location: 'US',
          interests: ['technology', 'productivity'],
        },
        behaviorPatterns: {
          preferredContentTypes: ['blog-post'],
          engagementTimes: ['morning'],
          platformUsage: {
            twitter: {
              frequency: 'daily',
              engagementRate: 0.05,
              preferredContentLength: 'short',
              bestPostingTimes: ['9am', '1pm'],
            },
          } as any,
        },
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const preferences: UserPreferences = {
        brandVoice: 'professional',
        targetAudience: audience,
        preferredPlatforms: ['twitter'],
        contentStyle: 'informative',
      };

      const result = await service.generateContent({
        contentIdea: 'Productivity tips',
        contentType: 'blog-post',
        intent: 'educational',
        audience,
        preferences,
      });

      expect(result).toHaveProperty('content');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle throttling errors', async () => {
      const throttlingError = new Error('Request throttled');
      throttlingError.name = 'ThrottlingException';
      mockSend.mockRejectedValue(throttlingError);

      await expect(service.generateContent({
        contentIdea: 'Test',
        contentType: 'social-post',
        platform: 'twitter',
        intent: 'informational',
      })).rejects.toThrow('Bedrock service is currently throttled');
    });

    it('should handle validation errors', async () => {
      const validationError = new Error('Invalid parameters');
      validationError.name = 'ValidationException';
      mockSend.mockRejectedValue(validationError);

      await expect(service.generateContent({
        contentIdea: 'Test',
        contentType: 'social-post',
        platform: 'twitter',
        intent: 'informational',
      })).rejects.toThrow('Invalid request parameters');
    });

    it('should handle model not ready errors', async () => {
      const modelError = new Error('Model not ready');
      modelError.name = 'ModelNotReadyException';
      mockSend.mockRejectedValue(modelError);

      await expect(service.generateContent({
        contentIdea: 'Test',
        contentType: 'social-post',
        platform: 'twitter',
        intent: 'informational',
      })).rejects.toThrow('Model anthropic.claude-3-sonnet-20240229-v1:0 is not ready');
    });

    it('should require platform for social posts', async () => {
      await expect(service.generateContent({
        contentIdea: 'Test',
        contentType: 'social-post',
        intent: 'informational',
      })).rejects.toThrow('Platform is required for social media posts');
    });

    it('should require platform for captions', async () => {
      await expect(service.generateContent({
        contentIdea: 'Test',
        contentType: 'caption',
        intent: 'informational',
      })).rejects.toThrow('Platform is required for captions');
    });

    it('should handle unsupported content types', async () => {
      await expect(service.generateContent({
        contentIdea: 'Test',
        contentType: 'unsupported' as any,
        intent: 'informational',
      })).rejects.toThrow('Unsupported content type');
    });

    it('should handle unsupported models', async () => {
      await expect(service.generateContent({
        contentIdea: 'Test',
        contentType: 'social-post',
        platform: 'twitter',
        intent: 'informational',
        modelId: 'unsupported-model',
      })).rejects.toThrow('Unsupported model');
    });
  });

  describe('Utility Functions', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{ text: 'Generated content' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 200 },
        })),
      });
    });

    it('should generate blog post using utility function', async () => {
      const result = await generateBlogPost('Test idea', null, null, 'educational');
      expect(result.metadata.contentType).toBe('blog-post');
    });

    it('should generate social post using utility function', async () => {
      const result = await generateSocialPost('Test idea', 'twitter', null, null, 'promotional');
      expect(result.metadata.contentType).toBe('social-post');
      expect(result.metadata.platform).toBe('twitter');
    });

    it('should generate caption using utility function', async () => {
      const result = await generateCaption('Test idea', 'instagram', null, null, 'entertainment');
      expect(result.metadata.contentType).toBe('caption');
      expect(result.metadata.platform).toBe('instagram');
    });

    it('should generate script using utility function', async () => {
      const result = await generateScript('Test idea', 90, null, null, 'educational');
      expect(result.metadata.contentType).toBe('script');
    });
  });

  describe('Service Methods', () => {
    it('should test connection successfully', async () => {
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{ text: 'Test response' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 20 },
        })),
      });

      const result = await service.testConnection();
      expect(result).toBe(true);
    });

    it('should handle connection test failure', async () => {
      mockSend.mockRejectedValue(new Error('Connection failed'));

      const result = await service.testConnection();
      expect(result).toBe(false);
    });

    it('should return available models', () => {
      const models = service.getAvailableModels();
      expect(models).toContain(BEDROCK_MODELS.CLAUDE_3_SONNET);
      expect(models).toContain(BEDROCK_MODELS.TITAN_TEXT_G1_EXPRESS);
    });

    it('should return model parameters', () => {
      const params = service.getModelParameters(BEDROCK_MODELS.CLAUDE_3_SONNET);
      expect(params).toHaveProperty('maxTokens');
      expect(params).toHaveProperty('temperature');
      expect(params).toHaveProperty('topP');
    });
  });
});

describe('PromptTemplates', () => {
  const mockAudience: AudienceProfile = {
    profileId: 'profile_1',
    userId: 'user_1',
    demographics: {
      ageRange: '25-34',
      location: 'US',
      interests: ['technology'],
    },
    behaviorPatterns: {
      preferredContentTypes: ['blog-post'],
      engagementTimes: ['morning'],
      platformUsage: {} as any,
    },
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockPreferences: UserPreferences = {
    brandVoice: 'professional',
    targetAudience: mockAudience,
    preferredPlatforms: ['twitter'],
    contentStyle: 'informative',
  };

  it('should generate blog post prompt', () => {
    const prompt = PromptTemplates.getBlogPostPrompt(
      'How to be productive',
      mockAudience,
      mockPreferences,
      'educational'
    );

    expect(prompt).toContain('How to be productive');
    expect(prompt).toContain('25-34');
    expect(prompt).toContain('professional');
    expect(prompt).toContain('educational');
    expect(prompt).toContain('800-2000 words');
  });

  it('should generate social media prompt', () => {
    const prompt = PromptTemplates.getSocialMediaPrompt(
      'New product launch',
      'twitter',
      mockAudience,
      mockPreferences,
      'promotional'
    );

    expect(prompt).toContain('New product launch');
    expect(prompt).toContain('twitter');
    expect(prompt).toContain('promotional');
    expect(prompt).toContain('280'); // Twitter character limit
  });

  it('should generate caption prompt', () => {
    const prompt = PromptTemplates.getCaptionPrompt(
      'Behind the scenes',
      'instagram',
      mockAudience,
      mockPreferences,
      'entertainment'
    );

    expect(prompt).toContain('Behind the scenes');
    expect(prompt).toContain('instagram');
    expect(prompt).toContain('entertainment');
    expect(prompt).toContain('emojis');
  });

  it('should generate script prompt', () => {
    const prompt = PromptTemplates.getScriptPrompt(
      'Tutorial video',
      mockAudience,
      mockPreferences,
      'educational',
      120
    );

    expect(prompt).toContain('Tutorial video');
    expect(prompt).toContain('educational');
    expect(prompt).toContain('120 seconds');
    expect(prompt).toContain('timing cues');
  });

  it('should handle null audience and preferences', () => {
    const prompt = PromptTemplates.getBlogPostPrompt(
      'Test content',
      null,
      null,
      'informational'
    );

    expect(prompt).toContain('Test content');
    expect(prompt).toContain('informational');
    expect(prompt).toContain('professional and engaging'); // Default brand voice
  });
});