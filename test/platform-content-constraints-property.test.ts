// Property-based test for platform-specific content constraints
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Platform } from '../src/types';

jest.mock('../src/services/aws-clients');
jest.mock('../src/services/database');

const mockBedrockService = { generateContent: jest.fn() };
const mockContentQualityService = { validateContent: jest.fn() };
const mockUtils = {
  getPlatformConstraints: jest.fn(),
  calculateReadingTime: jest.fn(),
  extractKeywords: jest.fn(),
  generateContentId: jest.fn(),
  generateIdeaId: jest.fn(),
  getCurrentTimestamp: jest.fn(),
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
};

jest.mock('../src/services/bedrock-service', () => ({ bedrockService: mockBedrockService }));
jest.mock('../src/services/content-quality', () => ({ contentQualityService: mockContentQualityService }));
jest.mock('../src/utils', () => mockUtils);

import { blogGenerator, socialMediaGenerator, captionGenerator, scriptGenerator } from '../src/services/content-generators';

function generateRandomContentIdea(): string {
  const ideas = ['How to improve productivity', 'Top 10 tips for healthy eating', 'The future of AI'];
  return ideas[Math.floor(Math.random() * ideas.length)];
}

describe('Property Test: Platform-Specific Content Constraints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockUtils.getPlatformConstraints as any).mockImplementation((platform: string) => {
      const constraints: Record<string, any> = {
        twitter: { maxLength: 280, hashtagLimit: 2 },
        instagram: { maxLength: 2200, hashtagLimit: 30 },
        linkedin: { maxLength: 3000, hashtagLimit: 5 },
        blog: { minLength: 800, maxLength: 2000 },
      };
      return constraints[platform] || {};
    });
    (mockUtils.calculateReadingTime as any).mockImplementation((text: string) => Math.ceil(text.split(/\s+/).length / 200));
    (mockUtils.extractKeywords as any).mockImplementation((text: string) => text.split(/\s+/).slice(0, 5));
    (mockUtils.generateContentId as any).mockReturnValue('content-123');
    (mockUtils.generateIdeaId as any).mockReturnValue('idea-123');
    (mockUtils.getCurrentTimestamp as any).mockReturnValue('2024-01-01T00:00:00Z');
    (mockBedrockService.generateContent as any).mockImplementation((options: any) => {
      const { contentType, platform } = options;
      let content = '';
      let wordCount = 0;
      if (contentType === 'blog-post') {
        content = 'TITLE: Test\nMETA_DESCRIPTION: Test\n\n' + 'Blog content. '.repeat(150);
        wordCount = 1200;
      } else if (contentType === 'social-post') {
        content = 'POST_TEXT: Social post\nHASHTAGS: #test\nCTA: Learn more';
        wordCount = content.split(/\s+/).length;
      } else if (contentType === 'caption') {
        content = 'CAPTION: Caption\nHASHTAGS: #test\nCTA: Check it out';
        wordCount = content.split(/\s+/).length;
      } else if (contentType === 'script') {
        content = 'TITLE: Script\n[00:00-00:10] INTRO: Welcome';
        wordCount = content.split(/\s+/).length;
      }
      return Promise.resolve({ content, metadata: { wordCount, characterCount: content.length, modelId: 'test', inputTokens: 100, outputTokens: 200 } });
    });
    (mockContentQualityService.validateContent as any).mockResolvedValue({
      isValid: true, qualityScore: 0.9, grammarScore: 0.95, coherenceScore: 0.85, safetyScore: 1.0,
      issues: [], safetyFlags: [], recommendations: []
    });
  });

  it('should respect blog word count constraints (800-2000 words)', async () => {
    for (let i = 0; i < 30; i++) {
      const result = await blogGenerator.generateBlogPost({ contentIdea: generateRandomContentIdea(), userId: 'test-user', targetWordCount: 1200 });
      expect(result.metadata.wordCount).toBeGreaterThanOrEqual(800);
      expect(result.metadata.wordCount).toBeLessThanOrEqual(2000);
      expect(result.platform).toBe('blog');
    }
  });

  it('should respect Twitter character limit (280 chars)', async () => {
    for (let i = 0; i < 25; i++) {
      const result = await socialMediaGenerator.generateSocialPost({ contentIdea: generateRandomContentIdea(), userId: 'test-user', platform: 'twitter' });
      expect(result.generatedText.length).toBeLessThanOrEqual(280);
      expect(result.platform).toBe('twitter');
    }
  });

  it('should respect Instagram character limit (2200 chars)', async () => {
    for (let i = 0; i < 25; i++) {
      const result = await socialMediaGenerator.generateSocialPost({ contentIdea: generateRandomContentIdea(), userId: 'test-user', platform: 'instagram' });
      expect(result.generatedText.length).toBeLessThanOrEqual(2200);
      expect(result.platform).toBe('instagram');
    }
  });

  it('should respect hashtag limits for all platforms', async () => {
    const platforms: Array<{ platform: Platform; limit: number }> = [
      { platform: 'twitter', limit: 2 },
      { platform: 'instagram', limit: 30 },
      { platform: 'linkedin', limit: 5 },
    ];
    for (const { platform, limit } of platforms) {
      for (let i = 0; i < 20; i++) {
        const result = await socialMediaGenerator.generateSocialPost({ contentIdea: generateRandomContentIdea(), userId: 'test-user', platform, includeHashtags: true });
        expect(result.metadata.hashtags.length).toBeLessThanOrEqual(limit);
      }
    }
  });

  it('should include required elements for captions (hashtags and CTA)', async () => {
    const platforms: Platform[] = ['instagram', 'facebook', 'tiktok'];
    for (const platform of platforms) {
      for (let i = 0; i < 20; i++) {
        const result = await captionGenerator.generateCaption({ contentIdea: generateRandomContentIdea(), userId: 'test-user', platform });
        expect(result.metadata.hashtags).toBeDefined();
        expect(Array.isArray(result.metadata.hashtags)).toBe(true);
        expect(result.metadata.callToAction).toBeDefined();
        expect(result.contentType).toBe('caption');
      }
    }
  });

  it('should include timing cues for scripts when requested', async () => {
    for (let i = 0; i < 20; i++) {
      const duration = Math.floor(Math.random() * 270) + 30;
      const result = await scriptGenerator.generateScript({ contentIdea: generateRandomContentIdea(), userId: 'test-user', duration, includeTimingCues: true });
      expect(result.contentType).toBe('script');
      expect(result.metadata.scriptDuration).toBe(duration);
      expect(result.metadata.timingCues).toBeDefined();
    }
  });

  it('should include speaker notes for scripts when requested', async () => {
    const scriptTypes: Array<'video' | 'audio' | 'presentation'> = ['video', 'audio', 'presentation'];
    for (const scriptType of scriptTypes) {
      for (let i = 0; i < 15; i++) {
        const result = await scriptGenerator.generateScript({ contentIdea: generateRandomContentIdea(), userId: 'test-user', duration: 60, includeSpeakerNotes: true, scriptType });
        expect(result.metadata.speakerNotes).toBe(true);
        expect(result.metadata.scriptType).toBe(scriptType);
      }
    }
  });
});
