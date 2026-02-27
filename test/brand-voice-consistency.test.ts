// Tests for Brand Voice Consistency Engine

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

describe('Brand Voice Consistency Engine', () => {
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

  const mockUserPreferences: UserPreferences = {
    brandVoice: 'professional and approachable',
    targetAudience: mockAudience,
    preferredPlatforms: ['blog', 'twitter', 'linkedin'],
    contentStyle: 'informative',
  };

  const mockBlogContent: GeneratedContent = {
    contentId: 'content-123',
    ideaId: 'idea-123',
    userId: 'user-123',
    platform: 'blog',
    contentType: 'blog-post',
    generatedText: 'This is a comprehensive guide to understanding modern business strategies. We will explore various approaches that companies use to achieve success in today\'s competitive market.',
    metadata: {
      wordCount: 25,
      hashtags: [],
      seoKeywords: ['business', 'strategies', 'success'],
      readingTime: 1,
    },
    version: 1,
    status: 'generated',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const mockSocialContent: GeneratedContent = {
    contentId: 'content-456',
    ideaId: 'idea-123',
    userId: 'user-123',
    platform: 'twitter',
    contentType: 'social-post',
    generatedText: 'Quick tip: Modern business success requires adaptability and strategic thinking. What\'s your approach? #business #strategy',
    metadata: {
      wordCount: 15,
      hashtags: ['business', 'strategy'],
      seoKeywords: [],
      readingTime: 0,
    },
    version: 1,
    status: 'generated',
    createdAt: '2024-01-01T00:00:00Z',
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

  describe('Brand Voice Analysis', () => {
    it('should analyze brand voice characteristics from description', async () => {
      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
      });

      expect(result).toBeDefined();
      expect(result.voiceAnalysis).toBeDefined();
      expect(result.voiceAnalysis.characteristics).toBeDefined();
      expect(result.voiceAnalysis.characteristics.tone).toBeDefined();
      expect(result.voiceAnalysis.characteristics.formality).toBeDefined();
      expect(result.voiceAnalysis.characteristics.personality).toBeInstanceOf(Array);
    });

    it('should generate style guide from brand voice characteristics', async () => {
      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
      });

      expect(result.voiceAnalysis.styleGuide).toBeDefined();
      expect(result.voiceAnalysis.styleGuide.writingPrinciples).toBeInstanceOf(Array);
      expect(result.voiceAnalysis.styleGuide.dosList).toBeInstanceOf(Array);
      expect(result.voiceAnalysis.styleGuide.dontsList).toBeInstanceOf(Array);
      expect(result.voiceAnalysis.styleGuide.writingPrinciples.length).toBeGreaterThan(0);
    });

    it('should create platform-specific adjustments', async () => {
      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
      });

      expect(result.voiceAnalysis.platformSpecificAdjustments).toBeDefined();
      expect(result.voiceAnalysis.platformSpecificAdjustments.linkedin).toBeDefined();
      expect(result.voiceAnalysis.platformSpecificAdjustments.twitter).toBeDefined();
      expect(result.voiceAnalysis.platformSpecificAdjustments.instagram).toBeDefined();
    });
  });

  describe('Style Adaptation', () => {
    it('should adapt content style based on brand voice', async () => {
      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
      });

      expect(result.optimizedContent).toBeDefined();
      expect(result.optimizedContent).not.toBe(result.originalContent);
      expect(mockBedrockService.generateContent).toHaveBeenCalled();
    });

    it('should apply customization options when provided', async () => {
      const customizationOptions = {
        tone: 'casual' as const,
        length: 'short' as const,
        style: 'creative' as const,
      };

      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
        customizationOptions,
      });

      expect(result.optimizedContent).toBeDefined();
      expect(mockBedrockService.generateContent).toHaveBeenCalled();
      
      // Check that the prompt includes customization options
      const callArgs = mockBedrockService.generateContent.mock.calls[0][0];
      expect(callArgs.contentIdea).toContain('casual');
      expect(callArgs.contentIdea).toContain('short');
      expect(callArgs.contentIdea).toContain('creative');
    });

    it('should maintain original content structure and length', async () => {
      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
      });

      expect(result.optimizedContent).toBeDefined();
      expect(result.originalContent).toBe(mockBlogContent.generatedText);
      
      // Verify the prompt instructs to maintain structure and length
      const callArgs = mockBedrockService.generateContent.mock.calls[0][0];
      expect(callArgs.contentIdea).toContain('Maintaining the original message');
      expect(callArgs.contentIdea).toContain('same approximate length');
    });
  });

  describe('Platform-Specific Adjustments', () => {
    it('should apply LinkedIn-specific adjustments', async () => {
      const linkedinContent = { ...mockSocialContent, platform: 'linkedin' as Platform };
      
      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: linkedinContent,
        userPreferences: mockUserPreferences,
        targetPlatform: 'linkedin',
      });

      expect(result.optimizedContent).toBeDefined();
      expect(mockBedrockService.generateContent).toHaveBeenCalledTimes(2); // Style adaptation + platform adjustment
    });

    it('should apply Twitter-specific adjustments', async () => {
      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockSocialContent,
        userPreferences: mockUserPreferences,
        targetPlatform: 'twitter',
      });

      expect(result.optimizedContent).toBeDefined();
      expect(mockBedrockService.generateContent).toHaveBeenCalledTimes(2); // Style adaptation + platform adjustment
    });

    it('should apply Instagram-specific adjustments', async () => {
      const instagramContent = { ...mockSocialContent, platform: 'instagram' as Platform, contentType: 'caption' as ContentType };
      
      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: instagramContent,
        userPreferences: mockUserPreferences,
        targetPlatform: 'instagram',
      });

      expect(result.optimizedContent).toBeDefined();
      expect(mockBedrockService.generateContent).toHaveBeenCalledTimes(2); // Style adaptation + platform adjustment
    });
  });

  describe('Cross-Platform Consistency', () => {
    it('should perform cross-platform consistency check', async () => {
      const referenceContent = [mockSocialContent];
      
      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
        crossPlatformReference: referenceContent,
      });

      expect(result.crossPlatformConsistency).toBeDefined();
      expect(result.crossPlatformConsistency.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.crossPlatformConsistency.overallScore).toBeLessThanOrEqual(1);
      expect(result.crossPlatformConsistency.platformScores).toBeDefined();
      expect(result.crossPlatformConsistency.inconsistencies).toBeInstanceOf(Array);
      expect(result.crossPlatformConsistency.recommendations).toBeInstanceOf(Array);
    });

    it('should identify inconsistencies between platforms', async () => {
      // Create content with very different tone
      const inconsistentContent = {
        ...mockSocialContent,
        generatedText: 'OMG this is like totally awesome and super cool! 😎🔥 #amazing #wow',
      };

      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
        crossPlatformReference: [inconsistentContent],
      });

      expect(result.crossPlatformConsistency.inconsistencies.length).toBeGreaterThan(0);
      expect(result.crossPlatformConsistency.overallScore).toBeLessThan(0.8);
    });

    it('should provide consistency recommendations', async () => {
      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
        crossPlatformReference: [mockSocialContent],
      });

      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.crossPlatformConsistency.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Consistency Scoring', () => {
    it('should calculate overall consistency score', async () => {
      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
      });

      expect(result.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(result.consistencyScore).toBeLessThanOrEqual(1);
      expect(typeof result.consistencyScore).toBe('number');
    });

    it('should provide higher scores for consistent content', async () => {
      const consistentContent = {
        ...mockSocialContent,
        generatedText: 'Professional insights on modern business strategies. Strategic thinking drives success in competitive markets.',
      };

      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: consistentContent,
        userPreferences: mockUserPreferences,
        crossPlatformReference: [mockBlogContent],
      });

      expect(result.consistencyScore).toBeGreaterThan(0.7);
    });

    it('should provide lower scores for inconsistent content', async () => {
      const inconsistentContent = {
        ...mockSocialContent,
        generatedText: 'yo this is sick! totally rad business stuff lol 😂🤪 #random #whatever',
      };

      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
        crossPlatformReference: [inconsistentContent],
      });

      expect(result.consistencyScore).toBeLessThan(0.8);
    });
  });

  describe('Performance and Reliability', () => {
    it('should track processing time', async () => {
      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
      });

      expect(result.processingTime).toBeGreaterThan(0);
      expect(typeof result.processingTime).toBe('number');
    });

    it('should handle AI service failures gracefully', async () => {
      mockBedrockService.generateContent.mockRejectedValueOnce(new Error('AI service unavailable'));

      await expect(
        brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
          content: mockBlogContent,
          userPreferences: mockUserPreferences,
        })
      ).rejects.toThrow('Brand voice consistency failed: AI service unavailable');
    });

    it('should cache voice analysis for repeated requests', async () => {
      // First request
      await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: mockUserPreferences,
      });

      // Second request with same brand voice
      await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockSocialContent,
        userPreferences: mockUserPreferences,
      });

      // Should have called Bedrock for content adaptation but not for voice analysis
      expect(mockBedrockService.generateContent).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const emptyContent = { ...mockBlogContent, generatedText: '' };

      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: emptyContent,
        userPreferences: mockUserPreferences,
      });

      expect(result).toBeDefined();
      expect(result.optimizedContent).toBeDefined();
    });

    it('should handle very short brand voice descriptions', async () => {
      const shortVoicePreferences = {
        ...mockUserPreferences,
        brandVoice: 'fun',
      };

      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: shortVoicePreferences,
      });

      expect(result).toBeDefined();
      expect(result.voiceAnalysis).toBeDefined();
    });

    it('should handle very long brand voice descriptions', async () => {
      const longVoicePreferences = {
        ...mockUserPreferences,
        brandVoice: 'professional yet approachable, authoritative but not intimidating, knowledgeable and trustworthy, innovative and forward-thinking, empathetic and understanding, clear and concise in communication, reliable and consistent in messaging',
      };

      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: mockBlogContent,
        userPreferences: longVoicePreferences,
      });

      expect(result).toBeDefined();
      expect(result.voiceAnalysis).toBeDefined();
    });

    it('should handle content with special characters and emojis', async () => {
      const emojiContent = {
        ...mockBlogContent,
        generatedText: 'Business strategies 📈 for success! 🚀 Let\'s explore innovative approaches... 💡',
      };

      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content: emojiContent,
        userPreferences: mockUserPreferences,
      });

      expect(result).toBeDefined();
      expect(result.optimizedContent).toBeDefined();
    });
  });
});