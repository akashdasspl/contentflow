// End-to-end workflow validation test for ContentFlow AI
// This test validates the complete content generation workflow

import { themeExtractionService } from '../src/services/theme-extraction';
import { audienceAnalysisService } from '../src/services/audience-analysis';
import { platformOptimizationService } from '../src/services/platform-optimization';
import { contentQualityService } from '../src/services/content-quality';
import { contentVariationService } from '../src/services/content-variations';

// Mock all external dependencies
jest.mock('../src/services/bedrock-service', () => ({
  bedrockService: {
    generateContent: jest.fn().mockResolvedValue({
      content: 'Generated content for testing',
      metadata: {
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        processingTime: 1000,
        tokenUsage: { inputTokens: 100, outputTokens: 200 },
        contentType: 'blog-post',
        platform: 'blog',
        wordCount: 150,
        characterCount: 800,
      },
    }),
    testConnection: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../src/services/aws-clients', () => ({
  comprehendClient: { 
    send: jest.fn().mockResolvedValue({
      Languages: [{ LanguageCode: 'en', Score: 0.99 }],
      KeyPhrases: [
        { Text: 'business strategy', Score: 0.95 },
        { Text: 'productivity improvement', Score: 0.88 },
      ],
      Entities: [
        { Text: 'business', Type: 'OTHER', Score: 0.92 },
      ],
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.4, Negative: 0.1, Neutral: 0.45, Mixed: 0.05 },
    }),
  },
  dynamoDBDocClient: { send: jest.fn() },
  s3Client: { send: jest.fn() },
}));

