// Tests for platform optimization service

import { platformOptimizationService } from '../src/services/platform-optimization';
import {
  Platform,
  ContentType,
  GeneratedContent,
  UserPreferences,
  AudienceProfile,
  ContentIntent,
} from '../src/types';
import { getCurrentTimestamp, generateContentId, generateIdeaId } from '../src/utils';

describe('Platform Optimization Service', () => {
  // Mock content for testing
  const mockBlogContent: GeneratedContent = {
    contentId: generateContentId(),
    ideaId: generateIdeaId(),
    userId: 'test-user-123',
    platform: 'blog',
    contentType: 'blog-post',
    generatedText: `
# How to Master Content Marketing

Content marketing is a strategic approach focused on creating and distributing valuable, relevant, and consistent content to attract and retain a clearly defined audience.

## Key Strategies

1. Know your audience
2. Create valuable content
3. Be consistent
4. Measure results

Content marketing helps build trust with your audience and establishes your brand as a thought leader in your industry.

## Conclusion

By following these strategies, you can create effective content marketing campaigns that drive results.
    `.trim(),
    metadata: {
      wordCount: 85,
      hashtags: [],
      seoKeywords: ['content marketing', 'strategies', 'audience'],
      readingTime: 1,
      characterCount: 500,
    },
    version: 1,
    status: 'generated',
    createdAt: getCurrentTimestamp(),
  };

  const mockSocialContent: GeneratedContent = {
    contentId: generateContentId(),
    ideaId: generateIdeaId(),
    userId: 'test-user-123',
    platform: 'twitter',
    contentType: 'social-post',
    generatedText: 'Just discovered this amazing productivity hack that changed my workflow completely! Here\'s what I learned and how you can apply it too. #productivity #workflow #tips',
    metadata: {
      wordCount: 25,
      hashtags: ['productivity', 'workflow', 'tips'],
      seoKeywords: ['productivity', 'hack', 'workflow'],
      readingTime: 1,
      characterCount: 150,
    },
    version: 1,
    status: 'generated',
    createdAt: getCurrentTimestamp(),
  };

  const mockUserPreferences: UserPreferences = {
    brandVoice: 'professional and friendly',
    targetAudience: {
      profileId: 'profile-123',
      userId: 'test-user-123',
      demographics: {
        ageRange: '25-45',
        location: 'United States',
        interests: ['technology', 'business', 'productivity'],
      },
      behaviorPatterns: {
        preferredContentTypes: ['blog-post', 'social-post'],
        engagementTimes: ['9AM-11AM', '2PM-4PM'],
        platformUsage: {
          blog: {
            frequency: 'weekly',
            engagementRate: 0.15,
            preferredContentLength: 'long',
            bestPostingTimes: ['Tuesday 10AM'],
          },
          twitter: {
            frequency: 'daily',
            engagementRate: 0.08,
            preferredContentLength: 'short',
            bestPostingTimes: ['Monday 9AM', 'Wednesday 2PM'],
          },
          facebook: {
            frequency: 'weekly',
            engagementRate: 0.12,
            preferredContentLength: 'medium',
            bestPostingTimes: ['Wednesday 2PM'],
          },
          instagram: {
            frequency: 'daily',
            engagementRate: 0.18,
            preferredContentLength: 'short',
            bestPostingTimes: ['Friday 6PM'],
          },
          linkedin: {
            frequency: 'weekly',
            engagementRate: 0.10,
            preferredContentLength: 'long',
            bestPostingTimes: ['Tuesday 9AM'],
          },
          youtube: {
            frequency: 'weekly',
            engagementRate: 0.25,
            preferredContentLength: 'long',
            bestPostingTimes: ['Sunday 8PM'],
          },
          tiktok: {
            frequency: 'daily',
            engagementRate: 0.22,
            preferredContentLength: 'short',
            bestPostingTimes: ['Friday 7PM'],
          },
        },
      },
      updatedAt: getCurrentTimestamp(),
    },
    preferredPlatforms: ['blog', 'twitter', 'linkedin'],
    contentStyle: 'informative and engaging',
  };

  describe('Blog Content Optimization', () => {
    it('should optimize blog content for SEO', async () => {
      const options = {
        content: mockBlogContent,
        seoKeywords: ['content marketing', 'digital marketing', 'strategy'],
        enforceConstraints: true,
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);

      expect(result).toBeDefined();
      expect(result.contentId).toBe(mockBlogContent.contentId);
      expect(result.metadata.platformOptimized).toBe(true);
      expect(result.metadata.seoKeywords).toContain('content marketing');
      expect(result.metadata.seoScore).toBeGreaterThan(0);
      expect(result.metadata.seoRecommendations).toBeDefined();
    });

    it('should generate SEO title and meta description', async () => {
      const options = {
        content: mockBlogContent,
        seoKeywords: ['content marketing'],
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);

      expect(result.metadata.title).toBeDefined();
      expect(result.metadata.metaDescription).toBeDefined();
      expect(result.metadata.title?.length).toBeLessThanOrEqual(60);
      expect(result.metadata.metaDescription?.length).toBeLessThanOrEqual(160);
    });

    it('should provide SEO improvement recommendations', async () => {
      const shortContent = {
        ...mockBlogContent,
        generatedText: 'Short blog post without proper structure.',
      };

      const options = {
        content: shortContent,
        seoKeywords: ['test'],
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);

      expect(result.metadata.seoRecommendations).toBeDefined();
      expect(result.metadata.seoImprovements).toBeDefined();
      expect(result.metadata.seoScore).toBeLessThan(0.8); // Should have lower score for short content
    });
  });

  describe('Social Media Optimization', () => {
    it('should optimize Twitter content with character limits', async () => {
      const longTwitterContent = {
        ...mockSocialContent,
        generatedText: 'This is a very long Twitter post that exceeds the 280 character limit and should be truncated to fit within the platform constraints while maintaining the core message and engagement elements.',
      };

      const options = {
        content: longTwitterContent,
        targetPlatform: 'twitter' as Platform,
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);

      expect(result.generatedText.length).toBeLessThanOrEqual(280);
      expect(result.metadata.platformCompliance).toBe(true);
      expect(result.metadata.bestPracticesApplied).toBeDefined();
    });

    it('should optimize Instagram content with hashtags', async () => {
      const options = {
        content: mockSocialContent,
        targetPlatform: 'instagram' as Platform,
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);

      expect(result.platform).toBe('instagram');
      expect(result.metadata.hashtags).toBeDefined();
      expect(result.metadata.hashtags.length).toBeGreaterThan(0);
      expect(result.metadata.hashtags.length).toBeLessThanOrEqual(11); // Optimal for Instagram
      expect(result.metadata.callToAction).toBeDefined();
    });

    it('should optimize LinkedIn content with professional tone', async () => {
      const casualContent = {
        ...mockSocialContent,
        generatedText: 'This is super awesome and cool! Amazing stuff happening here!',
      };

      const options = {
        content: casualContent,
        targetPlatform: 'linkedin' as Platform,
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);

      expect(result.platform).toBe('linkedin');
      expect(result.generatedText).not.toContain('super');
      expect(result.generatedText).not.toContain('awesome');
      expect(result.metadata.bestPracticesApplied).toBeDefined();
    });

    it('should optimize TikTok content for short format', async () => {
      const options = {
        content: mockSocialContent,
        targetPlatform: 'tiktok' as Platform,
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);

      expect(result.platform).toBe('tiktok');
      expect(result.generatedText.length).toBeLessThanOrEqual(150);
      expect(result.metadata.callToAction).toContain('Follow');
    });
  });

  describe('Brand Voice Consistency', () => {
    it('should apply enhanced brand voice to content', async () => {
      const options = {
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);

      expect(result.metadata.brandVoiceApplied).toBe(true);
      expect(result.metadata.brandVoice).toBe('professional and friendly');
      expect(result.metadata.brandVoiceConsistencyScore).toBeDefined();
      expect(result.metadata.brandVoiceRecommendations).toBeDefined();
      expect(result.metadata.brandVoiceProcessingTime).toBeDefined();
      expect(result.metadata.crossPlatformConsistency).toBeDefined();
    });

    it('should maintain brand voice across different platforms', async () => {
      const twitterOptions = {
        content: mockSocialContent,
        targetPlatform: 'twitter' as Platform,
        userPreferences: mockUserPreferences,
      };

      const linkedinOptions = {
        content: mockSocialContent,
        targetPlatform: 'linkedin' as Platform,
        userPreferences: mockUserPreferences,
      };

      const [twitterResult, linkedinResult] = await Promise.all([
        platformOptimizationService.optimizeForPlatform(twitterOptions),
        platformOptimizationService.optimizeForPlatform(linkedinOptions),
      ]);

      expect(twitterResult.metadata.brandVoiceApplied).toBe(true);
      expect(linkedinResult.metadata.brandVoiceApplied).toBe(true);
      expect(twitterResult.metadata.brandVoice).toBe(linkedinResult.metadata.brandVoice);
      expect(twitterResult.metadata.brandVoiceConsistencyScore).toBeDefined();
      expect(linkedinResult.metadata.brandVoiceConsistencyScore).toBeDefined();
    });

    it('should apply customization options with brand voice', async () => {
      const customizationOptions = {
        tone: 'casual' as const,
        length: 'short' as const,
        style: 'creative' as const,
      };

      const options = {
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
        customizationOptions,
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);

      expect(result.metadata.brandVoiceApplied).toBe(true);
      expect(result.metadata.brandVoiceConsistencyScore).toBeDefined();
    });

    it('should fallback to basic brand voice on enhanced engine failure', async () => {
      // Mock the brand voice consistency engine to fail
      const mockBrandVoiceEngine = require('../src/services/brand-voice-consistency').brandVoiceConsistencyEngine;
      const originalMethod = mockBrandVoiceEngine.applyBrandVoiceConsistency;
      mockBrandVoiceEngine.applyBrandVoiceConsistency = jest.fn().mockRejectedValue(new Error('Engine failed'));

      const options = {
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);

      expect(result.metadata.brandVoiceApplied).toBe(true);
      expect(result.metadata.brandVoice).toBe('professional and friendly');
      
      // Restore original method
      mockBrandVoiceEngine.applyBrandVoiceConsistency = originalMethod;
    });
  });

  describe('Platform Templates', () => {
    it('should retrieve platform templates', async () => {
      const templates = await platformOptimizationService.getPlatformTemplates('blog');

      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0].platform).toBe('blog');
      expect(templates[0].structure).toBeDefined();
      expect(templates[0].constraints).toBeDefined();
    });

    it('should retrieve specific template by ID', async () => {
      const template = await platformOptimizationService.getPlatformTemplate('blog-default');

      expect(template).toBeDefined();
      expect(template?.templateId).toBe('blog-default');
      expect(template?.platform).toBe('blog');
      expect(template?.contentType).toBe('blog-post');
    });

    it('should return null for non-existent template', async () => {
      const template = await platformOptimizationService.getPlatformTemplate('non-existent');

      expect(template).toBeNull();
    });
  });

  describe('Platform Guidelines', () => {
    it('should retrieve platform guidelines', async () => {
      const guidelines = await platformOptimizationService.getPlatformGuidelines('twitter');

      expect(guidelines).toBeDefined();
      expect(guidelines.constraints).toBeDefined();
      expect(guidelines.bestPractices).toBeDefined();
      expect(guidelines.examples).toBeDefined();
      expect(guidelines.constraints.maxLength).toBe(280);
    });

    it('should provide platform-specific constraints', async () => {
      const twitterGuidelines = await platformOptimizationService.getPlatformGuidelines('twitter');
      const instagramGuidelines = await platformOptimizationService.getPlatformGuidelines('instagram');

      expect(twitterGuidelines.constraints.maxLength).toBe(280);
      expect(instagramGuidelines.constraints.maxLength).toBe(2200);
      expect(twitterGuidelines.constraints.maxHashtags).toBe(2);
      expect(instagramGuidelines.constraints.maxHashtags).toBe(30);
    });

    it('should provide platform-specific best practices', async () => {
      const blogGuidelines = await platformOptimizationService.getPlatformGuidelines('blog');
      const twitterGuidelines = await platformOptimizationService.getPlatformGuidelines('twitter');

      expect(blogGuidelines.bestPractices).toContain('Include target keywords in title and throughout content');
      expect(twitterGuidelines.bestPractices).toContain('Keep tweets under 280 characters');
    });
  });

  describe('Caption Optimization', () => {
    it('should optimize caption content for visual platforms', async () => {
      const captionContent: GeneratedContent = {
        ...mockSocialContent,
        contentType: 'caption',
        generatedText: 'Beautiful sunset at the beach today. Perfect end to a great day.',
      };

      const options = {
        content: captionContent,
        targetPlatform: 'instagram' as Platform,
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);

      expect(result.metadata.visualOptimized).toBe(true);
      expect(result.metadata.emojiCount).toBeGreaterThan(0);
      expect(result.metadata.visualElements).toBeDefined();
    });
  });

  describe('Script Optimization', () => {
    it('should optimize script content with timing cues', async () => {
      const scriptContent: GeneratedContent = {
        ...mockBlogContent,
        contentType: 'script',
        platform: 'youtube',
        generatedText: 'Welcome to our channel. Today we\'re talking about productivity. Let\'s dive in.',
      };

      const options = {
        content: scriptContent,
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);

      expect(result.metadata.scriptOptimized).toBe(true);
      expect(result.metadata.timingOptimized).toBe(true);
      expect(result.metadata.deliveryNotes).toBeDefined();
      expect(result.metadata.pacing).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown content types gracefully', async () => {
      const unknownContent = {
        ...mockBlogContent,
        contentType: 'unknown-type' as ContentType,
      };

      const options = {
        content: unknownContent,
      };

      // Should not throw an error, but should log a warning
      const result = await platformOptimizationService.optimizeForPlatform(options);
      expect(result).toBeDefined();
      expect(result.contentId).toBe(unknownContent.contentId);
    });

    it('should handle missing user preferences gracefully', async () => {
      const options = {
        content: mockBlogContent,
        userPreferences: undefined,
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);

      expect(result).toBeDefined();
      expect(result.metadata.platformOptimized).toBe(true);
      expect(result.metadata.brandVoiceApplied).toBeUndefined();
    });
  });

  describe('Performance', () => {
    it('should complete optimization within reasonable time', async () => {
      const startTime = Date.now();
      
      const options = {
        content: mockBlogContent,
        seoKeywords: ['test', 'performance'],
      };

      const result = await platformOptimizationService.optimizeForPlatform(options);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result).toBeDefined();
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle multiple concurrent optimizations', async () => {
      const options1 = { content: mockBlogContent };
      const options2 = { content: mockSocialContent, targetPlatform: 'twitter' as Platform };
      const options3 = { content: mockSocialContent, targetPlatform: 'instagram' as Platform };

      const startTime = Date.now();
      
      const results = await Promise.all([
        platformOptimizationService.optimizeForPlatform(options1),
        platformOptimizationService.optimizeForPlatform(options2),
        platformOptimizationService.optimizeForPlatform(options3),
      ]);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.metadata.platformOptimized).toBe(true);
      });
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});