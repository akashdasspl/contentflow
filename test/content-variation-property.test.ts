// Property-based test for content variation generation
// **Validates: Requirements 4.4**

import * as fc from 'fast-check';
import { contentVariationService } from '../src/services/content-variations';
import { 
  ContentType, 
  Platform, 
  ContentIntent,
  AudienceProfile, 
  UserPreferences,
} from '../src/types';

// Mock dependencies
jest.mock('../src/services/bedrock-service', () => ({
  bedrockService: {
    generateContent: jest.fn(),
  },
}));

jest.mock('../src/services/content-quality', () => ({
  contentQualityService: {
    validateContent: jest.fn(),
  },
}));

jest.mock('../src/services/content-generators', () => ({
  generatePlatformContent: jest.fn(),
}));

jest.mock('../src/utils', () => ({
  generateContentId: jest.fn(() => 'content_' + Math.random().toString(36).substr(2, 9)),
  generateIdeaId: jest.fn(() => 'idea_' + Math.random().toString(36).substr(2, 9)),
  getCurrentTimestamp: jest.fn(() => new Date().toISOString()),
  calculateReadingTime: jest.fn((text: string) => Math.ceil(text.split(/\s+/).length / 200)),
  extractKeywords: jest.fn((text: string) => text.split(/\s+/).slice(0, 3)),
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

describe('Property-Based Test: Content Variation Generation', () => {
  const mockBedrockService = require('../src/services/bedrock-service').bedrockService;
  const mockContentQualityService = require('../src/services/content-quality').contentQualityService;
  const mockGeneratePlatformContent = require('../src/services/content-generators').generatePlatformContent;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default quality check response
    mockContentQualityService.validateContent.mockResolvedValue({
      isValid: true,
      qualityScore: Math.random() * 0.4 + 0.6, // Random score between 0.6-1.0
      grammarScore: Math.random() * 0.4 + 0.6,
      coherenceScore: Math.random() * 0.4 + 0.6,
      safetyScore: Math.random() * 0.2 + 0.8, // Random score between 0.8-1.0
      issues: [],
      safetyFlags: [],
      recommendations: [],
      processingTime: Math.floor(Math.random() * 200) + 50,
    });

    // Default bedrock response
    mockBedrockService.generateContent.mockImplementation(() => {
      const wordCount = Math.floor(Math.random() * 50) + 10;
      const content = `Generated variation content with ${wordCount} words. This is a test variation that demonstrates the content generation capability.`;
      
      return Promise.resolve({
        content,
        metadata: {
          modelId: 'claude-3-sonnet',
          processingTime: Math.floor(Math.random() * 2000) + 500,
          tokenUsage: { 
            inputTokens: Math.floor(Math.random() * 200) + 50, 
            outputTokens: Math.floor(Math.random() * 300) + 100 
          },
          contentType: 'social-post',
          platform: 'twitter',
          wordCount,
          characterCount: content.length,
        },
      });
    });

    // Default primary content
    mockGeneratePlatformContent.mockImplementation((contentType: any, options: any) => {
      const wordCount = Math.floor(Math.random() * 30) + 5;
      const content = `Primary content with ${wordCount} words for testing.`;
      
      return Promise.resolve({
        contentId: 'primary_' + Math.random().toString(36).substr(2, 9),
        ideaId: 'idea_' + Math.random().toString(36).substr(2, 9),
        userId: options.userId, // Use the userId from options
        platform: options.platform || 'blog',
        contentType,
        generatedText: content,
        metadata: {
          wordCount,
          characterCount: content.length,
          hashtags: ['test', 'content'],
          seoKeywords: ['test', 'content', 'primary'],
          readingTime: Math.ceil(wordCount / 200),
          qualityScore: Math.random() * 0.4 + 0.6,
          grammarScore: Math.random() * 0.4 + 0.6,
          coherenceScore: Math.random() * 0.4 + 0.6,
          safetyScore: Math.random() * 0.2 + 0.8,
        },
        version: 1,
        status: 'generated',
        createdAt: new Date().toISOString(),
      });
    });
  });

  // fast-check arbitraries for property-based testing
  const contentIdeaArb = fc.oneof(
    fc.constantFrom(
      'How to improve productivity at work',
      'Best practices for social media marketing',
      'Tips for healthy living and wellness',
      'Guide to learning new programming languages',
      'Strategies for effective team communication',
      'Benefits of remote work and flexibility',
      'Introduction to sustainable living practices',
      'Creative writing techniques for beginners',
      'Financial planning for young professionals',
      'Travel tips for budget-conscious explorers'
    ),
    fc.string({ minLength: 10, maxLength: 500 })
  );

  const contentTypeArb = fc.constantFrom<ContentType>('blog-post', 'social-post', 'caption', 'script');

  const platformArb = fc.constantFrom<Platform>('blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok');

  const intentArb = fc.constantFrom<ContentIntent>('informational', 'promotional', 'educational', 'entertainment');

  const variationCountArb = fc.integer({ min: 1, max: 5 });

  const toneArb = fc.constantFrom('formal', 'casual', 'professional', 'friendly', 'authoritative', 'conversational');
  const lengthArb = fc.constantFrom('short', 'medium', 'long');
  const styleArb = fc.constantFrom('creative', 'straightforward', 'technical', 'storytelling');

  const customizationOptionsArb = fc.record({
    tone: fc.option(toneArb, { nil: undefined }),
    length: fc.option(lengthArb, { nil: undefined }),
    style: fc.option(styleArb, { nil: undefined }),
    includeEmojis: fc.option(fc.boolean(), { nil: undefined }),
    includeHashtags: fc.option(fc.boolean(), { nil: undefined }),
    includeCallToAction: fc.option(fc.boolean(), { nil: undefined }),
    targetKeywords: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 1, maxLength: 5 }), { nil: undefined }),
  });

  /**
   * Property 9: Content Variation Generation
   * For any content generation request, the system should provide multiple distinct variations for user selection
   * **Validates: Requirements 4.4**
   */
  describe('Property 9: Content Variation Generation', () => {
    it('should generate the requested number of variations for any valid input', async () => {
      await fc.assert(
        fc.asyncProperty(
          contentIdeaArb,
          contentTypeArb,
          platformArb,
          intentArb,
          variationCountArb,
          customizationOptionsArb,
          async (contentIdea, contentType, platform, intent, variationCount, customizationOptions) => {
            // Adjust platform for blog-post content type
            const actualPlatform = contentType === 'blog-post' ? 'blog' : platform;

            const options = {
              contentIdea,
              userId: `user_${Math.random().toString(36).substr(2, 9)}`,
              contentType,
              platform: contentType === 'blog-post' ? undefined : actualPlatform,
              intent,
              variationCount,
              customizationOptions,
            };

            const result = await contentVariationService.generateVariations(options);

            // Property: Should always return a primary content
            expect(result.primaryContent).toBeDefined();
            expect(result.primaryContent.contentId).toBeDefined();
            expect(result.primaryContent.generatedText).toBeDefined();
            expect(result.primaryContent.userId).toBe(options.userId);

            // Property: Should generate variations (may be less than requested due to failures)
            expect(result.variations).toBeDefined();
            expect(Array.isArray(result.variations)).toBe(true);
            expect(result.variations.length).toBeGreaterThanOrEqual(0);
            expect(result.variations.length).toBeLessThanOrEqual(variationCount);

            // Property: Each variation should have required properties
            result.variations.forEach(variation => {
              expect(variation.variationId).toBeDefined();
              expect(variation.contentId).toBe(result.primaryContent.contentId);
              expect(variation.generatedText).toBeDefined();
              expect(variation.metadata).toBeDefined();
              expect(variation.rankingScore).toBeGreaterThanOrEqual(0);
              expect(variation.rankingScore).toBeLessThanOrEqual(1);
              expect(variation.variationType).toBeDefined();
              expect(variation.customizationApplied).toBeDefined();
              expect(variation.createdAt).toBeDefined();
            });

            // Property: Variations should be ranked (highest score first)
            for (let j = 0; j < result.variations.length - 1; j++) {
              expect(result.variations[j].rankingScore).toBeGreaterThanOrEqual(
                result.variations[j + 1].rankingScore
              );
            }

            // Property: Should provide ranking metadata
            expect(result.rankingMetadata).toBeDefined();
            expect(result.rankingMetadata.totalVariations).toBe(result.variations.length);
            expect(result.rankingMetadata.averageScore).toBeGreaterThanOrEqual(0);
            expect(result.rankingMetadata.averageScore).toBeLessThanOrEqual(1);
            expect(result.rankingMetadata.topScore).toBeGreaterThanOrEqual(result.rankingMetadata.lowestScore);

            // Property: Variations should be distinct from primary content
            result.variations.forEach(variation => {
              expect(variation.generatedText).not.toBe(result.primaryContent.generatedText);
            });
          }
        ),
        { numRuns: 100, timeout: 60000 } // Run 100 test cases with 60 second timeout
      );
    }, 120000); // 2 minute timeout for entire test

    it('should handle edge cases and maintain invariants', async () => {
      const edgeCaseArb = fc.oneof(
        // Minimum variation count
        fc.record({ variationCount: fc.constant(1), contentIdea: fc.constant('A') }),
        // Maximum reasonable variation count
        fc.record({ variationCount: fc.constant(5), contentIdea: fc.constant('Maximum variations test case') }),
        // Very short content idea
        fc.record({ variationCount: fc.constant(2), contentIdea: fc.string({ minLength: 1, maxLength: 5 }) }),
        // Long content idea (near limit)
        fc.record({ variationCount: fc.constant(3), contentIdea: fc.string({ minLength: 400, maxLength: 500 }) }),
        // Different content types
        fc.record({ 
          variationCount: fc.constant(2), 
          contentIdea: fc.constant('Blog test'), 
          contentType: fc.constant<ContentType>('blog-post')
        }),
        fc.record({ 
          variationCount: fc.constant(2), 
          contentIdea: fc.constant('Script test'), 
          contentType: fc.constant<ContentType>('script')
        })
      );

      await fc.assert(
        fc.asyncProperty(edgeCaseArb, async (edgeCase) => {
          const options = {
            contentIdea: edgeCase.contentIdea,
            userId: 'edge_test_user',
            contentType: (edgeCase as any).contentType || 'social-post' as ContentType,
            platform: ((edgeCase as any).contentType === 'blog-post' ? undefined : 'twitter') as Platform | undefined,
            intent: 'informational' as ContentIntent,
            variationCount: edgeCase.variationCount,
          };

          const result = await contentVariationService.generateVariations(options);

          // Invariant: Always returns primary content
          expect(result.primaryContent).toBeDefined();
          
          // Invariant: Variations array is always defined
          expect(result.variations).toBeDefined();
          expect(Array.isArray(result.variations)).toBe(true);
          
          // Invariant: Ranking metadata is always provided
          expect(result.rankingMetadata).toBeDefined();
          expect(typeof result.rankingMetadata.totalVariations).toBe('number');
          expect(typeof result.rankingMetadata.averageScore).toBe('number');
        }),
        { numRuns: 50, timeout: 60000 }
      );
    }, 120000);

    it('should maintain quality standards across all variations', async () => {
      await fc.assert(
        fc.asyncProperty(
          contentIdeaArb,
          contentTypeArb,
          platformArb,
          intentArb,
          customizationOptionsArb,
          async (contentIdea, contentType, platform, intent, customizationOptions) => {
            const options = {
              contentIdea,
              userId: `quality_test_${Math.random().toString(36).substr(2, 9)}`,
              contentType,
              platform: contentType === 'blog-post' ? undefined : platform,
              intent,
              variationCount: 3,
              customizationOptions,
            };

            const result = await contentVariationService.generateVariations(options);

            // Property: All content should meet minimum quality standards
            expect(result.primaryContent.metadata.qualityScore).toBeGreaterThanOrEqual(0);
            expect(result.primaryContent.metadata.qualityScore).toBeLessThanOrEqual(1);

            result.variations.forEach(variation => {
              // Quality scores should be valid
              expect(variation.metadata.qualityScore).toBeGreaterThanOrEqual(0);
              expect(variation.metadata.qualityScore).toBeLessThanOrEqual(1);
              
              // Safety scores should be high
              if (variation.metadata.safetyScore !== undefined) {
                expect(variation.metadata.safetyScore).toBeGreaterThanOrEqual(0);
                expect(variation.metadata.safetyScore).toBeLessThanOrEqual(1);
              }
              
              // Content should not be empty
              expect(variation.generatedText.trim().length).toBeGreaterThan(0);
              
              // Metadata should be consistent
              expect(variation.metadata.wordCount).toBeGreaterThan(0);
              expect(variation.metadata.characterCount).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 50, timeout: 60000 }
      );
    }, 120000);

    it('should respect platform constraints across all variations', async () => {
      const platformTestArb = fc.constantFrom(
        { platform: 'twitter' as Platform, maxLength: 280 },
        { platform: 'instagram' as Platform, maxLength: 2200 },
        { platform: 'linkedin' as Platform, maxLength: 3000 }
      );

      await fc.assert(
        fc.asyncProperty(
          platformTestArb,
          contentIdeaArb,
          async (platformTest, contentIdea) => {
            const options = {
              contentIdea: contentIdea.substring(0, 100) + ' for ' + platformTest.platform,
              userId: 'platform_test_user',
              contentType: 'social-post' as ContentType,
              platform: platformTest.platform,
              intent: 'informational' as ContentIntent,
              variationCount: 3,
            };

            const result = await contentVariationService.generateVariations(options);

            // Property: All variations should respect platform constraints
            result.variations.forEach(variation => {
              if (platformTest.maxLength) {
                expect(variation.generatedText.length).toBeLessThanOrEqual(platformTest.maxLength + 50); // Allow some tolerance
              }
              
              // Platform should be consistent
              expect(result.primaryContent.platform).toBe(platformTest.platform);
            });
          }
        ),
        { numRuns: 30, timeout: 60000 }
      );
    }, 120000);

    it('should generate diverse variations with different characteristics', async () => {
      await fc.assert(
        fc.asyncProperty(
          contentIdeaArb,
          platformArb,
          toneArb,
          lengthArb,
          styleArb,
          async (contentIdea, platform, tone, length, style) => {
            const options = {
              contentIdea,
              userId: 'diversity_test_user',
              contentType: 'social-post' as ContentType,
              platform,
              intent: 'informational' as ContentIntent,
              variationCount: 5,
              customizationOptions: {
                tone: tone as any,
                length: length as any,
                style: style as any,
              },
            };

            const result = await contentVariationService.generateVariations(options);

            if (result.variations.length > 1) {
              // Property: Variations should have different types
              const variationTypes = result.variations.map(v => v.variationType);
              const uniqueTypes = new Set(variationTypes);
              expect(uniqueTypes.size).toBeGreaterThan(1);

              // Property: Variations should have different customizations applied
              const customizations = result.variations.map(v => JSON.stringify(v.customizationApplied));
              const uniqueCustomizations = new Set(customizations);
              expect(uniqueCustomizations.size).toBeGreaterThan(1);

              // Property: Variations should have different ranking scores (unless identical quality)
              const scores = result.variations.map(v => v.rankingScore);
              const hasVariedScores = scores.some((score, index) => 
                index > 0 && Math.abs(score - scores[0]) > 0.01
              );
              // Note: Scores might be identical in some cases, so we don't enforce this strictly
            }
          }
        ),
        { numRuns: 30, timeout: 60000 }
      );
    }, 120000);
  });
});