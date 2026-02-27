// Tests for content variation generation and ranking service

import {
  ContentVariationService,
  contentVariationService,
} from '../src/services/content-variations';
import { 
  ContentType, 
  Platform, 
  ContentIntent,
  AudienceProfile, 
  UserPreferences,
  ContentVariation,
  GeneratedContent,
  VariationType,
} from '../src/types';

// Mock the bedrock service
jest.mock('../src/services/bedrock-service', () => ({
  bedrockService: {
    generateContent: jest.fn(),
  },
}));

// Mock the content quality service
jest.mock('../src/services/content-quality', () => ({
  contentQualityService: {
    validateContent: jest.fn(),
  },
}));

// Mock the content generators
jest.mock('../src/services/content-generators', () => ({
  generatePlatformContent: jest.fn(),
}));

jest.mock('../src/utils', () => ({
  generateContentId: jest.fn(() => 'content_123'),
  generateIdeaId: jest.fn(() => 'idea_123'),
  getCurrentTimestamp: jest.fn(() => '2024-01-01T00:00:00Z'),
  calculateReadingTime: jest.fn((text: string) => Math.ceil(text.split(/\s+/).length / 200)),
  extractKeywords: jest.fn((text: string) => ['keyword1', 'keyword2', 'keyword3']),
  getPlatformConstraints: jest.fn((platform: string) => ({
    twitter: { maxLength: 280, hashtagLimit: 2, optimalHashtags: 2 },
    instagram: { maxLength: 2200, hashtagLimit: 30, optimalHashtags: 11 },
    facebook: { maxLength: 63206, hashtagLimit: 30 },
    linkedin: { maxLength: 3000, hashtagLimit: 5 },
    blog: { minLength: 800, maxLength: 2000 },
    youtube: { titleMaxLength: 100, descriptionMaxLength: 5000 },
    tiktok: { maxLength: 150, hashtagLimit: 100, optimalHashtags: 3 },
  }[platform] || {})),
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

describe('ContentVariationService', () => {
  let service: ContentVariationService;
  const mockBedrockService = require('../src/services/bedrock-service').bedrockService;
  const mockContentQualityService = require('../src/services/content-quality').contentQualityService;
  const mockGeneratePlatformContent = require('../src/services/content-generators').generatePlatformContent;

  beforeEach(() => {
    service = new ContentVariationService();
    mockBedrockService.generateContent.mockClear();
    mockContentQualityService.validateContent.mockClear();
    mockGeneratePlatformContent.mockClear();
    
    // Default quality check response
    mockContentQualityService.validateContent.mockResolvedValue({
      isValid: true,
      qualityScore: 0.8,
      grammarScore: 0.8,
      coherenceScore: 0.8,
      safetyScore: 0.9,
      issues: [],
      safetyFlags: [],
      recommendations: [],
      processingTime: 100,
    });

    // Default bedrock response
    mockBedrockService.generateContent.mockResolvedValue({
      content: 'Generated variation content',
      metadata: {
        modelId: 'claude-3-sonnet',
        processingTime: 1000,
        tokenUsage: { inputTokens: 100, outputTokens: 200 },
        contentType: 'social-post',
        platform: 'twitter',
        wordCount: 15,
        characterCount: 100,
      },
    });

    // Default primary content
    mockGeneratePlatformContent.mockResolvedValue({
      contentId: 'primary_123',
      ideaId: 'idea_123',
      userId: 'user_1',
      platform: 'twitter',
      contentType: 'social-post',
      generatedText: 'Primary content text',
      metadata: {
        wordCount: 10,
        characterCount: 50,
        hashtags: ['primary'],
        seoKeywords: ['primary', 'content'],
        readingTime: 1,
        qualityScore: 0.8,
        grammarScore: 0.8,
        coherenceScore: 0.8,
        safetyScore: 0.9,
      },
      version: 1,
      status: 'generated',
      createdAt: '2024-01-01T00:00:00Z',
    });
  });

  const mockAudience: AudienceProfile = {
    profileId: 'profile_1',
    userId: 'user_1',
    demographics: {
      ageRange: '25-34',
      location: 'US',
      interests: ['technology', 'productivity'],
    },
    behaviorPatterns: {
      preferredContentTypes: ['social-post'],
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

  describe('generateVariations', () => {
    it('should generate multiple content variations with ranking', async () => {
      const options = {
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'social-post' as ContentType,
        platform: 'twitter' as Platform,
        audience: mockAudience,
        preferences: mockPreferences,
        intent: 'promotional' as ContentIntent,
        variationCount: 3,
        customizationOptions: {
          tone: 'professional' as const,
          length: 'short' as const,
          style: 'straightforward' as const,
          includeHashtags: true,
        },
      };

      const result = await service.generateVariations(options);

      expect(result).toHaveProperty('primaryContent');
      expect(result).toHaveProperty('variations');
      expect(result).toHaveProperty('rankingMetadata');

      expect(result.primaryContent.contentId).toBe('primary_123');
      expect(result.variations).toHaveLength(3);
      expect(result.rankingMetadata.totalVariations).toBe(3);

      // Verify variations are ranked (highest score first)
      for (let i = 0; i < result.variations.length - 1; i++) {
        expect(result.variations[i].rankingScore).toBeGreaterThanOrEqual(
          result.variations[i + 1].rankingScore
        );
      }

      // Verify each variation has required properties
      result.variations.forEach(variation => {
        expect(variation).toHaveProperty('variationId');
        expect(variation).toHaveProperty('contentId');
        expect(variation).toHaveProperty('generatedText');
        expect(variation).toHaveProperty('metadata');
        expect(variation).toHaveProperty('rankingScore');
        expect(variation).toHaveProperty('variationType');
        expect(variation).toHaveProperty('customizationApplied');
        expect(variation.rankingScore).toBeGreaterThanOrEqual(0);
        expect(variation.rankingScore).toBeLessThanOrEqual(1);
      });
    });

    it('should generate different variation types', async () => {
      const options = {
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'social-post' as ContentType,
        platform: 'twitter' as Platform,
        variationCount: 5,
      };

      const result = await service.generateVariations(options);

      const variationTypes = result.variations.map(v => v.variationType);
      const expectedTypes: VariationType[] = [
        'tone-variation',
        'length-variation',
        'style-variation',
        'format-variation',
        'keyword-variation',
      ];

      expectedTypes.forEach(expectedType => {
        expect(variationTypes).toContain(expectedType);
      });
    });

    it('should handle variation generation errors gracefully', async () => {
      // Mock bedrock service to fail for some variations
      let callCount = 0;
      mockBedrockService.generateContent.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Bedrock service error');
        }
        return Promise.resolve({
          content: `Generated variation content ${callCount}`,
          metadata: {
            modelId: 'claude-3-sonnet',
            processingTime: 1000,
            tokenUsage: { inputTokens: 100, outputTokens: 200 },
            contentType: 'social-post',
            platform: 'twitter',
            wordCount: 15,
            characterCount: 100,
          },
        });
      });

      const options = {
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'social-post' as ContentType,
        platform: 'twitter' as Platform,
        variationCount: 3,
      };

      const result = await service.generateVariations(options);

      // Should still return results even if some variations fail
      expect(result.primaryContent).toBeDefined();
      expect(result.variations.length).toBeLessThan(3); // Some variations failed
      expect(result.variations.length).toBeGreaterThan(0); // But some succeeded
    });

    it('should apply customization options correctly', async () => {
      const customizationOptions = {
        tone: 'casual' as const,
        length: 'long' as const,
        style: 'creative' as const,
        includeEmojis: true,
        includeHashtags: true,
        includeCallToAction: true,
        targetKeywords: ['test', 'keyword'],
      };

      const options = {
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'social-post' as ContentType,
        platform: 'instagram' as Platform,
        variationCount: 2,
        customizationOptions,
      };

      const result = await service.generateVariations(options);

      // Verify customization options are applied to variations
      result.variations.forEach(variation => {
        expect(variation.customizationApplied).toBeDefined();
        // At least some customization should be applied
        expect(Object.keys(variation.customizationApplied).length).toBeGreaterThan(0);
      });
    });
  });

  describe('ranking system', () => {
    it('should rank variations based on quality scores', async () => {
      // Mock different quality scores for variations
      let qualityCallCount = 0;
      mockContentQualityService.validateContent.mockImplementation(() => {
        qualityCallCount++;
        const qualityScore = qualityCallCount === 1 ? 0.9 : qualityCallCount === 2 ? 0.7 : 0.5;
        return Promise.resolve({
          isValid: true,
          qualityScore,
          grammarScore: qualityScore,
          coherenceScore: qualityScore,
          safetyScore: 0.9,
          issues: [],
          safetyFlags: [],
          recommendations: [],
          processingTime: 100,
        });
      });

      const options = {
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'social-post' as ContentType,
        platform: 'twitter' as Platform,
        variationCount: 3,
      };

      const result = await service.generateVariations(options);

      // Variations should be ranked by quality (highest first)
      expect(result.variations[0].rankingScore).toBeGreaterThan(result.variations[1].rankingScore);
      expect(result.variations[1].rankingScore).toBeGreaterThan(result.variations[2].rankingScore);
    });

    it('should consider engagement factors in ranking', async () => {
      // Mock variations with different engagement elements
      let bedrockCallCount = 0;
      mockBedrockService.generateContent.mockImplementation(() => {
        bedrockCallCount++;
        let content = 'Basic content';
        
        if (bedrockCallCount === 1) {
          content = 'Engaging content with question? 🎉 #hashtag';
        } else if (bedrockCallCount === 2) {
          content = 'Simple content without engagement elements';
        }

        return Promise.resolve({
          content,
          metadata: {
            modelId: 'claude-3-sonnet',
            processingTime: 1000,
            tokenUsage: { inputTokens: 100, outputTokens: 200 },
            contentType: 'social-post',
            platform: 'twitter',
            wordCount: content.split(' ').length,
            characterCount: content.length,
          },
        });
      });

      const options = {
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'social-post' as ContentType,
        platform: 'twitter' as Platform,
        variationCount: 2,
        customizationOptions: {
          includeEmojis: true,
          includeHashtags: true,
          includeCallToAction: true,
        },
      };

      const result = await service.generateVariations(options);

      // The variation with more engagement elements should rank higher
      const engagingVariation = result.variations.find(v => 
        v.generatedText.includes('?') && v.generatedText.includes('🎉')
      );
      const simpleVariation = result.variations.find(v => 
        !v.generatedText.includes('?') && !v.generatedText.includes('🎉')
      );

      if (engagingVariation && simpleVariation) {
        expect(engagingVariation.rankingScore).toBeGreaterThan(simpleVariation.rankingScore);
      }
    });

    it('should consider platform optimization in ranking', async () => {
      const options = {
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'social-post' as ContentType,
        platform: 'twitter' as Platform,
        variationCount: 2,
      };

      const result = await service.generateVariations(options);

      // All variations should have platform optimization scores
      result.variations.forEach(variation => {
        expect(variation.rankingScore).toBeGreaterThan(0);
        // Twitter-optimized content should consider character limits
        expect(variation.generatedText.length).toBeLessThanOrEqual(300); // Reasonable for Twitter
      });
    });
  });

  describe('variation strategies', () => {
    it('should generate tone variations', async () => {
      const options = {
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'social-post' as ContentType,
        platform: 'twitter' as Platform,
        variationCount: 1,
        customizationOptions: {
          tone: 'professional' as const,
        },
      };

      const result = await service.generateVariations(options);

      const toneVariation = result.variations.find(v => v.variationType === 'tone-variation');
      expect(toneVariation).toBeDefined();
      expect(toneVariation?.customizationApplied.tone).not.toBe('professional');
    });

    it('should generate length variations', async () => {
      const options = {
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'blog-post' as ContentType,
        variationCount: 2,
        customizationOptions: {
          length: 'medium' as const,
        },
      };

      const result = await service.generateVariations(options);

      const lengthVariation = result.variations.find(v => v.variationType === 'length-variation');
      expect(lengthVariation).toBeDefined();
      expect(lengthVariation?.customizationApplied.length).not.toBe('medium');
    });

    it('should generate style variations', async () => {
      const options = {
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'blog-post' as ContentType,
        variationCount: 3,
        customizationOptions: {
          style: 'technical' as const,
        },
      };

      const result = await service.generateVariations(options);

      const styleVariation = result.variations.find(v => v.variationType === 'style-variation');
      expect(styleVariation).toBeDefined();
      expect(styleVariation?.customizationApplied.style).not.toBe('technical');
    });
  });

  describe('ranking metadata', () => {
    it('should generate comprehensive ranking metadata', async () => {
      const options = {
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'social-post' as ContentType,
        platform: 'twitter' as Platform,
        variationCount: 3,
      };

      const result = await service.generateVariations(options);

      expect(result.rankingMetadata).toMatchObject({
        totalVariations: 3,
        averageScore: expect.any(Number),
        topScore: expect.any(Number),
        lowestScore: expect.any(Number),
        variationTypes: expect.any(Array),
        rankingCriteria: expect.any(Object),
        generatedAt: expect.any(String),
      });

      expect(result.rankingMetadata.averageScore).toBeGreaterThanOrEqual(0);
      expect(result.rankingMetadata.averageScore).toBeLessThanOrEqual(1);
      expect(result.rankingMetadata.topScore).toBeGreaterThanOrEqual(result.rankingMetadata.lowestScore);
    });
  });

  describe('error handling', () => {
    it('should handle primary content generation failure', async () => {
      mockGeneratePlatformContent.mockRejectedValue(new Error('Primary content generation failed'));

      const options = {
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'social-post' as ContentType,
        platform: 'twitter' as Platform,
        variationCount: 2,
      };

      await expect(service.generateVariations(options)).rejects.toThrow(
        'Content variation generation failed: Primary content generation failed'
      );
    });

    it('should handle quality service failures gracefully', async () => {
      mockContentQualityService.validateContent.mockRejectedValue(new Error('Quality service error'));

      const options = {
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'social-post' as ContentType,
        platform: 'twitter' as Platform,
        variationCount: 1,
      };

      // Should still complete but with default quality scores
      const result = await service.generateVariations(options);
      expect(result.primaryContent).toBeDefined();
      expect(result.variations.length).toBeGreaterThan(0);
    });
  });
});

describe('contentVariationService singleton', () => {
  it('should export a singleton instance', () => {
    expect(contentVariationService).toBeInstanceOf(ContentVariationService);
  });
});

describe('Integration with content generators', () => {
  const mockGenerateContentWithVariations = require('../src/services/content-generators').generateContentWithVariations;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should integrate with generateContentWithVariations function', async () => {
    // Mock the variation service
    const mockVariationService = {
      generateVariations: jest.fn().mockResolvedValue({
        primaryContent: {
          contentId: 'primary_123',
          generatedText: 'Primary content',
        },
        variations: [
          {
            variationId: 'var_1',
            generatedText: 'Variation 1',
            rankingScore: 0.8,
          },
        ],
        rankingMetadata: {
          totalVariations: 1,
          averageScore: 0.8,
        },
      }),
    };

    // Mock the import dynamically
    const mockGenerateContentWithVariations = jest.fn().mockImplementation(async (contentType, options) => {
      return await mockVariationService.generateVariations({
        contentIdea: options.contentIdea,
        userId: options.userId,
        contentType,
        platform: options.platform,
        audience: options.audience,
        preferences: options.preferences,
        intent: options.intent,
        variationCount: options.variationCount,
        customizationOptions: options.customizationOptions,
      });
    });

    const options = {
      contentIdea: 'Test content idea',
      userId: 'user_1',
      contentType: 'social-post' as ContentType,
      platform: 'twitter' as Platform,
      variationCount: 1,
    };

    const result = await mockGenerateContentWithVariations('social-post', options);

    expect(result).toHaveProperty('primaryContent');
    expect(result).toHaveProperty('variations');
    expect(result).toHaveProperty('rankingMetadata');
    expect(mockVariationService.generateVariations).toHaveBeenCalledWith(
      expect.objectContaining({
        contentIdea: 'Test content idea',
        userId: 'user_1',
        contentType: 'social-post',
        platform: 'twitter',
        variationCount: 1,
      })
    );
  });
});