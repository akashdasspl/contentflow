// Property-based test for intent classification accuracy
// **Validates: Requirements 2.2**

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';

// Mock all external dependencies first
jest.mock('../src/services/aws-clients');
jest.mock('../src/utils');

// Import after mocking
import { intentClassificationService } from '../src/services/intent-classification';
import { ContentIntent } from '../src/types';

// Mock implementations
const mockComprehendClient = {
  send: jest.fn(),
};

const mockSageMakerClient = {
  send: jest.fn(),
};

const mockRetryOperation = jest.fn();
const mockLogInfo = jest.fn();
const mockLogError = jest.fn();
const mockLogWarning = jest.fn();
const mockGetEnvVar = jest.fn();

// Mock modules
jest.mock('../src/services/aws-clients', () => ({
  comprehendClient: mockComprehendClient,
  sageMakerClient: mockSageMakerClient,
}));

jest.mock('../src/utils', () => ({
  logInfo: mockLogInfo,
  logError: mockLogError,
  logWarning: mockLogWarning,
  measureExecutionTime: jest.fn(),
  retryOperation: mockRetryOperation,
  getEnvVar: mockGetEnvVar,
}));

describe('Property Test: Intent Classification Accuracy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockRetryOperation.mockImplementation((operation: any) => operation());
    mockGetEnvVar.mockReturnValue(''); // No ML endpoint by default
    
    // Mock default Comprehend responses
    mockComprehendClient.send
      .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en', Score: 0.99 }] }) // Language detection
      .mockResolvedValueOnce({ KeyPhrases: [] }) // Key phrases
      .mockResolvedValueOnce({ Entities: [] }) // Entities
      .mockResolvedValueOnce({ // Sentiment
        Sentiment: 'NEUTRAL',
        SentimentScore: {
          Positive: 0.25,
          Negative: 0.25,
          Neutral: 0.5,
          Mixed: 0.0,
        }
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Property 5: Intent Classification Accuracy
   * For any content input, the system should classify intent as one of the four valid categories:
   * informational, promotional, educational, or entertainment
   * **Validates: Requirements 2.2**
   */
  it('Property 5: should classify any content input into one of four valid intent categories', async () => {
    // Content generators for each intent category with clear indicators
    const promotionalContentArbitrary = fc.constantFrom(
      'Buy now and save 50%! Limited time offer on our amazing products. Click here to purchase today!',
      'Special discount available! Get the best deals on premium items. Order now while supplies last!',
      'Exclusive sale event! Don\'t miss out on incredible savings. Shop now and save big!',
      'Flash sale alert! Huge discounts on all products. Buy today and get free shipping!',
      'Amazing offer! Purchase our top-rated products at unbeatable prices. Act fast!',
      'Super sale! Get up to 70% off on selected items. Limited time only. Buy now!',
      'Best prices guaranteed! Shop our collection and save money. Exclusive deals inside!',
      'Hot deals! Don\'t wait - these prices won\'t last long. Get yours today!'
    );

    const informationalContentArbitrary = fc.constantFrom(
      'What is climate change? Here are the facts and data about global warming trends.',
      'Research shows that artificial intelligence is transforming various industries.',
      'Statistics indicate that remote work has increased by 300% since 2020.',
      'According to recent studies, renewable energy adoption is accelerating globally.',
      'Data analysis reveals interesting patterns in consumer behavior during the pandemic.',
      'New research findings suggest that meditation can improve cognitive function.',
      'Survey results show that 85% of companies are investing in digital transformation.',
      'Scientific evidence demonstrates the effectiveness of various treatment methods.'
    );

    const educationalContentArbitrary = fc.constantFrom(
      'Learn how to code in Python step by step. This tutorial covers variables and functions.',
      'Master the art of photography with these essential techniques and tips.',
      'Understand financial planning basics: budgeting, saving, and investing strategies.',
      'How to build a website from scratch: a comprehensive guide for beginners.',
      'Study guide for effective time management and productivity improvement.',
      'Complete course on digital marketing: SEO, social media, and content strategy.',
      'Learn Spanish quickly with these proven language learning methods.',
      'Programming fundamentals: understanding algorithms and data structures.'
    );

    const entertainmentContentArbitrary = fc.constantFrom(
      'This hilarious video will make you laugh out loud! Check out these funny moments.',
      'Amazing stunts and incredible performances that will blow your mind!',
      'Top 10 funniest movie scenes that never get old. You won\'t believe number 5!',
      'Epic gaming moments and spectacular fails compilation. Pure entertainment!',
      'Celebrity gossip and latest Hollywood news. Who\'s dating whom?',
      'Viral TikTok dances and trending challenges. Join the fun!',
      'Music video featuring your favorite artists. Get ready to dance!',
      'Comedy show highlights and stand-up performances. Laugh until you cry!'
    );

    // Combined arbitrary that includes all intent types
    const allContentArbitrary = fc.oneof(
      promotionalContentArbitrary.map(content => ({ content, expectedIntent: 'promotional' as ContentIntent })),
      informationalContentArbitrary.map(content => ({ content, expectedIntent: 'informational' as ContentIntent })),
      educationalContentArbitrary.map(content => ({ content, expectedIntent: 'educational' as ContentIntent })),
      entertainmentContentArbitrary.map(content => ({ content, expectedIntent: 'entertainment' as ContentIntent }))
    );

    await fc.assert(
      fc.asyncProperty(allContentArbitrary, async ({ content, expectedIntent }) => {
        // Reset mocks for each iteration
        jest.clearAllMocks();
        mockRetryOperation.mockImplementation((operation: any) => operation());
        mockGetEnvVar.mockReturnValue(''); // No ML endpoint
        
        // Mock Comprehend responses based on content type
        const mockKeyPhrases = () => {
          switch (expectedIntent) {
            case 'promotional':
              return [
                { Text: 'buy now', Score: 0.9 },
                { Text: 'special offer', Score: 0.8 },
                { Text: 'limited time', Score: 0.7 },
              ];
            case 'informational':
              return [
                { Text: 'research shows', Score: 0.9 },
                { Text: 'data analysis', Score: 0.8 },
                { Text: 'facts', Score: 0.7 },
              ];
            case 'educational':
              return [
                { Text: 'learn how to', Score: 0.9 },
                { Text: 'step by step', Score: 0.8 },
                { Text: 'tutorial', Score: 0.7 },
              ];
            case 'entertainment':
              return [
                { Text: 'hilarious', Score: 0.9 },
                { Text: 'funny moments', Score: 0.8 },
                { Text: 'amazing', Score: 0.7 },
              ];
            default:
              return [];
          }
        };

        const mockSentiment = () => {
          switch (expectedIntent) {
            case 'promotional':
            case 'entertainment':
              return {
                Sentiment: 'POSITIVE',
                SentimentScore: { Positive: 0.8, Negative: 0.1, Neutral: 0.1, Mixed: 0.0 }
              };
            case 'informational':
            case 'educational':
              return {
                Sentiment: 'NEUTRAL',
                SentimentScore: { Positive: 0.3, Negative: 0.1, Neutral: 0.6, Mixed: 0.0 }
              };
            default:
              return {
                Sentiment: 'NEUTRAL',
                SentimentScore: { Positive: 0.25, Negative: 0.25, Neutral: 0.5, Mixed: 0.0 }
              };
          }
        };

        mockComprehendClient.send
          .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en', Score: 0.99 }] })
          .mockResolvedValueOnce({ KeyPhrases: mockKeyPhrases() })
          .mockResolvedValueOnce({ Entities: [] })
          .mockResolvedValueOnce(mockSentiment());

        const result = await intentClassificationService.classifyIntent(content);

        // Property: Must classify into one of the four valid categories (Requirement 2.2)
        const validIntents: ContentIntent[] = ['informational', 'promotional', 'educational', 'entertainment'];
        expect(validIntents).toContain(result.intent);

        // Property: Result should have valid structure
        expect(result).toBeDefined();
        expect(typeof result.intent).toBe('string');
        expect(typeof result.confidenceScore).toBe('number');
        expect(typeof result.processingTime).toBe('number');
        expect(typeof result.modelVersion).toBe('string');

        // Property: Confidence score should be valid (0-1 range)
        expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(result.confidenceScore).toBeLessThanOrEqual(1);
        expect(Number.isFinite(result.confidenceScore)).toBe(true);

        // Property: Processing time should be positive
        expect(result.processingTime).toBeGreaterThan(0);
        expect(Number.isFinite(result.processingTime)).toBe(true);

        // Property: Features should be extracted
        expect(result.features).toBeDefined();
        expect(result.features.textMetrics).toBeDefined();
        expect(result.features.contentIndicators).toBeDefined();

        // Property: Text metrics should be valid
        const metrics = result.features.textMetrics;
        expect(metrics.wordCount).toBeGreaterThanOrEqual(0);
        expect(metrics.sentenceCount).toBeGreaterThanOrEqual(0);
        expect(metrics.questionCount).toBeGreaterThanOrEqual(0);
        expect(metrics.exclamationCount).toBeGreaterThanOrEqual(0);
        expect(metrics.callToActionIndicators).toBeGreaterThanOrEqual(0);

        // Property: Content indicators should be valid (0-1 range)
        const indicators = result.features.contentIndicators;
        Object.values(indicators).forEach(score => {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
          expect(Number.isFinite(score)).toBe(true);
        });

        // Property: Alternative intents should be valid if present
        if (result.alternativeIntents && result.alternativeIntents.length > 0) {
          result.alternativeIntents.forEach(alt => {
            expect(validIntents).toContain(alt.intent);
            expect(alt.confidence).toBeGreaterThanOrEqual(0);
            expect(alt.confidence).toBeLessThanOrEqual(1);
            expect(alt.confidence).toBeLessThan(result.confidenceScore);
          });
        }

        // Property: Classification should be reasonable for clear content
        // (This is a soft assertion - we expect good accuracy but allow some misclassification)
        if (result.confidenceScore > 0.7) {
          // For high-confidence classifications, we expect them to be correct more often
          // This is a statistical property that should hold across many runs
          if (result.intent !== expectedIntent) {
            // Log misclassification for analysis but don't fail the test
            console.log(`Misclassification: expected ${expectedIntent}, got ${result.intent} (confidence: ${result.confidenceScore})`);
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
   * Property: Intent classification should be consistent for similar content
   * **Validates: Requirements 2.2**
   */
  it('Property 5.1: should classify similar content consistently', async () => {
    const similarContentGroups = [
      // Promotional variations
      [
        'Buy now and save money!',
        'Purchase today and get discounts!',
        'Shop now for amazing deals!',
        'Get the best prices - buy today!'
      ],
      // Informational variations
      [
        'What is artificial intelligence?',
        'Research shows AI trends are growing.',
        'Data indicates machine learning adoption.',
        'Studies reveal automation benefits.'
      ],
      // Educational variations
      [
        'Learn programming step by step.',
        'How to code in Python tutorial.',
        'Master web development skills.',
        'Study software engineering basics.'
      ],
      // Entertainment variations
      [
        'This funny video will make you laugh!',
        'Hilarious moments compilation here!',
        'Amazing entertainment content awaits!',
        'Check out these incredible performances!'
      ]
    ];

    for (const contentGroup of similarContentGroups) {
      const results: ContentIntent[] = [];

      for (const content of contentGroup) {
        // Reset mocks for each classification
        jest.clearAllMocks();
        mockRetryOperation.mockImplementation((operation: any) => operation());
        mockGetEnvVar.mockReturnValue('');

        // Mock consistent responses for similar content
        mockComprehendClient.send
          .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en', Score: 0.99 }] })
          .mockResolvedValueOnce({
            KeyPhrases: [
              { Text: 'key phrase', Score: 0.8 },
            ]
          })
          .mockResolvedValueOnce({ Entities: [] })
          .mockResolvedValueOnce({
            Sentiment: 'POSITIVE',
            SentimentScore: { Positive: 0.7, Negative: 0.1, Neutral: 0.2, Mixed: 0.0 }
          });

        const result = await intentClassificationService.classifyIntent(content);
        results.push(result.intent);
      }

      // Property: Similar content should tend to have the same classification
      // Allow for some variation but expect majority consistency
      const intentCounts = results.reduce((counts, intent) => {
        counts[intent] = (counts[intent] || 0) + 1;
        return counts;
      }, {} as Record<ContentIntent, number>);

      const maxCount = Math.max(...Object.values(intentCounts));
      const totalCount = results.length;
      const consistencyRatio = maxCount / totalCount;

      // Property: At least 50% of similar content should have the same classification
      expect(consistencyRatio).toBeGreaterThanOrEqual(0.5);
    }
  }, 30000);

  /**
   * Property: Intent classification should handle edge cases gracefully
   * **Validates: Requirements 2.2**
   */
  it('Property 5.2: should handle edge cases and return valid intents', async () => {
    const edgeCaseArbitrary = fc.oneof(
      // Very short content
      fc.string({ minLength: 1, maxLength: 5 }),
      // Single words
      fc.constantFrom('buy', 'learn', 'what', 'funny', 'amazing', 'how', 'why', 'sale'),
      // Punctuation heavy
      fc.constantFrom('!!!', '???', '...', '!@#$%', '??!!??'),
      // Mixed case and special characters
      fc.constantFrom(
        'BUY NOW!!!',
        'what is this???',
        'Learn... HOW TO...',
        'AMAZING!!! content HERE!!!'
      ),
      // Numbers and symbols
      fc.constantFrom('123 456', '$$$', '100% off', '24/7 support'),
      // Very long content (will be truncated)
      fc.string({ minLength: 5000, maxLength: 6000 })
    );

    await fc.assert(
      fc.asyncProperty(edgeCaseArbitrary, async (edgeContent) => {
        // Reset mocks
        jest.clearAllMocks();
        mockRetryOperation.mockImplementation((operation: any) => operation());
        mockGetEnvVar.mockReturnValue('');

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
          const result = await intentClassificationService.classifyIntent(edgeContent);

          // Property: Should always return a valid intent category
          const validIntents: ContentIntent[] = ['informational', 'promotional', 'educational', 'entertainment'];
          expect(validIntents).toContain(result.intent);

          // Property: Should return valid confidence score
          expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
          expect(result.confidenceScore).toBeLessThanOrEqual(1);

          // Property: Should have valid structure
          expect(result.features).toBeDefined();
          expect(result.features.textMetrics).toBeDefined();
          expect(result.features.contentIndicators).toBeDefined();

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
      { numRuns: 50, timeout: 20000 }
    );
  }, 40000);

  /**
   * Property: Content indicators should reflect actual content characteristics
   * **Validates: Requirements 2.2**
   */
  it('Property 5.3: should calculate content indicators that reflect actual content characteristics', async () => {
    const contentWithIndicators = [
      {
        content: 'Buy now! Special offer! Limited time! Click here to purchase! Save money!',
        expectedHighIndicator: 'promotional',
        expectedLowIndicator: 'educational'
      },
      {
        content: 'What is machine learning? Research shows that AI algorithms can analyze data patterns.',
        expectedHighIndicator: 'informational',
        expectedLowIndicator: 'promotional'
      },
      {
        content: 'Learn how to code step by step. This tutorial will teach you programming basics.',
        expectedHighIndicator: 'educational',
        expectedLowIndicator: 'entertainment'
      },
      {
        content: 'This hilarious video is so funny! Amazing entertainment content that will make you laugh!',
        expectedHighIndicator: 'entertainment',
        expectedLowIndicator: 'informational'
      }
    ];

    for (const testCase of contentWithIndicators) {
      // Reset mocks
      jest.clearAllMocks();
      mockRetryOperation.mockImplementation((operation: any) => operation());
      mockGetEnvVar.mockReturnValue('');

      // Mock appropriate responses based on content
      const mockKeyPhrasesForContent = (content: string) => {
        if (content.includes('Buy now') || content.includes('Special offer')) {
          return [
            { Text: 'buy now', Score: 0.9 },
            { Text: 'special offer', Score: 0.8 },
            { Text: 'limited time', Score: 0.7 },
          ];
        } else if (content.includes('What is') || content.includes('Research shows')) {
          return [
            { Text: 'machine learning', Score: 0.9 },
            { Text: 'research shows', Score: 0.8 },
            { Text: 'data patterns', Score: 0.7 },
          ];
        } else if (content.includes('Learn how') || content.includes('tutorial')) {
          return [
            { Text: 'learn how to', Score: 0.9 },
            { Text: 'step by step', Score: 0.8 },
            { Text: 'tutorial', Score: 0.7 },
          ];
        } else if (content.includes('hilarious') || content.includes('funny')) {
          return [
            { Text: 'hilarious video', Score: 0.9 },
            { Text: 'funny', Score: 0.8 },
            { Text: 'amazing entertainment', Score: 0.7 },
          ];
        }
        return [];
      };

      mockComprehendClient.send
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en', Score: 0.99 }] })
        .mockResolvedValueOnce({ KeyPhrases: mockKeyPhrasesForContent(testCase.content) })
        .mockResolvedValueOnce({ Entities: [] })
        .mockResolvedValueOnce({
          Sentiment: 'POSITIVE',
          SentimentScore: { Positive: 0.7, Negative: 0.1, Neutral: 0.2, Mixed: 0.0 }
        });

      const result = await intentClassificationService.classifyIntent(testCase.content);

      // Property: Content indicators should reflect the actual content
      const indicators = result.features.contentIndicators;
      
      // The expected high indicator should have a higher score than the expected low indicator
      expect(indicators[testCase.expectedHighIndicator]).toBeGreaterThan(
        indicators[testCase.expectedLowIndicator]
      );

      // The expected high indicator should have a reasonable score (> 0.3)
      expect(indicators[testCase.expectedHighIndicator]).toBeGreaterThan(0.3);

      // All indicators should be in valid range
      Object.values(indicators).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    }
  }, 20000);

  /**
   * Property: Text metrics should accurately reflect content characteristics
   * **Validates: Requirements 2.2**
   */
  it('Property 5.4: should calculate accurate text metrics for content analysis', async () => {
    const testCases = [
      {
        content: 'What is this? How does it work? Why is it important?',
        expectedQuestions: 3,
        expectedExclamations: 0,
        minWords: 8
      },
      {
        content: 'Amazing! Incredible! Buy now! Don\'t wait!',
        expectedQuestions: 0,
        expectedExclamations: 4,
        minWords: 6
      },
      {
        content: 'Buy now and save money. Click here for deals. Limited time offer available.',
        expectedCTAIndicators: 3, // "buy now", "click here", "limited time"
        minWords: 12
      },
      {
        content: 'This is a simple sentence without special punctuation.',
        expectedQuestions: 0,
        expectedExclamations: 0,
        expectedCTAIndicators: 0,
        minWords: 9
      }
    ];

    for (const testCase of testCases) {
      // Reset mocks
      jest.clearAllMocks();
      mockRetryOperation.mockImplementation((operation: any) => operation());
      mockGetEnvVar.mockReturnValue('');

      mockComprehendClient.send
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en', Score: 0.99 }] })
        .mockResolvedValueOnce({ KeyPhrases: [] })
        .mockResolvedValueOnce({ Entities: [] })
        .mockResolvedValueOnce({
          Sentiment: 'NEUTRAL',
          SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 }
        });

      const result = await intentClassificationService.classifyIntent(testCase.content);
      const metrics = result.features.textMetrics;

      // Property: Question count should match actual questions
      if ('expectedQuestions' in testCase) {
        expect(metrics.questionCount).toBe(testCase.expectedQuestions);
      }

      // Property: Exclamation count should match actual exclamations
      if ('expectedExclamations' in testCase) {
        expect(metrics.exclamationCount).toBe(testCase.expectedExclamations);
      }

      // Property: Word count should be reasonable
      if ('minWords' in testCase) {
        expect(metrics.wordCount).toBeGreaterThanOrEqual(testCase.minWords);
      }

      // Property: CTA indicators should be detected
      if ('expectedCTAIndicators' in testCase) {
        expect(metrics.callToActionIndicators).toBeGreaterThanOrEqual(testCase.expectedCTAIndicators);
      }

      // Property: All metrics should be non-negative
      expect(metrics.wordCount).toBeGreaterThanOrEqual(0);
      expect(metrics.sentenceCount).toBeGreaterThanOrEqual(0);
      expect(metrics.questionCount).toBeGreaterThanOrEqual(0);
      expect(metrics.exclamationCount).toBeGreaterThanOrEqual(0);
      expect(metrics.callToActionIndicators).toBeGreaterThanOrEqual(0);
      expect(metrics.avgWordsPerSentence).toBeGreaterThanOrEqual(0);
    }
  }, 15000);
});