// Property-based tests for brand voice consistency
// **Validates: Requirements 3.5, 4.2**

import fc from 'fast-check';
import { brandVoiceConsistencyEngine } from '../src/services/brand-voice-consistency';
import { bedrockService } from '../src/services/bedrock-service';
import { 
  GeneratedContent, 
  UserPreferences, 
  Platform,
  ContentType,
  AudienceProfile,
} from '../src/types';

// Mock the bedrock service
jest.mock('../src/services/bedrock-service');
const mockBedrockService = bedrockService as jest.Mocked<typeof bedrockService>;

/**
 * Property-based tests for brand voice consistency
 * **Validates: Requirements 3.5, 4.2**
 */
describe('Brand Voice Consistency Properties', () => {
  const mockAudience: AudienceProfile = {
    profileId: 'profile-123',
    userId: 'user-123',
    demographics: {
      ageRange: '25-45',
      location: 'Global',
      interests: ['technology', 'business'],
    },
    behaviorPatterns: {
      preferredContentTypes: ['blog-post', 'social-post'],
      engagementTimes: ['9:00 AM', '2:00 PM'],
      platformUsage: {
        blog: {
          frequency: 'weekly',
          engagementRate: 0.06,
          preferredContentLength: 'long',
          bestPostingTimes: ['10:00 AM'],
        },
        twitter: {
          frequency: 'daily',
          engagementRate: 0.05,
          preferredContentLength: 'short',
          bestPostingTimes: ['9:00 AM'],
        },
        facebook: {
          frequency: 'weekly',
          engagementRate: 0.04,
          preferredContentLength: 'medium',
          bestPostingTimes: ['7:00 PM'],
        },
        instagram: {
          frequency: 'daily',
          engagementRate: 0.07,
          preferredContentLength: 'short',
          bestPostingTimes: ['6:00 PM'],
        },
        linkedin: {
          frequency: 'weekly',
          engagementRate: 0.08,
          preferredContentLength: 'medium',
          bestPostingTimes: ['2:00 PM'],
        },
        youtube: {
          frequency: 'monthly',
          engagementRate: 0.03,
          preferredContentLength: 'long',
          bestPostingTimes: ['8:00 PM'],
        },
        tiktok: {
          frequency: 'daily',
          engagementRate: 0.09,
          preferredContentLength: 'short',
          bestPostingTimes: ['7:00 PM'],
        },
      },
    },
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful Bedrock responses
    mockBedrockService.generateContent.mockResolvedValue({
      content: 'Adapted content with consistent brand voice',
      metadata: {
        modelId: 'claude-v2',
        processingTime: 1000,
        tokenUsage: {
          inputTokens: 100,
          outputTokens: 50,
        },
        contentType: 'blog-post',
        wordCount: 8,
        characterCount: 45,
      },
    });
  });

  // Arbitraries for generating test data
  const platformArb = fc.constantFrom<Platform>(
    'blog',
    'twitter',
    'facebook',
    'instagram',
    'linkedin',
    'youtube',
    'tiktok'
  );

  const contentTypeArb = fc.constantFrom<ContentType>(
    'blog-post',
    'social-post',
    'caption',
    'script'
  );

  const brandVoiceArb = fc.oneof(
    fc.constantFrom(
      'professional and approachable',
      'friendly and casual',
      'authoritative and expert',
      'warm and empathetic',
      'innovative and forward-thinking',
      'trustworthy and reliable',
      'energetic and enthusiastic',
      'calm and reassuring'
    ),
    fc.tuple(
      fc.constantFrom('professional', 'friendly', 'authoritative', 'casual', 'warm'),
      fc.constantFrom('and', 'yet', 'but'),
      fc.constantFrom('approachable', 'knowledgeable', 'trustworthy', 'innovative', 'empathetic')
    ).map(([a, b, c]) => `${a} ${b} ${c}`)
  );

  const contentTextArb = fc.oneof(
    fc.constantFrom(
      'This is a comprehensive guide to understanding modern business strategies.',
      'Learn how to improve your productivity with these proven techniques.',
      'Discover the benefits of innovative solutions for your business.',
      'Explore the latest trends in technology and digital transformation.',
      'Understanding the fundamentals of effective communication is essential.'
    ),
    fc.tuple(
      fc.constantFrom('Discover', 'Learn', 'Explore', 'Understand', 'Master'),
      fc.constantFrom('how to', 'the best ways to', 'effective strategies for', 'proven methods to'),
      fc.constantFrom('improve', 'enhance', 'optimize', 'transform', 'revolutionize'),
      fc.constantFrom('your business', 'your workflow', 'your strategy', 'your approach', 'your results')
    ).map(([a, b, c, d]) => `${a} ${b} ${c} ${d}.`)
  );

  const createMockContent = (
    text: string,
    platform: Platform,
    contentType: ContentType,
    userId: string = 'user-123'
  ): GeneratedContent => ({
    contentId: `content_${Date.now()}_${Math.random()}`,
    ideaId: 'idea_123',
    userId,
    platform,
    contentType,
    generatedText: text,
    metadata: {
      wordCount: text.split(/\s+/).length,
      hashtags: [],
      seoKeywords: [],
      readingTime: Math.ceil(text.split(/\s+/).length / 200),
    },
    version: 1,
    status: 'generated',
    createdAt: new Date().toISOString(),
  });

  const createMockUserPreferences = (brandVoice: string): UserPreferences => ({
    brandVoice,
    targetAudience: mockAudience,
    preferredPlatforms: ['blog', 'twitter', 'linkedin'],
    contentStyle: 'informative',
  });

  /**
   * Property 7: Brand Voice Consistency
   * For any user with defined brand voice preferences, all generated content 
   * across different platforms should maintain consistent tone and style characteristics
   * **Validates: Requirements 3.5, 4.2**
   */
  describe('Property 7: Brand Voice Consistency', () => {
    it('should maintain consistent brand voice across all platforms', async () => {
      await fc.assert(
        fc.asyncProperty(
          brandVoiceArb,
          contentTextArb,
          async (brandVoice: string, contentText: string) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);
            const platforms: Platform[] = ['blog', 'twitter', 'facebook', 'instagram', 'linkedin'];
            const results = [];

            // Act - Generate content for multiple platforms
            for (const platform of platforms) {
              const content = createMockContent(contentText, platform, 'social-post');
              
              mockBedrockService.generateContent.mockResolvedValue({
                content: `Adapted content for ${platform} with ${brandVoice} voice`,
                metadata: {
                  modelId: 'claude-v2',
                  processingTime: 1000,
                  tokenUsage: { inputTokens: 100, outputTokens: 50 },
                  contentType: 'social-post',
                  wordCount: 10,
                  characterCount: 50,
                },
              });

              const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
                content,
                userPreferences,
                targetPlatform: platform,
              });

              results.push(result);
            }

            // Assert - All content should have consistent brand voice characteristics
            for (const result of results) {
              // Voice analysis should be consistent
              expect(result.voiceAnalysis).toBeDefined();
              expect(result.voiceAnalysis.characteristics.tone).toBeDefined();
              expect(result.voiceAnalysis.characteristics.formality).toBeDefined();
              
              // Consistency score should be reasonable
              expect(result.consistencyScore).toBeGreaterThanOrEqual(0);
              expect(result.consistencyScore).toBeLessThanOrEqual(1);
              
              // Should have platform-specific adjustments
              expect(result.voiceAnalysis.platformSpecificAdjustments).toBeDefined();
            }

            // All results should have similar voice characteristics
            const tones = results.map(r => r.voiceAnalysis.characteristics.tone);
            const formalities = results.map(r => r.voiceAnalysis.characteristics.formality);
            
            // Tone should be consistent across platforms
            const uniqueTones = new Set(tones);
            expect(uniqueTones.size).toBeLessThanOrEqual(2); // Allow minor variations
            
            // Formality should be consistent or adjacent
            const uniqueFormalities = new Set(formalities);
            expect(uniqueFormalities.size).toBeLessThanOrEqual(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure consistency scores are within valid range for all brand voices', async () => {
      await fc.assert(
        fc.asyncProperty(
          brandVoiceArb,
          contentTextArb,
          platformArb,
          async (brandVoice: string, contentText: string, platform: Platform) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);
            const content = createMockContent(contentText, platform, 'blog-post');

            // Act
            const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
              content,
              userPreferences,
            });

            // Assert - Consistency score must be valid
            expect(result.consistencyScore).toBeGreaterThanOrEqual(0);
            expect(result.consistencyScore).toBeLessThanOrEqual(1);
            expect(typeof result.consistencyScore).toBe('number');
            expect(isNaN(result.consistencyScore)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain brand voice characteristics across different content types', async () => {
      await fc.assert(
        fc.asyncProperty(
          brandVoiceArb,
          contentTextArb,
          platformArb,
          async (brandVoice: string, contentText: string, platform: Platform) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);
            const contentTypes: ContentType[] = ['blog-post', 'social-post', 'caption', 'script'];
            const results = [];

            // Act - Generate content for different content types
            for (const contentType of contentTypes) {
              const content = createMockContent(contentText, platform, contentType);
              
              const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
                content,
                userPreferences,
              });

              results.push(result);
            }

            // Assert - Brand voice should be consistent across content types
            for (const result of results) {
              expect(result.voiceAnalysis.characteristics).toBeDefined();
              expect(result.consistencyScore).toBeGreaterThan(0);
            }

            // Voice characteristics should be similar
            const tones = results.map(r => r.voiceAnalysis.characteristics.tone);
            const uniqueTones = new Set(tones);
            expect(uniqueTones.size).toBeLessThanOrEqual(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect cross-platform consistency for same brand voice', async () => {
      await fc.assert(
        fc.asyncProperty(
          brandVoiceArb,
          contentTextArb,
          async (brandVoice: string, contentText: string) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);
            const blogContent = createMockContent(contentText, 'blog', 'blog-post');
            const twitterContent = createMockContent(contentText, 'twitter', 'social-post');

            // Act - Generate blog content first
            const blogResult = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
              content: blogContent,
              userPreferences,
            });

            // Generate Twitter content with blog as reference
            const twitterResult = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
              content: twitterContent,
              userPreferences,
              crossPlatformReference: [blogContent],
            });

            // Assert - Cross-platform consistency should be checked
            expect(twitterResult.crossPlatformConsistency).toBeDefined();
            expect(twitterResult.crossPlatformConsistency.overallScore).toBeGreaterThanOrEqual(0);
            expect(twitterResult.crossPlatformConsistency.overallScore).toBeLessThanOrEqual(1);
            expect(twitterResult.crossPlatformConsistency.platformScores).toBeDefined();
            expect(twitterResult.crossPlatformConsistency.inconsistencies).toBeInstanceOf(Array);
            expect(twitterResult.crossPlatformConsistency.recommendations).toBeInstanceOf(Array);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide platform-specific adjustments while maintaining brand voice', async () => {
      await fc.assert(
        fc.asyncProperty(
          brandVoiceArb,
          contentTextArb,
          async (brandVoice: string, contentText: string) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);
            const platforms: Platform[] = ['linkedin', 'twitter', 'instagram'];

            // Act & Assert
            for (const platform of platforms) {
              const content = createMockContent(contentText, platform, 'social-post');
              
              const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
                content,
                userPreferences,
                targetPlatform: platform,
              });

              // Should have platform-specific adjustments
              expect(result.voiceAnalysis.platformSpecificAdjustments[platform]).toBeDefined();
              expect(result.voiceAnalysis.platformSpecificAdjustments[platform].platform).toBe(platform);
              expect(result.voiceAnalysis.platformSpecificAdjustments[platform].platformSpecificRules).toBeInstanceOf(Array);
              
              // Should still maintain overall brand voice
              expect(result.consistencyScore).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate consistent style guides for same brand voice', async () => {
      await fc.assert(
        fc.asyncProperty(
          brandVoiceArb,
          contentTextArb,
          platformArb,
          async (brandVoice: string, contentText: string, platform: Platform) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);
            const content1 = createMockContent(contentText, platform, 'blog-post');
            const content2 = createMockContent(contentText, platform, 'social-post');

            // Act
            const result1 = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
              content: content1,
              userPreferences,
            });

            const result2 = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
              content: content2,
              userPreferences,
            });

            // Assert - Style guides should be consistent for same brand voice
            expect(result1.voiceAnalysis.styleGuide).toBeDefined();
            expect(result2.voiceAnalysis.styleGuide).toBeDefined();
            
            expect(result1.voiceAnalysis.styleGuide.writingPrinciples).toBeInstanceOf(Array);
            expect(result2.voiceAnalysis.styleGuide.writingPrinciples).toBeInstanceOf(Array);
            
            expect(result1.voiceAnalysis.styleGuide.dosList).toBeInstanceOf(Array);
            expect(result2.voiceAnalysis.styleGuide.dosList).toBeInstanceOf(Array);
            
            expect(result1.voiceAnalysis.styleGuide.dontsList).toBeInstanceOf(Array);
            expect(result2.voiceAnalysis.styleGuide.dontsList).toBeInstanceOf(Array);
            
            // Writing principles should be similar
            expect(result1.voiceAnalysis.styleGuide.writingPrinciples.length).toBeGreaterThan(0);
            expect(result2.voiceAnalysis.styleGuide.writingPrinciples.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain tone consistency across all generated content', async () => {
      await fc.assert(
        fc.asyncProperty(
          brandVoiceArb,
          fc.array(contentTextArb, { minLength: 2, maxLength: 5 }),
          platformArb,
          async (brandVoice: string, contentTexts: string[], platform: Platform) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);
            const results = [];

            // Act - Generate multiple pieces of content
            for (const contentText of contentTexts) {
              const content = createMockContent(contentText, platform, 'blog-post');
              
              const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
                content,
                userPreferences,
              });

              results.push(result);
            }

            // Assert - All content should have consistent tone
            const tones = results.map(r => r.voiceAnalysis.characteristics.tone);
            const uniqueTones = new Set(tones);
            
            // Tone should be consistent across all content
            expect(uniqueTones.size).toBeLessThanOrEqual(2); // Allow minimal variation
            
            // All should have valid consistency scores
            for (const result of results) {
              expect(result.consistencyScore).toBeGreaterThan(0);
              expect(result.consistencyScore).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain formality level consistency across platforms', async () => {
      await fc.assert(
        fc.asyncProperty(
          brandVoiceArb,
          contentTextArb,
          async (brandVoice: string, contentText: string) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);
            const platforms: Platform[] = ['blog', 'linkedin', 'facebook'];
            const results = [];

            // Act
            for (const platform of platforms) {
              const content = createMockContent(contentText, platform, 'blog-post');
              
              const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
                content,
                userPreferences,
                targetPlatform: platform,
              });

              results.push(result);
            }

            // Assert - Formality should be consistent or have controlled adjustments
            const formalities = results.map(r => r.voiceAnalysis.characteristics.formality);
            const uniqueFormalities = new Set(formalities);
            
            // Should have consistent formality or adjacent levels
            expect(uniqueFormalities.size).toBeLessThanOrEqual(2);
            
            // All formality values should be valid
            for (const formality of formalities) {
              expect(['formal', 'semi-formal', 'casual']).toContain(formality);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide recommendations when consistency is low', async () => {
      await fc.assert(
        fc.asyncProperty(
          brandVoiceArb,
          contentTextArb,
          platformArb,
          async (brandVoice: string, contentText: string, platform: Platform) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);
            const content = createMockContent(contentText, platform, 'blog-post');

            // Act
            const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
              content,
              userPreferences,
            });

            // Assert - Should always provide recommendations
            expect(result.recommendations).toBeDefined();
            expect(Array.isArray(result.recommendations)).toBe(true);
            
            // If consistency is low, should have actionable recommendations
            if (result.consistencyScore < 0.7) {
              expect(result.recommendations.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle different brand voice descriptions consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'professional',
            'friendly',
            'authoritative',
            'casual and fun',
            'warm and empathetic',
            'innovative and bold'
          ),
          contentTextArb,
          platformArb,
          async (brandVoice: string, contentText: string, platform: Platform) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);
            const content = createMockContent(contentText, platform, 'blog-post');

            // Act
            const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
              content,
              userPreferences,
            });

            // Assert - Should handle all brand voice types
            expect(result.voiceAnalysis).toBeDefined();
            expect(result.voiceAnalysis.characteristics.tone).toBeDefined();
            expect(result.voiceAnalysis.characteristics.formality).toBeDefined();
            expect(result.voiceAnalysis.characteristics.personality).toBeInstanceOf(Array);
            expect(result.voiceAnalysis.characteristics.personality.length).toBeGreaterThan(0);
            expect(result.consistencyScore).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure adapted content maintains brand voice characteristics', async () => {
      await fc.assert(
        fc.asyncProperty(
          brandVoiceArb,
          contentTextArb,
          platformArb,
          async (brandVoice: string, contentText: string, platform: Platform) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);
            const content = createMockContent(contentText, platform, 'blog-post');

            // Act
            const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
              content,
              userPreferences,
            });

            // Assert - Adapted content should exist and maintain characteristics
            expect(result.optimizedContent).toBeDefined();
            expect(result.originalContent).toBe(contentText);
            expect(result.voiceAnalysis).toBeDefined();
            
            // Should have applied the brand voice
            expect(result.consistencyScore).toBeGreaterThan(0);
            
            // Should track processing time
            expect(result.processingTime).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain personality traits consistency across platforms', async () => {
      await fc.assert(
        fc.asyncProperty(
          brandVoiceArb,
          contentTextArb,
          async (brandVoice: string, contentText: string) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);
            const platforms: Platform[] = ['blog', 'twitter', 'linkedin'];
            const results = [];

            // Act
            for (const platform of platforms) {
              const content = createMockContent(contentText, platform, 'social-post');
              
              const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
                content,
                userPreferences,
                targetPlatform: platform,
              });

              results.push(result);
            }

            // Assert - Personality traits should be consistent
            for (const result of results) {
              expect(result.voiceAnalysis.characteristics.personality).toBeInstanceOf(Array);
              expect(result.voiceAnalysis.characteristics.personality.length).toBeGreaterThan(0);
            }

            // Should have overlapping personality traits
            const allTraits = results.map(r => r.voiceAnalysis.characteristics.personality);
            const firstTraits = new Set(allTraits[0]);
            
            // At least some traits should be consistent across platforms
            for (let i = 1; i < allTraits.length; i++) {
              const commonTraits = allTraits[i].filter(trait => firstTraits.has(trait));
              expect(commonTraits.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases with minimal brand voice descriptions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('fun', 'pro', 'casual', 'formal'),
          contentTextArb,
          platformArb,
          async (brandVoice: string, contentText: string, platform: Platform) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);
            const content = createMockContent(contentText, platform, 'blog-post');

            // Act
            const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
              content,
              userPreferences,
            });

            // Assert - Should handle short descriptions gracefully
            expect(result.voiceAnalysis).toBeDefined();
            expect(result.voiceAnalysis.characteristics).toBeDefined();
            expect(result.consistencyScore).toBeGreaterThanOrEqual(0);
            expect(result.consistencyScore).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should ensure voice analysis is cached for repeated brand voices', async () => {
      await fc.assert(
        fc.asyncProperty(
          brandVoiceArb,
          fc.array(contentTextArb, { minLength: 2, maxLength: 3 }),
          platformArb,
          async (brandVoice: string, contentTexts: string[], platform: Platform) => {
            // Arrange
            const userPreferences = createMockUserPreferences(brandVoice);

            // Act - Generate multiple pieces of content with same brand voice
            const results = [];
            for (const contentText of contentTexts) {
              const content = createMockContent(contentText, platform, 'blog-post');
              
              const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
                content,
                userPreferences,
              });

              results.push(result);
            }

            // Assert - Voice analysis should be consistent (cached)
            const voiceIds = results.map(r => r.voiceAnalysis.voiceId);
            const uniqueVoiceIds = new Set(voiceIds);
            
            // Should use same voice analysis (same voiceId)
            expect(uniqueVoiceIds.size).toBe(1);
            
            // All should have same characteristics
            const tones = results.map(r => r.voiceAnalysis.characteristics.tone);
            const uniqueTones = new Set(tones);
            expect(uniqueTones.size).toBe(1);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
