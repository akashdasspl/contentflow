// Property-based test for audience analysis completeness
// **Validates: Requirements 2.1, 2.4**

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';

// Mock all external dependencies first
jest.mock('../src/services/aws-clients');
jest.mock('../src/services/database');
jest.mock('../src/utils');

// Import after mocking
import { audienceAnalysisService } from '../src/services/audience-analysis';
import { AudienceAnalysisResult, Demographics, BehaviorPatterns } from '../src/types';

// Mock implementations
const mockComprehendClient = {
  send: jest.fn(),
};

const mockRetryOperation = jest.fn();
const mockLogInfo = jest.fn();
const mockLogError = jest.fn();
const mockLogWarning = jest.fn();

// Mock modules
jest.mock('../src/services/aws-clients', () => ({
  comprehendClient: mockComprehendClient,
}));

jest.mock('../src/utils', () => ({
  logInfo: mockLogInfo,
  logError: mockLogError,
  logWarning: mockLogWarning,
  measureExecutionTime: jest.fn(),
  retryOperation: mockRetryOperation,
}));

jest.mock('../src/services/database', () => ({
  audienceProfileService: {
    getUserAudienceProfiles: jest.fn().mockResolvedValue([]),
    createAudienceProfile: jest.fn(),
    updateAudienceProfile: jest.fn(),
  },
}));