jest.mock('../src/services/database', () => ({
  DatabaseService: jest.fn().mockImplementation(() => ({
    put: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    query: jest.fn().mockResolvedValue({ Items: [] }),
  })),
  contentIdeaService: {
    createContentIdea: jest.fn().mockResolvedValue({
      ideaId: 'idea-123',
      userId: 'user-123',
      content: 'Test content idea',
      extractedThemes: ['business', 'strategy'],
      targetAudience: { demographics: { ageRange: '25-45' } },
      intent: 'educational',
      confidenceScore: 0.85,
      createdAt: new Date().toISOString(),
    }),
    updateContentIdea: jest.fn().mockResolvedValue({}),
  },
  generatedContentService: {
    createGeneratedContent: jest.fn().mockResolvedValue({
      contentId: 'content-123',
      ideaId: 'idea-123',
      userId: 'user-123',
      platform: 'blog',
      contentType: 'blog-post',
      generatedText: 'Generated blog post content',
      metadata: {
        wordCount: 150,
        hashtags: ['#business', '#strategy'],
        seoKeywords: ['business', 'strategy'],
        readingTime: 1,
      },
      version: 1,
      status: 'generated',
      createdAt: new Date().toISOString(),
    }),
    updateGeneratedContent: jest.fn().mockResolvedValue({}),
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
  logWarning: jest.fn(),
  retryOperation: jest.fn((operation) => operation()),
  measureExecutionTime: jest.fn(async (operation) => ({
    result: await operation(),
    executionTime: 1000,
  })),
  generateContentId: jest.fn(() => 'content-123'),
  generateIdeaId: jest.fn(() => 'idea-123'),
  getCurrentTimestamp: jest.fn(() => new Date().toISOString()),
  calculateReadingTime: jest.fn(() => 1),
  extractKeywords: jest.fn(() => ['business', 'strategy']),
  getPlatformConstraints: jest.fn(() => ({ maxLength: 2000, minLength: 800 })),
}));

describe('End-to-End Content Generation Workflow', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Complete Content Generation Workflow', () => {
    it('should process content idea through complete workflow', async () => {
      const contentIdea = 'How to improve business productivity using modern strategies';

      // Step 1: Extract themes and topics
      const themeExtractionResult = await themeExtractionService.extractThemesAndTopics(contentIdea);
      
      expect(themeExtractionResult).toBeDefined();
      expect(themeExtractionResult.themes).toBeInstanceOf(Array);
      expect(themeExtractionResult.topics).toBeInstanceOf(Array);

      // Step 2: Analyze audience and intent
      const audienceAnalysisResult = await audienceAnalysisService.analyzeAudience(contentIdea);

      expect(audienceAnalysisResult).toBeDefined();
      expect(audienceAnalysisResult.demographics).toBeDefined();
      expect(audienceAnalysisResult.behaviorPatterns).toBeDefined();
      expect(audienceAnalysisResult.confidenceScore).toBeGreaterThan(0);

      // Step 3: Generate content variations
      const variationOptions = {
        contentIdea,
        contentType: 'blog-post' as const,
        platform: 'blog' as const,
        variationCount: 3,
        userId: 'user-123',
      };

      const variations = await contentVariationService.generateVariations(variationOptions);

      expect(variations).toBeDefined();
      expect(variations.variations).toBeInstanceOf(Array);
      expect(variations.variations.length).toBeGreaterThan(0);

      // Step 4: Apply platform optimization
      const mockContent = {
        contentId: 'content-123',
        ideaId: 'idea-123',
        userId: 'user-123',
        platform: 'blog' as const,
        contentType: 'blog-post' as const,
        generatedText: 'Test blog content for optimization',
        metadata: {
          wordCount: 150,
          hashtags: ['#business'],
          seoKeywords: ['business'],
          readingTime: 1,
        },
        version: 1,
        status: 'generated' as const,
        createdAt: new Date().toISOString(),
      };

      const optimizedResult = await platformOptimizationService.optimizeForPlatform({
        content: mockContent,
        targetPlatform: 'blog',
      });

      expect(optimizedResult).toBeDefined();

      // Step 5: Quality assessment
      const qualityResult = await contentQualityService.validateContent(mockContent);

      expect(qualityResult).toBeDefined();
      expect(qualityResult.qualityScore).toBeGreaterThan(0);
      expect(qualityResult.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should handle errors gracefully in the workflow', async () => {
      const contentIdea = '';

      // Test with empty content idea
      await expect(
        themeExtractionService.extractThemesAndTopics(contentIdea)
      ).rejects.toThrow();
    });

    it('should maintain consistency across platforms', async () => {
      const contentIdea = 'Professional business communication strategies';

      // Extract themes
      const themeResult = await themeExtractionService.extractThemesAndTopics(contentIdea);
      expect(themeResult).toBeDefined();

      // Analyze audience
      const audienceResult = await audienceAnalysisService.analyzeAudience(contentIdea);
      expect(audienceResult).toBeDefined();

      // Generate variations for different platforms
      const blogVariations = await contentVariationService.generateVariations({
        contentIdea,
        contentType: 'blog-post',
        platform: 'blog',
        variationCount: 2,
        userId: 'user-123',
      });

      const socialVariations = await contentVariationService.generateVariations({
        contentIdea,
        contentType: 'social-post',
        platform: 'linkedin',
        variationCount: 2,
        userId: 'user-123',
      });

      expect(blogVariations.variations.length).toBe(2);
      expect(socialVariations.variations.length).toBe(2);
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete workflow within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const contentIdea = 'Quick test content idea';
      
      // Run a simplified workflow
      const themeResult = await themeExtractionService.extractThemesAndTopics(contentIdea);
      const audienceResult = await audienceAnalysisService.analyzeAudience(contentIdea);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete within 30 seconds (as per requirements)
      expect(executionTime).toBeLessThan(30000);
      expect(themeResult).toBeDefined();
      expect(audienceResult).toBeDefined();
    });

    it('should handle concurrent requests', async () => {
      const contentIdeas = [
        'Business strategy content',
        'Marketing tips content',
        'Productivity advice content',
      ];

      // Process multiple content ideas concurrently
      const promises = contentIdeas.map(idea =>
        themeExtractionService.extractThemesAndTopics(idea)
      );

      const results = await Promise.all(promises);
      
      expect(results.length).toBe(3);
      results.forEach((result: any) => {
        expect(result).toBeDefined();
        expect(result.themes).toBeDefined();
        expect(result.topics).toBeDefined();
      });
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data consistency throughout workflow', async () => {
      const contentIdea = 'Data consistency test content';
      
      // Extract themes
      const themeResult = await themeExtractionService.extractThemesAndTopics(contentIdea);

      // Verify data structure integrity
      expect(themeResult.themes).toBeInstanceOf(Array);
      expect(themeResult.topics).toBeInstanceOf(Array);
      
      // Analyze audience
      const audienceResult = await audienceAnalysisService.analyzeAudience(contentIdea);

      // Verify audience analysis maintains data integrity
      expect(audienceResult.demographics).toBeDefined();
      expect(audienceResult.behaviorPatterns).toBeDefined();
    });

    it('should validate service integration', async () => {
      const contentIdea = 'Service integration test';

      // Test that all services can be called without errors
      const themeResult = await themeExtractionService.extractThemesAndTopics(contentIdea);
      const audienceResult = await audienceAnalysisService.analyzeAudience(contentIdea);
      const qualityResult = await contentQualityService.validateContent({
        contentId: 'content-123',
        ideaId: 'idea-123',
        userId: 'user-123',
        platform: 'blog',
        contentType: 'blog-post',
        generatedText: 'Test content',
        metadata: {
          wordCount: 10,
          hashtags: [],
          seoKeywords: [],
          readingTime: 1,
        },
        version: 1,
        status: 'generated',
        createdAt: new Date().toISOString(),
      });

      expect(themeResult).toBeDefined();
      expect(audienceResult).toBeDefined();
      expect(qualityResult).toBeDefined();
    });
  });
});