// Tests for platform-specific content generators

import {
  BlogContentGenerator,
  SocialMediaContentGenerator,
  CaptionContentGenerator,
  ScriptContentGenerator,
  generatePlatformContent,
  blogGenerator,
  socialMediaGenerator,
  captionGenerator,
  scriptGenerator,
} from '../src/services/content-generators';
import { 
  ContentType, 
  Platform, 
  ContentIntent,
  AudienceProfile, 
  UserPreferences 
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

jest.mock('../src/utils', () => ({
  getPlatformConstraints: jest.fn((platform: string) => ({
    twitter: { maxLength: 280, hashtagLimit: 2 },
    instagram: { maxLength: 2200, hashtagLimit: 30, optimalHashtags: 11 },
    facebook: { maxLength: 63206, hashtagLimit: 30 },
    linkedin: { maxLength: 3000, hashtagLimit: 5 },
    blog: { minLength: 800, maxLength: 2000 },
    youtube: { titleMaxLength: 100, descriptionMaxLength: 5000 },
    tiktok: { maxLength: 150, hashtagLimit: 100, optimalHashtags: 3 },
  }[platform] || {})),
  calculateReadingTime: jest.fn((text: string) => Math.ceil(text.split(/\s+/).length / 200)),
  extractKeywords: jest.fn((text: string) => ['keyword1', 'keyword2', 'keyword3']),
  generateContentId: jest.fn(() => 'content_123'),
  generateIdeaId: jest.fn(() => 'idea_123'),
  getCurrentTimestamp: jest.fn(() => '2024-01-01T00:00:00Z'),
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

describe('BlogContentGenerator', () => {
  let generator: BlogContentGenerator;
  const mockBedrockService = require('../src/services/bedrock-service').bedrockService;
  const mockContentQualityService = require('../src/services/content-quality').contentQualityService;

  beforeEach(() => {
    generator = new BlogContentGenerator();
    mockBedrockService.generateContent.mockClear();
    mockContentQualityService.validateContent.mockClear();
    
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
      preferredContentTypes: ['blog-post'],
      engagementTimes: ['morning'],
      platformUsage: {} as any,
    },
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockPreferences: UserPreferences = {
    brandVoice: 'professional',
    targetAudience: mockAudience,
    preferredPlatforms: ['blog'],
    contentStyle: 'informative',
  };

  it('should generate blog post with SEO optimization', async () => {
    const mockResponse = {
      content: `TITLE: How to Boost Productivity in 2024
META_DESCRIPTION: Discover proven strategies to enhance your productivity and achieve more in less time.
KEYWORDS: productivity, time management, efficiency, work-life balance, goals

# How to Boost Productivity in 2024

In today's fast-paced world, productivity has become more important than ever. This comprehensive guide will show you proven strategies to enhance your efficiency and achieve your goals.

## Understanding Productivity

Productivity isn't just about doing more tasks; it's about doing the right tasks effectively...

## Conclusion

By implementing these strategies, you can significantly improve your productivity and achieve better work-life balance.`,
      metadata: {
        wordCount: 850,
        characterCount: 4200,
      },
    };

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateBlogPost({
      contentIdea: 'How to boost productivity',
      userId: 'user_1',
      audience: mockAudience,
      preferences: mockPreferences,
      intent: 'educational',
      targetWordCount: 1000,
      seoKeywords: ['productivity', 'efficiency'],
      includeMetaDescription: true,
    });

    expect(result).toMatchObject({
      contentId: 'content_123',
      userId: 'user_1',
      platform: 'blog',
      contentType: 'blog-post',
      status: 'generated',
    });

    expect(result.metadata).toMatchObject({
      wordCount: 850,
      seoKeywords: ['productivity', 'time management', 'efficiency', 'work-life balance', 'goals'],
      title: 'How to Boost Productivity in 2024',
      metaDescription: 'Discover proven strategies to enhance your productivity and achieve more in less time.',
      qualityScore: 0.8,
      grammarScore: 0.8,
      coherenceScore: 0.8,
      safetyScore: 0.9,
    });

    expect(result.generatedText).not.toContain('TITLE:');
    expect(result.generatedText).not.toContain('META_DESCRIPTION:');
    expect(result.generatedText).not.toContain('KEYWORDS:');

    // Verify quality check was called
    expect(mockContentQualityService.validateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contentId: 'content_123',
        contentType: 'blog-post',
        generatedText: expect.any(String),
      })
    );
  });

  it('should handle blog post without metadata sections', async () => {
    const mockResponse = {
      content: `# Simple Blog Post

This is a simple blog post without metadata sections. It should still work correctly and generate appropriate metadata.

The content should be processed and cleaned properly.`,
      metadata: {
        wordCount: 25,
        characterCount: 150,
      },
    };

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateBlogPost({
      contentIdea: 'Simple blog post',
      userId: 'user_1',
    });

    expect(result.metadata.title).toBe('Simple Blog Post');
    expect(result.metadata.metaDescription).toContain('This is a simple blog post');
    expect(result.generatedText).toContain('# Simple Blog Post');
  });

  it('should analyze blog structure correctly', async () => {
    const mockResponse = {
      content: `# Main Title

## Introduction

This is the introduction paragraph.

## Section 1

Content for section 1.

## Section 2

Content for section 2.

## Conclusion

This is the conclusion paragraph.`,
      metadata: {
        wordCount: 30,
        characterCount: 200,
      },
    };

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateBlogPost({
      contentIdea: 'Structured blog post',
      userId: 'user_1',
    });

    expect(result.metadata.contentStructure).toMatchObject({
      headingCount: 5, // Updated to match actual count
      hasIntroduction: true,
      hasConclusion: true,
    });
  });

  it('should mark content as draft when quality issues are detected', async () => {
    const mockResponse = {
      content: 'Low quality content with issues',
      metadata: {
        wordCount: 5,
        characterCount: 30,
      },
    };

    // Mock quality check failure
    mockContentQualityService.validateContent.mockResolvedValue({
      isValid: false,
      qualityScore: 0.3,
      grammarScore: 0.2,
      coherenceScore: 0.4,
      safetyScore: 0.9,
      issues: [
        {
          type: 'grammar',
          severity: 'high',
          message: 'Multiple grammar errors detected',
        }
      ],
      safetyFlags: [],
      recommendations: ['Consider proofreading for grammar errors'],
      processingTime: 100,
    });

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateBlogPost({
      contentIdea: 'Poor quality content',
      userId: 'user_1',
    });

    expect(result.status).toBe('draft'); // Should be marked as draft
    expect(result.metadata.qualityScore).toBe(0.3);
    expect(result.metadata.qualityIssues).toHaveLength(1);
    expect(result.metadata.qualityRecommendations).toContain('Consider proofreading for grammar errors');
  });
});

describe('SocialMediaContentGenerator', () => {
  let generator: SocialMediaContentGenerator;
  const mockBedrockService = require('../src/services/bedrock-service').bedrockService;
  const mockContentQualityService = require('../src/services/content-quality').contentQualityService;

  beforeEach(() => {
    generator = new SocialMediaContentGenerator();
    mockBedrockService.generateContent.mockClear();
    mockContentQualityService.validateContent.mockClear();
    
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
  });

  it('should generate Twitter post with character limit optimization', async () => {
    const mockResponse = {
      content: `POST_TEXT: 🚀 Excited to share our new productivity app! It's designed to help you achieve more in less time. Try it today and transform your workflow! 
HASHTAGS: #productivity #app #workflow #efficiency
CTA: Download now and get started!`,
      metadata: {
        wordCount: 25,
        characterCount: 150,
      },
    };

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateSocialPost({
      contentIdea: 'New productivity app launch',
      userId: 'user_1',
      platform: 'twitter',
      intent: 'promotional',
      includeHashtags: true,
      maxHashtags: 2,
      includeCallToAction: true,
    });

    expect(result).toMatchObject({
      platform: 'twitter',
      contentType: 'social-post',
      status: 'generated',
    });

    expect(result.metadata.hashtags).toHaveLength(2); // Limited by maxHashtags
    expect(result.metadata.callToAction).toBe('Download now and get started!');
    expect(result.metadata.engagementElements).toMatchObject({
      hasEmojis: true,
      hasCallToAction: true,
    });

    // Should not exceed Twitter's character limit
    expect(result.generatedText.length).toBeLessThanOrEqual(280);
  });

  it('should generate Instagram post with optimal hashtags', async () => {
    const mockResponse = {
      content: `POST_TEXT: Behind the scenes of our latest photoshoot! ✨ The creativity and energy were incredible. Can't wait to share the final results with you all! 📸 What do you think?
HASHTAGS: #photoshoot #behindthescenes #creativity #photography #art #inspiration #team #work #studio #creative #process #amazing
CTA: What do you think? Comment below!`,
      metadata: {
        wordCount: 30,
        characterCount: 200,
      },
    };

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateSocialPost({
      contentIdea: 'Behind the scenes photoshoot',
      userId: 'user_1',
      platform: 'instagram',
      intent: 'entertainment',
      includeHashtags: true,
    });

    expect(result.platform).toBe('instagram');
    expect(result.metadata.hashtags.length).toBeLessThanOrEqual(30); // Instagram limit
    expect(result.metadata.engagementElements.hasEmojis).toBe(true);
    expect(result.metadata.engagementElements.hasQuestion).toBe(true);
  });

  it('should handle long content by truncating appropriately', async () => {
    const longContent = 'A'.repeat(300); // Exceeds Twitter limit
    const mockResponse = {
      content: `POST_TEXT: ${longContent}
HASHTAGS: #test
CTA: Click here`,
      metadata: {
        wordCount: 1,
        characterCount: 300,
      },
    };

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateSocialPost({
      contentIdea: 'Long content test',
      userId: 'user_1',
      platform: 'twitter',
    });

    expect(result.generatedText.length).toBeLessThanOrEqual(280);
    expect(result.generatedText).toContain('...');
  });
});

describe('CaptionContentGenerator', () => {
  let generator: CaptionContentGenerator;
  const mockBedrockService = require('../src/services/bedrock-service').bedrockService;
  const mockContentQualityService = require('../src/services/content-quality').contentQualityService;

  beforeEach(() => {
    generator = new CaptionContentGenerator();
    mockBedrockService.generateContent.mockClear();
    mockContentQualityService.validateContent.mockClear();
    
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
  });

  it('should generate Instagram caption with emojis and hashtags', async () => {
    const mockResponse = {
      content: `CAPTION: Just finished an amazing workout session! 💪 Feeling energized and ready to tackle the day. Remember, consistency is key to achieving your fitness goals!
HASHTAGS: #fitness #workout #motivation #health #gym #strength #goals #consistency #energy #lifestyle
CTA: What's your favorite workout? Tell us in the comments!`,
      metadata: {
        wordCount: 25,
        characterCount: 150,
      },
    };

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateCaption({
      contentIdea: 'Post-workout motivation',
      userId: 'user_1',
      platform: 'instagram',
      intent: 'entertainment',
      includeEmojis: true,
      hashtagStrategy: 'trending',
    });

    expect(result).toMatchObject({
      platform: 'instagram',
      contentType: 'caption',
      status: 'generated',
    });

    expect(result.metadata.hashtags.length).toBeLessThanOrEqual(11); // Instagram optimal
    expect(result.metadata.emojiCount).toBeGreaterThan(0);
    expect(result.metadata.visualContent).toBe(true);
    expect(result.metadata.engagementOptimized).toBe(true);
    expect(result.metadata.callToAction).toContain('comments');
  });

  it('should optimize hashtags based on strategy', async () => {
    const mockResponse = {
      content: `CAPTION: Testing hashtag optimization
HASHTAGS: #verylonghashtagnamethatexceedslimit #short #medium #anotherlongone #brief #test #sample
CTA: Engage with us!`,
      metadata: {
        wordCount: 10,
        characterCount: 50,
      },
    };

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateCaption({
      contentIdea: 'Hashtag strategy test',
      userId: 'user_1',
      platform: 'instagram',
      hashtagStrategy: 'trending', // Should filter out long hashtags
    });

    // Trending strategy should filter out hashtags longer than 15 characters
    const longHashtags = result.metadata.hashtags.filter(tag => tag.length > 15);
    expect(longHashtags.length).toBe(0);
  });

  it('should add emojis when none are present', async () => {
    const mockResponse = {
      content: `CAPTION: This is a caption without any emojis at all
HASHTAGS: #test #sample
CTA: Like and share`,
      metadata: {
        wordCount: 10,
        characterCount: 50,
      },
    };

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateCaption({
      contentIdea: 'Caption without emojis',
      userId: 'user_1',
      platform: 'instagram',
      intent: 'educational',
      includeEmojis: true,
    });

    expect(result.metadata.emojiCount).toBeGreaterThan(0);
    // Check that the text contains an emoji (any emoji from the educational set)
    expect(result.generatedText).toMatch(/[📚💡🎯📈🧠]/);
  });
});

describe('ScriptContentGenerator', () => {
  let generator: ScriptContentGenerator;
  const mockBedrockService = require('../src/services/bedrock-service').bedrockService;
  const mockContentQualityService = require('../src/services/content-quality').contentQualityService;

  beforeEach(() => {
    generator = new ScriptContentGenerator();
    mockBedrockService.generateContent.mockClear();
    mockContentQualityService.validateContent.mockClear();
    
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
  });

  it('should generate script with timing cues and speaker notes', async () => {
    const mockResponse = {
      content: `TITLE: How to Use Our New Feature
DURATION: 60 seconds
WORD_COUNT: 150

[00:00-00:05] INTRO: Welcome to our tutorial on the new feature
[00:05-00:15] MAIN_POINT_1: First, let's explore the main interface
[00:15-00:30] MAIN_POINT_2: Now, let's see how to configure settings
[00:30-00:50] DEMONSTRATION: Here's a practical example
[00:50-01:00] CONCLUSION: That's how you use the new feature`,
      metadata: {
        wordCount: 150,
        characterCount: 800,
      },
    };

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateScript({
      contentIdea: 'Tutorial for new feature',
      userId: 'user_1',
      intent: 'educational',
      duration: 60,
      includeTimingCues: true,
      includeSpeakerNotes: true,
      scriptType: 'video',
    });

    expect(result).toMatchObject({
      platform: 'youtube',
      contentType: 'script',
      status: 'generated',
    });

    expect(result.metadata.scriptDuration).toBe(60);
    expect(result.metadata.scriptType).toBe('video');
    expect(result.metadata.speakerNotes).toBe(true);
    expect(result.metadata.estimatedWords).toBe(150); // 60 seconds * 150 WPM / 60

    expect(result.generatedText).toContain('[00:00-00:05]');
    expect(result.generatedText).toContain('SPEAKER NOTES');
    expect(result.generatedText).toContain('VISUAL: Maintain eye contact');
  });

  it('should enhance script with timing cues when not present', async () => {
    const mockResponse = {
      content: `Welcome to our tutorial.

First, let's explore the interface.

Now, let's configure the settings.

Here's a practical example.

That concludes our tutorial.`,
      metadata: {
        wordCount: 20,
        characterCount: 150,
      },
    };

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateScript({
      contentIdea: 'Simple tutorial',
      userId: 'user_1',
      duration: 30,
      includeTimingCues: true,
    });

    expect(result.generatedText).toContain('[00:00-');
    expect(result.generatedText).toContain('SEGMENT_');
  });

  it('should add appropriate speaker notes based on script type', async () => {
    const mockResponse = {
      content: 'This is a simple audio script for a podcast episode.',
      metadata: {
        wordCount: 10,
        characterCount: 50,
      },
    };

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateScript({
      contentIdea: 'Podcast episode',
      userId: 'user_1',
      scriptType: 'audio',
      includeSpeakerNotes: true,
    });

    expect(result.generatedText).toContain('SPEAKER NOTES');
    expect(result.generatedText).toContain('VOICE: Vary tone');
    expect(result.generatedText).toContain('PACING: Include natural pauses');
  });

  it('should estimate words correctly for duration', async () => {
    const mockResponse = {
      content: 'Test script content',
      metadata: {
        wordCount: 10,
        characterCount: 50,
      },
    };

    mockBedrockService.generateContent.mockResolvedValue(mockResponse);

    const result = await generator.generateScript({
      contentIdea: 'Test script',
      userId: 'user_1',
      duration: 120, // 2 minutes
    });

    expect(result.metadata.estimatedWords).toBe(300); // 2 minutes * 150 WPM
  });
});

describe('generatePlatformContent', () => {
  const mockBedrockService = require('../src/services/bedrock-service').bedrockService;
  const mockContentQualityService = require('../src/services/content-quality').contentQualityService;

  beforeEach(() => {
    mockBedrockService.generateContent.mockClear();
    mockContentQualityService.validateContent.mockClear();
    
    mockBedrockService.generateContent.mockResolvedValue({
      content: 'Generated content',
      metadata: { wordCount: 10, characterCount: 50 },
    });
    
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
  });

  it('should route to correct generator based on content type', async () => {
    const baseOptions = {
      contentIdea: 'Test content',
      userId: 'user_1',
    };

    // Test blog post
    const blogResult = await generatePlatformContent('blog-post', baseOptions);
    expect(blogResult.contentType).toBe('blog-post');
    expect(blogResult.platform).toBe('blog');

    // Test social post
    const socialResult = await generatePlatformContent('social-post', {
      ...baseOptions,
      platform: 'twitter',
    });
    expect(socialResult.contentType).toBe('social-post');
    expect(socialResult.platform).toBe('twitter');

    // Test caption
    const captionResult = await generatePlatformContent('caption', {
      ...baseOptions,
      platform: 'instagram',
    });
    expect(captionResult.contentType).toBe('caption');
    expect(captionResult.platform).toBe('instagram');

    // Test script
    const scriptResult = await generatePlatformContent('script', baseOptions);
    expect(scriptResult.contentType).toBe('script');
    expect(scriptResult.platform).toBe('youtube');
  });

  it('should throw error for social post without platform', async () => {
    await expect(generatePlatformContent('social-post', {
      contentIdea: 'Test',
      userId: 'user_1',
    })).rejects.toThrow('Platform is required for social media posts');
  });

  it('should throw error for caption without platform', async () => {
    await expect(generatePlatformContent('caption', {
      contentIdea: 'Test',
      userId: 'user_1',
    })).rejects.toThrow('Platform is required for captions');
  });

  it('should throw error for unsupported content type', async () => {
    await expect(generatePlatformContent('unsupported' as ContentType, {
      contentIdea: 'Test',
      userId: 'user_1',
    })).rejects.toThrow('Unsupported content type: unsupported');
  });
});

describe('Generator Instances', () => {
  it('should export singleton instances', () => {
    expect(blogGenerator).toBeInstanceOf(BlogContentGenerator);
    expect(socialMediaGenerator).toBeInstanceOf(SocialMediaContentGenerator);
    expect(captionGenerator).toBeInstanceOf(CaptionContentGenerator);
    expect(scriptGenerator).toBeInstanceOf(ScriptContentGenerator);
  });
});

describe('Error Handling', () => {
  const mockBedrockService = require('../src/services/bedrock-service').bedrockService;
  const mockContentQualityService = require('../src/services/content-quality').contentQualityService;

  beforeEach(() => {
    mockBedrockService.generateContent.mockClear();
    mockContentQualityService.validateContent.mockClear();
  });

  it('should handle bedrock service errors gracefully', async () => {
    mockBedrockService.generateContent.mockRejectedValue(new Error('Bedrock service error'));

    await expect(blogGenerator.generateBlogPost({
      contentIdea: 'Test blog',
      userId: 'user_1',
    })).rejects.toThrow('Blog post generation failed: Bedrock service error');
  });

  it('should handle social media generation errors', async () => {
    mockBedrockService.generateContent.mockRejectedValue(new Error('Network error'));

    await expect(socialMediaGenerator.generateSocialPost({
      contentIdea: 'Test post',
      userId: 'user_1',
      platform: 'twitter',
    })).rejects.toThrow('Social media post generation failed: Network error');
  });

  it('should handle caption generation errors', async () => {
    mockBedrockService.generateContent.mockRejectedValue(new Error('API error'));

    await expect(captionGenerator.generateCaption({
      contentIdea: 'Test caption',
      userId: 'user_1',
      platform: 'instagram',
    })).rejects.toThrow('Caption generation failed: API error');
  });

  it('should handle script generation errors', async () => {
    mockBedrockService.generateContent.mockRejectedValue(new Error('Service unavailable'));

    await expect(scriptGenerator.generateScript({
      contentIdea: 'Test script',
      userId: 'user_1',
    })).rejects.toThrow('Script generation failed: Service unavailable');
  });
});