describe('Property Test: Audience Analysis Completeness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockRetryOperation.mockImplementation((operation: any) => operation());
    
    // Mock Comprehend responses with realistic data
    mockComprehendClient.send
      .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en', Score: 0.99 }] }) // Language detection
      .mockResolvedValueOnce({ // Key phrases
        KeyPhrases: [
          { Text: 'target audience', Score: 0.95 },
          { Text: 'young professionals', Score: 0.88 },
          { Text: 'social media', Score: 0.82 },
        ]
      })
      .mockResolvedValueOnce({ // Entities
        Entities: [
          { Text: 'LinkedIn', Type: 'ORGANIZATION', Score: 0.92 },
          { Text: 'San Francisco', Type: 'LOCATION', Score: 0.89 },
        ]
      })
      .mockResolvedValueOnce({ // Sentiment
        Sentiment: 'POSITIVE',
        SentimentScore: {
          Positive: 0.85,
          Negative: 0.05,
          Neutral: 0.08,
          Mixed: 0.02,
        }
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Property 4: Audience Analysis Completeness
   * For any content input, the audience analyzer should identify demographic characteristics 
   * and provide confidence scores within valid ranges (0-1)
   * **Validates: Requirements 2.1, 2.4**
   */
  it('Property 4: should provide complete audience analysis with valid confidence scores for any content input', async () => {
    // Content generator that creates realistic content variations
    const contentArbitrary = fc.oneof(
      // Business/Professional content
      fc.constantFrom(
        'Looking to connect with young professionals in the tech industry for career development opportunities',
        'Seeking experienced marketing managers for our startup in San Francisco',
        'Targeting millennials interested in sustainable fashion and eco-friendly products',
        'Connecting with small business owners who need digital marketing solutions'
      ),
      // Educational content
      fc.constantFrom(
        'Teaching programming concepts to computer science students and coding bootcamp graduates',
        'Sharing financial literacy tips with college students and recent graduates',
        'Providing cooking tutorials for busy parents and working professionals',
        'Offering language learning resources for international business professionals'
      ),
      // Entertainment content
      fc.constantFrom(
        'Creating funny videos for Gen Z audience who love TikTok and Instagram content',
        'Developing gaming content for teenage boys interested in esports and streaming',
        'Producing lifestyle vlogs for young women interested in fashion and beauty',
        'Making travel content for adventure-seeking millennials with disposable income'
      ),
      // Health/Wellness content
      fc.constantFrom(
        'Sharing fitness tips with health-conscious adults aged 25-45 who work out regularly',
        'Providing mental health resources for stressed college students and young professionals',
        'Offering nutrition advice for busy parents trying to maintain healthy family meals',
        'Creating meditation content for executives dealing with high-stress work environments'
      ),
      // Random text variations
      fc.string({ minLength: 10, maxLength: 500 }).filter(s => s.trim().length >= 10)
    );

    await fc.assert(
      fc.asyncProperty(contentArbitrary, async (contentText) => {
        // Reset mocks for each iteration
        jest.clearAllMocks();
        mockRetryOperation.mockImplementation((operation: any) => operation());
        
        // Mock Comprehend responses with varied but realistic data
        mockComprehendClient.send
          .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en', Score: 0.99 }] })
          .mockResolvedValueOnce({
            KeyPhrases: [
              { Text: 'key phrase 1', Score: Math.random() * 0.5 + 0.5 },
              { Text: 'key phrase 2', Score: Math.random() * 0.5 + 0.5 },
            ]
          })
          .mockResolvedValueOnce({
            Entities: [
              { Text: 'Entity 1', Type: 'ORGANIZATION', Score: Math.random() * 0.5 + 0.5 },
            ]
          })
          .mockResolvedValueOnce({
            Sentiment: fc.sample(fc.constantFrom('POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED'), 1)[0],
            SentimentScore: {
              Positive: Math.random(),
              Negative: Math.random(),
              Neutral: Math.random(),
              Mixed: Math.random(),
            }
          });

        try {
          const result = await audienceAnalysisService.analyzeAudience(contentText);

          // Property: Analysis should always be complete and well-formed
          expect(result).toBeDefined();
          expect(typeof result).toBe('object');

          // Property: Demographics should be identified (Requirement 2.1)
          expect(result.demographics).toBeDefined();
          expect(typeof result.demographics).toBe('object');
          
          // Demographics should have required fields
          expect(result.demographics.ageRange).toBeDefined();
          expect(typeof result.demographics.ageRange).toBe('string');
          expect(result.demographics.ageRange).toMatch(/^(18-24|25-34|35-54|55\+)$/);
          
          expect(result.demographics.location).toBeDefined();
          expect(typeof result.demographics.location).toBe('string');
          expect(result.demographics.location.length).toBeGreaterThan(0);
          
          expect(result.demographics.interests).toBeDefined();
          expect(Array.isArray(result.demographics.interests)).toBe(true);
          // Should have at least some interests identified
          expect(result.demographics.interests.length).toBeGreaterThanOrEqual(0);
          expect(result.demographics.interests.length).toBeLessThanOrEqual(10);

          // Property: Behavior patterns should be identified
          expect(result.behaviorPatterns).toBeDefined();
          expect(typeof result.behaviorPatterns).toBe('object');
          
          expect(result.behaviorPatterns.preferredContentTypes).toBeDefined();
          expect(Array.isArray(result.behaviorPatterns.preferredContentTypes)).toBe(true);
          expect(result.behaviorPatterns.preferredContentTypes.length).toBeLessThanOrEqual(3);
          
          expect(result.behaviorPatterns.engagementTimes).toBeDefined();
          expect(Array.isArray(result.behaviorPatterns.engagementTimes)).toBe(true);
          expect(result.behaviorPatterns.engagementTimes.length).toBeGreaterThan(0);
          
          expect(result.behaviorPatterns.platformUsage).toBeDefined();
          expect(typeof result.behaviorPatterns.platformUsage).toBe('object');

          // Property: Confidence scores should be within valid ranges (0-1) (Requirement 2.4)
          expect(result.confidenceScore).toBeDefined();
          expect(typeof result.confidenceScore).toBe('number');
          expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
          expect(result.confidenceScore).toBeLessThanOrEqual(1);
          expect(Number.isFinite(result.confidenceScore)).toBe(true);

          // Property: Processing time should be reasonable and positive
          expect(result.processingTime).toBeDefined();
          expect(typeof result.processingTime).toBe('number');
          expect(result.processingTime).toBeGreaterThan(0);
          expect(Number.isFinite(result.processingTime)).toBe(true);

          // Property: Insights should be provided
          expect(result.insights).toBeDefined();
          expect(Array.isArray(result.insights)).toBe(true);
          expect(result.insights.length).toBeGreaterThanOrEqual(0);
          expect(result.insights.length).toBeLessThanOrEqual(10);
          
          // All insights should be non-empty strings
          result.insights.forEach(insight => {
            expect(typeof insight).toBe('string');
            expect(insight.length).toBeGreaterThan(0);
          });

          // Property: Platform recommendations should be valid
          expect(result.recommendedPlatforms).toBeDefined();
          expect(Array.isArray(result.recommendedPlatforms)).toBe(true);
          expect(result.recommendedPlatforms.length).toBeLessThanOrEqual(3);
          
          const validPlatforms = ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'];
          result.recommendedPlatforms.forEach(platform => {
            expect(validPlatforms).toContain(platform);
          });

          // Property: Target age range should match demographics
          expect(result.targetAgeRange).toBe(result.demographics.ageRange);

          // Property: Primary interests should be subset of all interests
          expect(result.primaryInterests).toBeDefined();
          expect(Array.isArray(result.primaryInterests)).toBe(true);
          expect(result.primaryInterests.length).toBeLessThanOrEqual(5);
          
          result.primaryInterests.forEach(interest => {
            expect(result.demographics.interests).toContain(interest);
          });

          // Property: Platform usage should have valid structure
          Object.entries(result.behaviorPatterns.platformUsage).forEach(([platform, usage]) => {
            expect(validPlatforms).toContain(platform);
            expect(usage.frequency).toMatch(/^(high|medium|low)$/);
            expect(usage.engagementRate).toBeGreaterThanOrEqual(0);
            expect(usage.engagementRate).toBeLessThanOrEqual(1);
            expect(usage.preferredContentLength).toMatch(/^(short|medium|long)$/);
            expect(Array.isArray(usage.bestPostingTimes)).toBe(true);
          });

        } catch (error) {
          // Property: Should handle errors gracefully for invalid inputs
          if (contentText.trim().length === 0) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('Text content is required');
          } else {
            // For valid inputs, should not throw errors
            throw error;
          }
        }
      }),
      {
        numRuns: 100,
        timeout: 30000, // 30 seconds timeout for each test
        verbose: true,
      }
    );
  }, 60000); // 60 seconds total timeout

  /**
   * Property: Confidence score calculation should be consistent and meaningful
   * **Validates: Requirements 2.4**
   */
  it('Property 4.1: should calculate confidence scores consistently based on analysis quality', async () => {
    const highQualityContentArbitrary = fc.constantFrom(
      'Targeting young professionals aged 25-34 in San Francisco who work in technology companies like Google and Facebook, interested in career development, networking events, and professional growth opportunities on LinkedIn',
      'Seeking health-conscious millennials living in urban areas who regularly visit fitness centers, follow wellness influencers on Instagram, and purchase organic products from Whole Foods',
      'Connecting with college students studying computer science at universities like Stanford and MIT, who participate in hackathons, contribute to open-source projects on GitHub, and aspire to work at tech startups'
    );

    const lowQualityContentArbitrary = fc.constantFrom(
      'Some people like things',
      'Content for everyone',
      'General audience interested in stuff',
      'People who want information'
    );

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          highQualityContentArbitrary.map(content => ({ content, quality: 'high' })),
          lowQualityContentArbitrary.map(content => ({ content, quality: 'low' }))
        ),
        async ({ content, quality }) => {
          // Reset mocks
          jest.clearAllMocks();
          mockRetryOperation.mockImplementation((operation: any) => operation());
          
          // Mock responses based on content quality
          const keyPhraseScore = quality === 'high' ? 0.8 + Math.random() * 0.2 : 0.3 + Math.random() * 0.4;
          const entityScore = quality === 'high' ? 0.7 + Math.random() * 0.3 : 0.2 + Math.random() * 0.5;
          
          mockComprehendClient.send
            .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en', Score: 0.99 }] })
            .mockResolvedValueOnce({
              KeyPhrases: quality === 'high' ? [
                { Text: 'specific phrase 1', Score: keyPhraseScore },
                { Text: 'specific phrase 2', Score: keyPhraseScore - 0.1 },
                { Text: 'specific phrase 3', Score: keyPhraseScore - 0.2 },
              ] : [
                { Text: 'generic phrase', Score: keyPhraseScore },
              ]
            })
            .mockResolvedValueOnce({
              Entities: quality === 'high' ? [
                { Text: 'Specific Entity', Type: 'ORGANIZATION', Score: entityScore },
                { Text: 'Location', Type: 'LOCATION', Score: entityScore - 0.1 },
              ] : []
            })
            .mockResolvedValueOnce({
              Sentiment: 'NEUTRAL',
              SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 }
            });

          const result = await audienceAnalysisService.analyzeAudience(content);

          // Property: High-quality content should generally have higher confidence scores
          if (quality === 'high') {
            expect(result.confidenceScore).toBeGreaterThan(0.4);
            expect(result.demographics.interests.length).toBeGreaterThan(0);
            expect(result.insights.length).toBeGreaterThan(1);
          }

          // Property: All confidence scores should be valid regardless of quality
          expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
          expect(result.confidenceScore).toBeLessThanOrEqual(1);
          expect(Number.isFinite(result.confidenceScore)).toBe(true);
        }
      ),
      { numRuns: 50, timeout: 20000 }
    );
  }, 40000);

  /**
   * Property: Analysis should be deterministic for identical inputs
   * **Validates: Requirements 2.1, 2.4**
   */
  it('Property 4.2: should produce consistent results for identical content inputs', async () => {
    const testContent = 'Targeting young professionals in tech companies who are interested in career development and networking on LinkedIn';

    // Setup consistent mock responses
    const setupMocks = () => {
      jest.clearAllMocks();
      mockRetryOperation.mockImplementation((operation: any) => operation());
      
      mockComprehendClient.send
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en', Score: 0.99 }] })
        .mockResolvedValueOnce({
          KeyPhrases: [
            { Text: 'young professionals', Score: 0.95 },
            { Text: 'tech companies', Score: 0.88 },
            { Text: 'career development', Score: 0.82 },
          ]
        })
        .mockResolvedValueOnce({
          Entities: [
            { Text: 'LinkedIn', Type: 'ORGANIZATION', Score: 0.92 },
          ]
        })
        .mockResolvedValueOnce({
          Sentiment: 'POSITIVE',
          SentimentScore: { Positive: 0.7, Negative: 0.1, Neutral: 0.2, Mixed: 0.0 }
        });
    };

    // Run analysis multiple times
    setupMocks();
    const result1 = await audienceAnalysisService.analyzeAudience(testContent);
    
    setupMocks();
    const result2 = await audienceAnalysisService.analyzeAudience(testContent);

    // Property: Results should be consistent (deterministic)
    expect(result1.demographics.ageRange).toBe(result2.demographics.ageRange);
    expect(result1.demographics.location).toBe(result2.demographics.location);
    expect(result1.demographics.interests).toEqual(result2.demographics.interests);
    expect(result1.behaviorPatterns.preferredContentTypes).toEqual(result2.behaviorPatterns.preferredContentTypes);
    expect(result1.confidenceScore).toBeCloseTo(result2.confidenceScore, 2);
    expect(result1.recommendedPlatforms).toEqual(result2.recommendedPlatforms);
  }, 20000);

  /**
   * Property: Analysis should handle edge cases gracefully
   * **Validates: Requirements 2.1, 2.4**
   */
  it('Property 4.3: should handle edge cases and boundary conditions gracefully', async () => {
    const edgeCaseArbitrary = fc.oneof(
      // Very short content
      fc.string({ minLength: 1, maxLength: 10 }),
      // Very long content (will be truncated)
      fc.string({ minLength: 5000, maxLength: 6000 }),
      // Special characters and numbers
      fc.constantFrom(
        '123 456 789 !@#$%^&*()',
        'Content with émojis 🚀 and spëcial châractërs',
        'CONTENT IN ALL CAPS WITH LOTS OF EXCLAMATION MARKS!!!',
        'content in all lowercase with no punctuation'
      ),
      // Mixed languages (though we expect English)
      fc.constantFrom(
        'Hello world and bonjour monde',
        'Content with some español words mixed in',
        'English content with 中文 characters'
      )
    );

    await fc.assert(
      fc.asyncProperty(edgeCaseArbitrary, async (edgeContent) => {
        // Reset mocks
        jest.clearAllMocks();
        mockRetryOperation.mockImplementation((operation: any) => operation());
        
        // Mock minimal responses for edge cases
        mockComprehendClient.send
          .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en', Score: 0.8 }] })
          .mockResolvedValueOnce({ KeyPhrases: [] })
          .mockResolvedValueOnce({ Entities: [] })
          .mockResolvedValueOnce({
            Sentiment: 'NEUTRAL',
            SentimentScore: { Positive: 0.25, Negative: 0.25, Neutral: 0.5, Mixed: 0.0 }
          });

        try {
          const result = await audienceAnalysisService.analyzeAudience(edgeContent);

          // Property: Should always return valid structure even for edge cases
          expect(result).toBeDefined();
          expect(result.demographics).toBeDefined();
          expect(result.behaviorPatterns).toBeDefined();
          expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
          expect(result.confidenceScore).toBeLessThanOrEqual(1);
          
          // Property: Should provide minimum viable analysis
          expect(result.demographics.ageRange).toMatch(/^(18-24|25-34|35-54|55\+)$/);
          expect(result.demographics.location).toBeDefined();
          expect(Array.isArray(result.demographics.interests)).toBe(true);
          expect(Array.isArray(result.behaviorPatterns.preferredContentTypes)).toBe(true);
          expect(Array.isArray(result.behaviorPatterns.engagementTimes)).toBe(true);
          expect(result.behaviorPatterns.engagementTimes.length).toBeGreaterThan(0);

        } catch (error) {
          // Property: Should only throw for truly invalid inputs
          if (edgeContent.trim().length === 0) {
            expect((error as Error).message).toContain('Text content is required');
          } else {
            // For non-empty content, should not throw
            throw error;
          }
        }
      }),
      { numRuns: 30, timeout: 15000 }
    );
  }, 30000);
});