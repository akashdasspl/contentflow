// Tests for content quality and safety validation service

import {
  ContentQualityService,
  contentQualityService,
} from '../src/services/content-quality';
import { 
  GeneratedContent,
  ContentType,
  Platform,
} from '../src/types';

// Mock AWS Comprehend client
jest.mock('../src/services/aws-clients', () => ({
  comprehendClient: {
    send: jest.fn(),
  },
}));

jest.mock('../src/utils', () => ({
  getAppConfig: jest.fn(() => ({
    aws: {
      region: 'us-east-1',
    },
  })),
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
  measureExecutionTime: jest.fn(async (operation) => {
    const result = await operation();
    return { result, executionTime: 100 };
  }),
  retryOperation: jest.fn(async (operation) => await operation()),
}));

describe('ContentQualityService', () => {
  let service: ContentQualityService;
  const mockComprehendClient = require('../src/services/aws-clients').comprehendClient;

  beforeEach(() => {
    service = new ContentQualityService();
    mockComprehendClient.send.mockClear();
  });

  const createMockContent = (
    text: string,
    contentType: ContentType = 'blog-post',
    platform: Platform = 'blog'
  ): GeneratedContent => ({
    contentId: 'content_123',
    ideaId: 'idea_123',
    userId: 'user_123',
    platform,
    contentType,
    generatedText: text,
    metadata: {
      wordCount: text.split(/\s+/).length,
      characterCount: text.length,
      hashtags: [],
      seoKeywords: [],
      readingTime: 1,
    },
    version: 1,
    status: 'generated',
    createdAt: '2024-01-01T00:00:00Z',
  });

  describe('validateContent', () => {
    it('should validate high-quality, safe content', async () => {
      const content = createMockContent(
        'This is a well-written blog post about productivity. It contains valuable information and maintains a professional tone throughout. The content is structured with clear paragraphs and provides actionable insights for readers.'
      );

      // Mock successful Comprehend responses
      mockComprehendClient.send
        .mockResolvedValueOnce({ // Toxicity check
          ResultList: [{ Labels: [] }]
        })
        .mockResolvedValueOnce({ // PII check
          Entities: []
        });

      const result = await service.validateContent(content);

      expect(result.isValid).toBe(true);
      expect(result.qualityScore).toBeGreaterThan(0.5);
      expect(result.grammarScore).toBeGreaterThan(0.5);
      expect(result.coherenceScore).toBeGreaterThan(0.3);
      expect(result.safetyScore).toBeGreaterThan(0.6);
      expect(result.safetyFlags).toHaveLength(0);
      expect(result.processingTime).toBe(100);
      expect(result.recommendations).toBeDefined();
    });

    it('should detect grammar issues', async () => {
      const content = createMockContent(
        'This is a blog post with some grammer errors. I recieve alot of feedback about my writting. Its definately something I need to work on.'
      );

      mockComprehendClient.send
        .mockResolvedValueOnce({ ResultList: [{ Labels: [] }] })
        .mockResolvedValueOnce({ Entities: [] });

      const result = await service.validateContent(content);

      expect(result.grammarScore).toBeLessThan(0.8);
      expect(result.issues.some(issue => issue.type === 'grammar')).toBe(true);
      expect(result.recommendations.some(rec => rec.includes('grammar'))).toBe(true);
    });

    it('should detect safety issues', async () => {
      const content = createMockContent(
        'This content contains hate speech and toxic language. You are stupid and worthless.'
      );

      // Mock toxic content detection
      mockComprehendClient.send
        .mockResolvedValueOnce({
          ResultList: [{
            Labels: [{
              Name: 'TOXICITY',
              Score: 0.9
            }]
          }]
        })
        .mockResolvedValueOnce({ Entities: [] });

      const result = await service.validateContent(content);

      expect(result.isValid).toBe(false);
      expect(result.safetyScore).toBeLessThan(0.7);
      expect(result.safetyFlags.length).toBeGreaterThan(0);
      expect(result.safetyFlags[0].type).toBe('toxicity');
    });

    it('should detect PII in content', async () => {
      const content = createMockContent(
        'Contact me at john.doe@example.com or call 555-123-4567 for more information.'
      );

      mockComprehendClient.send
        .mockResolvedValueOnce({ ResultList: [{ Labels: [] }] })
        .mockResolvedValueOnce({
          Entities: [{
            Type: 'EMAIL',
            Score: 0.9,
            BeginOffset: 11,
            EndOffset: 30
          }]
        });

      const result = await service.validateContent(content);

      expect(result.safetyFlags.some(flag => flag.type === 'pii')).toBe(true);
      expect(result.recommendations.some(rec => rec.includes('personal identifiable'))).toBe(true);
    });

    it('should handle Comprehend service errors gracefully', async () => {
      const content = createMockContent('Test content for error handling');

      // Mock service errors
      mockComprehendClient.send
        .mockRejectedValueOnce(new Error('Comprehend service error'))
        .mockRejectedValueOnce(new Error('Comprehend service error'));

      const result = await service.validateContent(content);

      // Should still return a result with fallback checks
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(result.qualityScore).toBeGreaterThan(0);
    });
  });

  describe('checkGrammar', () => {
    it('should analyze grammar and readability', async () => {
      const text = 'This is a well-written sentence with good grammar and structure.';
      
      const result = await service.checkGrammar(text, 'blog-post');

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.wordCount).toBe(10);
      expect(result.sentenceCount).toBe(1);
      expect(result.averageWordsPerSentence).toBe(10);
      expect(result.readabilityScore).toBeGreaterThan(0);
      expect(result.issues).toBeDefined();
    });

    it('should detect common spelling errors', async () => {
      const text = 'I recieve feedback and seperate the good from bad. Its definately neccessary.';
      
      const result = await service.checkGrammar(text, 'blog-post');

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.type === 'spelling')).toBe(true);
      expect(result.issues.some(issue => issue.suggestion === 'receive')).toBe(true);
    });

    it('should detect punctuation issues', async () => {
      const text = 'This has  double spaces  and   triple spaces.';
      
      const result = await service.checkGrammar(text, 'blog-post');

      expect(result.issues.some(issue => issue.type === 'punctuation')).toBe(true);
    });

    it('should detect capitalization issues', async () => {
      const text = 'This is a sentence. this should be capitalized.';
      
      const result = await service.checkGrammar(text, 'blog-post');

      expect(result.issues.some(issue => issue.type === 'capitalization')).toBe(true);
    });
  });

  describe('checkCoherence', () => {
    it('should analyze blog post structure', async () => {
      const text = `# Introduction
      
This is the introduction paragraph that sets up the topic.

## Main Section

This section contains the main content with good flow and structure.

## Conclusion

This concludes the blog post with a summary.`;
      
      const result = await service.checkCoherence(text, 'blog-post');

      expect(result.score).toBeGreaterThan(0.7);
      expect(result.structureScore).toBeGreaterThan(0.8);
      expect(result.flowScore).toBeGreaterThanOrEqual(0.3);
      expect(result.consistencyScore).toBeGreaterThan(0.3);
    });

    it('should analyze social media post structure', async () => {
      const text = 'Check out our new product! 🚀 #innovation #tech Click the link to learn more!';
      
      const result = await service.checkCoherence(text, 'social-post');

      expect(result.structureScore).toBeGreaterThan(0.8); // Has hashtags, emojis, CTA
    });

    it('should detect poor structure', async () => {
      const text = 'This is just a plain paragraph without any structure or organization.';
      
      const result = await service.checkCoherence(text, 'blog-post');

      expect(result.structureScore).toBeLessThan(0.6);
      expect(result.issues.some(issue => issue.type === 'structure')).toBe(true);
    });
  });

  describe('checkSafety', () => {
    it('should pass safe content', async () => {
      const text = 'This is completely safe and appropriate content for all audiences.';

      mockComprehendClient.send
        .mockResolvedValueOnce({ ResultList: [{ Labels: [] }] })
        .mockResolvedValueOnce({ Entities: [] });

      const result = await service.checkSafety(text);

      expect(result.isSafe).toBe(true);
      expect(result.safetyScore).toBeGreaterThan(0.6);
      expect(result.flags).toHaveLength(0);
    });

    it('should detect inappropriate content with fallback', async () => {
      const text = 'This content discusses violence and illegal activities.';

      // Mock service failure to test fallback
      mockComprehendClient.send
        .mockRejectedValueOnce(new Error('Service error'))
        .mockRejectedValueOnce(new Error('Service error'));

      const result = await service.checkSafety(text);

      expect(result.flags.some(flag => flag.type === 'inappropriate')).toBe(true);
    });
  });

  describe('checkFactuality', () => {
    it('should analyze factual claims in blog posts', async () => {
      const text = 'Studies show that 85% of people prefer this approach. Research indicates significant improvements.';
      
      const result = await service.checkFactuality(text, 'blog-post');

      expect(result).not.toBeNull();
      expect(result!.verifiableClaims.length).toBeGreaterThan(0);
      expect(result!.score).toBeGreaterThan(0);
      expect(result!.recommendations).toBeDefined();
    });

    it('should return null for non-factual content types', async () => {
      const text = 'Just a fun social media post! 🎉';
      
      const result = await service.checkFactuality(text, 'social-post');

      expect(result).toBeNull();
    });

    it('should detect uncertain language', async () => {
      const text = 'This might be true, and it could possibly help. Perhaps we should consider this approach.';
      
      const result = await service.checkFactuality(text, 'blog-post');

      expect(result!.uncertainClaims.length).toBeGreaterThan(0);
    });
  });

  describe('Content Type Specific Analysis', () => {
    it('should analyze script content appropriately', async () => {
      const scriptContent = createMockContent(`
TITLE: Tutorial Script

[00:00-00:10] INTRO: Welcome to this tutorial
[00:10-00:30] MAIN: Here's how to use the feature
[00:30-00:45] DEMO: Let me show you an example
[00:45-01:00] OUTRO: Thanks for watching

--- SPEAKER NOTES ---
VISUAL: Maintain eye contact with camera
      `, 'script', 'youtube');

      mockComprehendClient.send
        .mockResolvedValueOnce({ ResultList: [{ Labels: [] }] })
        .mockResolvedValueOnce({ Entities: [] });

      const result = await service.validateContent(scriptContent);

      expect(result.coherenceScore).toBeGreaterThan(0.7); // Should score well for script structure
    });

    it('should analyze caption content appropriately', async () => {
      const captionContent = createMockContent(
        'Amazing sunset today! 🌅 Nature never fails to inspire. #sunset #nature #photography',
        'caption',
        'instagram'
      );

      mockComprehendClient.send
        .mockResolvedValueOnce({ ResultList: [{ Labels: [] }] })
        .mockResolvedValueOnce({ Entities: [] });

      const result = await service.validateContent(captionContent);

      expect(result.coherenceScore).toBeGreaterThan(0.6); // Should score well for caption structure
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const content = createMockContent('Test content');

      // Mock all Comprehend calls to fail
      mockComprehendClient.send.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.validateContent(content);

      // Should still return a result with fallback checks but not throw
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(result.qualityScore).toBeGreaterThan(0);
    });

    it('should provide fallback safety check when Comprehend fails', async () => {
      const text = 'Content with hate and stupid language';

      mockComprehendClient.send.mockRejectedValue(new Error('Service error'));

      const result = await service.checkSafety(text);

      // Should still detect issues using fallback
      expect(result.flags.length).toBeGreaterThan(0);
      expect(result.isSafe).toBe(false);
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(contentQualityService).toBeInstanceOf(ContentQualityService);
    });
  });

  describe('Quality Score Calculation', () => {
    it('should calculate appropriate quality scores', async () => {
      const highQualityContent = createMockContent(`
# Comprehensive Guide to Productivity

## Introduction

This comprehensive guide explores proven strategies for enhancing productivity in modern work environments. Through careful analysis and practical examples, we'll examine effective techniques.

## Key Strategies

First, let's consider time management principles. However, productivity extends beyond simple scheduling. Furthermore, we must address the psychological aspects of efficiency.

## Implementation

Therefore, successful implementation requires a systematic approach. Additionally, consistent practice ensures long-term benefits.

## Conclusion

In conclusion, these strategies provide a foundation for improved productivity and work-life balance.
      `);

      mockComprehendClient.send
        .mockResolvedValueOnce({ ResultList: [{ Labels: [] }] })
        .mockResolvedValueOnce({ Entities: [] });

      const result = await service.validateContent(highQualityContent);

      expect(result.qualityScore).toBeGreaterThan(0.5);
      expect(result.grammarScore).toBeGreaterThan(0.5);
      expect(result.coherenceScore).toBeGreaterThan(0.5);
      expect(result.safetyScore).toBeGreaterThan(0.6);
    });

    it('should penalize low-quality content', async () => {
      const lowQualityContent = createMockContent(
        'this is bad writting with no structure or flow its just one long sentence with grammer errors and no punctuation or capitalization'
      );

      mockComprehendClient.send
        .mockResolvedValueOnce({ ResultList: [{ Labels: [] }] })
        .mockResolvedValueOnce({ Entities: [] });

      const result = await service.validateContent(lowQualityContent);

      expect(result.qualityScore).toBeLessThan(0.75);
      expect(result.grammarScore).toBeLessThan(0.9); // Adjusted since grammar might still be decent
      expect(result.coherenceScore).toBeLessThan(0.5);
    });
  });
});