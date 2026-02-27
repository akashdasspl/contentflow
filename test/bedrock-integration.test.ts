// Integration tests for Amazon Bedrock service

import { 
  PromptTemplates,
  BEDROCK_MODELS,
} from '../src/services/bedrock';
import { BedrockService } from '../src/services/bedrock-service';
import { 
  ContentIntent, 
  Platform, 
  AudienceProfile, 
  UserPreferences 
} from '../src/types';

describe('Bedrock Integration', () => {
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
      expect(prompt).toContain('Character Limit');
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

  describe('BedrockService Configuration', () => {
    it('should have correct model configurations', () => {
      expect(BEDROCK_MODELS.CLAUDE_3_SONNET).toBe('anthropic.claude-3-sonnet-20240229-v1:0');
      expect(BEDROCK_MODELS.CLAUDE_3_HAIKU).toBe('anthropic.claude-3-haiku-20240307-v1:0');
      expect(BEDROCK_MODELS.TITAN_TEXT_G1_EXPRESS).toBe('amazon.titan-text-express-v1');
    });

    it('should create BedrockService instance', () => {
      const service = new BedrockService();
      expect(service).toBeInstanceOf(BedrockService);
      expect(service.getAvailableModels).toBeDefined();
      expect(service.getModelParameters).toBeDefined();
      expect(service.testConnection).toBeDefined();
      expect(service.generateContent).toBeDefined();
    });

    it('should return available models', () => {
      const service = new BedrockService();
      const models = service.getAvailableModels();
      
      expect(Array.isArray(models)).toBe(true);
      expect(models).toContain(BEDROCK_MODELS.CLAUDE_3_SONNET);
      expect(models).toContain(BEDROCK_MODELS.TITAN_TEXT_G1_EXPRESS);
    });

    it('should return model parameters', () => {
      const service = new BedrockService();
      const params = service.getModelParameters(BEDROCK_MODELS.CLAUDE_3_SONNET);
      
      expect(params).toHaveProperty('maxTokens');
      expect(params).toHaveProperty('temperature');
      expect(params).toHaveProperty('topP');
      expect(typeof params.maxTokens).toBe('number');
      expect(typeof params.temperature).toBe('number');
    });
  });

  describe('Content Generation Options Validation', () => {
    let service: BedrockService;

    beforeEach(() => {
      service = new BedrockService();
    });

    it('should validate required platform for social posts', async () => {
      await expect(service.generateContent({
        contentIdea: 'Test',
        contentType: 'social-post',
        intent: 'informational',
      })).rejects.toThrow('Platform is required for social media posts');
    });

    it('should validate required platform for captions', async () => {
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
  });

  describe('Content Extraction', () => {
    let service: BedrockService;

    beforeEach(() => {
      service = new BedrockService();
    });

    it('should extract content for blog posts', () => {
      const rawContent = 'Here is the content: # My Blog Post\n\nThis is the content.';
      const extracted = (service as any)._extractContent(rawContent, 'blog-post');
      
      expect(extracted).toContain('# My Blog Post');
      expect(extracted).toContain('This is the content.');
      expect(extracted).not.toContain('Here is the content:');
    });

    it('should extract content for social posts', () => {
      const rawContent = 'POST_TEXT: This is a great social media post!';
      const extracted = (service as any)._extractContent(rawContent, 'social-post');
      
      expect(extracted).toBe('This is a great social media post!');
      expect(extracted).not.toContain('POST_TEXT:');
    });

    it('should extract content for captions', () => {
      const rawContent = 'CAPTION: Amazing photo! 📸 #photography';
      const extracted = (service as any)._extractContent(rawContent, 'caption');
      
      expect(extracted).toBe('Amazing photo! 📸 #photography');
      expect(extracted).not.toContain('CAPTION:');
    });

    it('should handle script content', () => {
      const rawContent = 'TITLE: My Script\n\n[00:00-00:05] INTRO: Welcome to the show!';
      const extracted = (service as any)._extractContent(rawContent, 'script');
      
      expect(extracted).toContain('TITLE: My Script');
      expect(extracted).toContain('[00:00-00:05] INTRO: Welcome to the show!');
    });

    it('should add basic structure for missing script format', () => {
      const rawContent = 'Welcome to the show! This is the content.';
      const extracted = (service as any)._extractContent(rawContent, 'script');
      
      expect(extracted).toContain('TITLE: Generated Script');
      expect(extracted).toContain('Welcome to the show!');
    });
  });

  describe('Prompt Building', () => {
    let service: BedrockService;

    beforeEach(() => {
      service = new BedrockService();
    });

    it('should build blog post prompt', () => {
      const prompt = (service as any)._buildPrompt({
        contentIdea: 'Test idea',
        contentType: 'blog-post',
        intent: 'educational',
      });

      expect(prompt).toContain('Test idea');
      expect(prompt).toContain('educational');
      expect(prompt).toContain('blog post');
    });

    it('should build social media prompt with platform', () => {
      const prompt = (service as any)._buildPrompt({
        contentIdea: 'Test idea',
        contentType: 'social-post',
        platform: 'twitter',
        intent: 'promotional',
      });

      expect(prompt).toContain('Test idea');
      expect(prompt).toContain('twitter');
      expect(prompt).toContain('promotional');
    });

    it('should build caption prompt with platform', () => {
      const prompt = (service as any)._buildPrompt({
        contentIdea: 'Test idea',
        contentType: 'caption',
        platform: 'instagram',
        intent: 'entertainment',
      });

      expect(prompt).toContain('Test idea');
      expect(prompt).toContain('instagram');
      expect(prompt).toContain('entertainment');
    });

    it('should build script prompt with duration', () => {
      const prompt = (service as any)._buildPrompt({
        contentIdea: 'Test idea',
        contentType: 'script',
        intent: 'educational',
        duration: 90,
      });

      expect(prompt).toContain('Test idea');
      expect(prompt).toContain('educational');
      expect(prompt).toContain('90 seconds');
    });

    it('should handle email and ad-copy content types', () => {
      const emailPrompt = (service as any)._buildPrompt({
        contentIdea: 'Test idea',
        contentType: 'email',
        intent: 'promotional',
      });

      const adPrompt = (service as any)._buildPrompt({
        contentIdea: 'Test idea',
        contentType: 'ad-copy',
        intent: 'promotional',
      });

      expect(emailPrompt).toContain('Test idea');
      expect(adPrompt).toContain('Test idea');
    });
  });
});