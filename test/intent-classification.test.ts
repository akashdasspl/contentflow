// Unit tests for intent classification service
// Requirements: 2.2

import { intentClassificationService } from '../src/services/intent-classification';
import { ContentIntent } from '../src/types';

// Mock AWS clients
jest.mock('../src/services/aws-clients', () => ({
  comprehendClient: {
    send: jest.fn(),
  },
  sageMakerClient: {
    send: jest.fn(),
  },
}));

// Mock utils
jest.mock('../src/utils', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
  measureExecutionTime: jest.fn(),
  retryOperation: jest.fn(),
  getEnvVar: jest.fn().mockReturnValue(''),
}));

describe('IntentClassificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyIntent', () => {
    it('should classify promotional content correctly', async () => {
      const promotionalText = 'Buy now and save 50%! Limited time offer. Get the best deals today. Click here to purchase!';
      
      // Mock Comprehend responses
      const { comprehendClient } = require('../src/services/aws-clients');
      const { retryOperation } = require('../src/utils');
      
      retryOperation.mockImplementation((operation: any) => operation());
      
      comprehendClient.send
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en' }] }) // Language detection
        .mockResolvedValueOnce({ // Key phrases
          KeyPhrases: [
            { Text: 'best deals', Score: 0.9 },
            { Text: 'limited time offer', Score: 0.8 },
            { Text: 'save 50%', Score: 0.7 },
          ]
        })
        .mockResolvedValueOnce({ // Entities
          Entities: [
            { Text: '50%', Type: 'QUANTITY', Score: 0.8 },
          ]
        })
        .mockResolvedValueOnce({ // Sentiment
          Sentiment: 'POSITIVE',
          SentimentScore: {
            Positive: 0.8,
            Negative: 0.1,
            Neutral: 0.05,
            Mixed: 0.05,
          }
        });

      const result = await intentClassificationService.classifyIntent(promotionalText);

      expect(result.intent).toBe('promotional');
      expect(result.confidenceScore).toBeGreaterThan(0.5);
      expect(result.features.contentIndicators.promotional).toBeGreaterThan(0.5);
      expect(result.features.textMetrics.callToActionIndicators).toBeGreaterThan(0);
      expect(result.modelVersion).toContain('rule-based');
    });

    it('should classify informational content correctly', async () => {
      const informationalText = 'What is climate change? Here are the facts and data about global warming. Research shows that temperatures have increased by 1.1°C since 1880.';
      
      const { comprehendClient } = require('../src/services/aws-clients');
      const { retryOperation } = require('../src/utils');
      
      retryOperation.mockImplementation((operation: any) => operation());
      
      comprehendClient.send
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en' }] })
        .mockResolvedValueOnce({
          KeyPhrases: [
            { Text: 'climate change', Score: 0.9 },
            { Text: 'global warming', Score: 0.8 },
            { Text: 'research shows', Score: 0.7 },
          ]
        })
        .mockResolvedValueOnce({
          Entities: [
            { Text: '1.1°C', Type: 'QUANTITY', Score: 0.8 },
            { Text: '1880', Type: 'DATE', Score: 0.7 },
          ]
        })
        .mockResolvedValueOnce({
          Sentiment: 'NEUTRAL',
          SentimentScore: {
            Positive: 0.2,
            Negative: 0.2,
            Neutral: 0.6,
            Mixed: 0.0,
          }
        });

      const result = await intentClassificationService.classifyIntent(informationalText);

      expect(result.intent).toBe('informational');
      expect(result.confidenceScore).toBeGreaterThan(0.3);
      expect(result.features.contentIndicators.informational).toBeGreaterThan(0.3);
      expect(result.features.textMetrics.questionCount).toBeGreaterThan(0);
    });

    it('should classify educational content correctly', async () => {
      const educationalText = 'Learn how to code in Python step by step. This tutorial will teach you the basics of programming. Follow these instructions to understand variables and functions.';
      
      const { comprehendClient } = require('../src/services/aws-clients');
      const { retryOperation } = require('../src/utils');
      
      retryOperation.mockImplementation((operation: any) => operation());
      
      comprehendClient.send
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en' }] })
        .mockResolvedValueOnce({
          KeyPhrases: [
            { Text: 'learn how to code', Score: 0.9 },
            { Text: 'step by step', Score: 0.8 },
            { Text: 'tutorial', Score: 0.7 },
          ]
        })
        .mockResolvedValueOnce({
          Entities: [
            { Text: 'Python', Type: 'OTHER', Score: 0.8 },
          ]
        })
        .mockResolvedValueOnce({
          Sentiment: 'NEUTRAL',
          SentimentScore: {
            Positive: 0.3,
            Negative: 0.1,
            Neutral: 0.6,
            Mixed: 0.0,
          }
        });

      const result = await intentClassificationService.classifyIntent(educationalText);

      expect(result.intent).toBe('educational');
      expect(result.confidenceScore).toBeGreaterThan(0.3);
      expect(result.features.contentIndicators.educational).toBeGreaterThan(0.3);
    });

    it('should classify entertainment content correctly', async () => {
      const entertainmentText = 'This hilarious video will make you laugh! Check out these funny moments and amazing stunts. You won\'t believe what happens next!';
      
      const { comprehendClient } = require('../src/services/aws-clients');
      const { retryOperation } = require('../src/utils');
      
      retryOperation.mockImplementation((operation: any) => operation());
      
      comprehendClient.send
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en' }] })
        .mockResolvedValueOnce({
          KeyPhrases: [
            { Text: 'hilarious video', Score: 0.9 },
            { Text: 'funny moments', Score: 0.8 },
            { Text: 'amazing stunts', Score: 0.7 },
          ]
        })
        .mockResolvedValueOnce({
          Entities: []
        })
        .mockResolvedValueOnce({
          Sentiment: 'POSITIVE',
          SentimentScore: {
            Positive: 0.9,
            Negative: 0.05,
            Neutral: 0.05,
            Mixed: 0.0,
          }
        });

      const result = await intentClassificationService.classifyIntent(entertainmentText);

      expect(result.intent).toBe('entertainment');
      expect(result.confidenceScore).toBeGreaterThan(0.3);
      expect(result.features.contentIndicators.entertainment).toBeGreaterThan(0.3);
      expect(result.features.textMetrics.exclamationCount).toBeGreaterThan(0);
    });

    it('should handle empty text input', async () => {
      await expect(intentClassificationService.classifyIntent('')).rejects.toThrow('Text content is required for intent classification');
    });

    it('should handle very long text by truncating', async () => {
      const longText = 'a'.repeat(6000);
      
      const { comprehendClient } = require('../src/services/aws-clients');
      const { retryOperation } = require('../src/utils');
      
      retryOperation.mockImplementation((operation: any) => operation());
      
      comprehendClient.send
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en' }] })
        .mockResolvedValueOnce({ KeyPhrases: [] })
        .mockResolvedValueOnce({ Entities: [] })
        .mockResolvedValueOnce({
          Sentiment: 'NEUTRAL',
          SentimentScore: { Positive: 0.25, Negative: 0.25, Neutral: 0.5, Mixed: 0.0 }
        });

      const result = await intentClassificationService.classifyIntent(longText);

      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it('should include alternative intents when requested', async () => {
      const mixedText = 'Learn about our amazing products! This educational guide will teach you how to use them effectively. Buy now for best results!';
      
      const { comprehendClient } = require('../src/services/aws-clients');
      const { retryOperation } = require('../src/utils');
      
      retryOperation.mockImplementation((operation: any) => operation());
      
      comprehendClient.send
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en' }] })
        .mockResolvedValueOnce({
          KeyPhrases: [
            { Text: 'amazing products', Score: 0.8 },
            { Text: 'educational guide', Score: 0.7 },
            { Text: 'buy now', Score: 0.6 },
          ]
        })
        .mockResolvedValueOnce({ Entities: [] })
        .mockResolvedValueOnce({
          Sentiment: 'POSITIVE',
          SentimentScore: { Positive: 0.7, Negative: 0.1, Neutral: 0.2, Mixed: 0.0 }
        });

      const result = await intentClassificationService.classifyIntent(mixedText, {
        includeAlternatives: true,
        maxAlternatives: 2,
      });

      expect(result.alternativeIntents).toBeDefined();
      expect(result.alternativeIntents.length).toBeGreaterThan(0);
      expect(result.alternativeIntents.length).toBeLessThanOrEqual(2);
      
      // Each alternative should have lower confidence than primary
      result.alternativeIntents.forEach(alt => {
        expect(alt.confidence).toBeLessThan(result.confidenceScore);
        expect(['informational', 'promotional', 'educational', 'entertainment']).toContain(alt.intent);
      });
    });

    it('should handle Comprehend service errors gracefully', async () => {
      const { comprehendClient } = require('../src/services/aws-clients');
      const { retryOperation } = require('../src/utils');
      
      retryOperation.mockImplementation((operation: any) => operation());
      
      comprehendClient.send
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en' }] })
        .mockRejectedValueOnce(new Error('Comprehend service error'))
        .mockResolvedValueOnce({ Entities: [] })
        .mockResolvedValueOnce({
          Sentiment: 'NEUTRAL',
          SentimentScore: { Positive: 0.25, Negative: 0.25, Neutral: 0.5, Mixed: 0.0 }
        });

      const result = await intentClassificationService.classifyIntent('Test text');

      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.features.keyPhrases).toEqual([]); // Should be empty due to error
    });

    it('should calculate text metrics correctly', async () => {
      const testText = 'What is this? This is a test! How amazing is that? Buy now! Click here!';
      
      const { comprehendClient } = require('../src/services/aws-clients');
      const { retryOperation } = require('../src/utils');
      
      retryOperation.mockImplementation((operation: any) => operation());
      
      comprehendClient.send
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en' }] })
        .mockResolvedValueOnce({ KeyPhrases: [] })
        .mockResolvedValueOnce({ Entities: [] })
        .mockResolvedValueOnce({
          Sentiment: 'POSITIVE',
          SentimentScore: { Positive: 0.6, Negative: 0.1, Neutral: 0.3, Mixed: 0.0 }
        });

      const result = await intentClassificationService.classifyIntent(testText);

      expect(result.features.textMetrics.questionCount).toBe(2);
      expect(result.features.textMetrics.exclamationCount).toBe(3);
      expect(result.features.textMetrics.callToActionIndicators).toBeGreaterThan(0);
      expect(result.features.textMetrics.wordCount).toBeGreaterThan(0);
      expect(result.features.textMetrics.sentenceCount).toBeGreaterThan(0);
    });
  });

  describe('batchClassifyIntent', () => {
    it('should classify multiple texts in batch', async () => {
      const texts = [
        'Buy our amazing product now!',
        'What is machine learning?',
        'Learn Python programming step by step',
        'This funny video will make you laugh!'
      ];

      const { comprehendClient } = require('../src/services/aws-clients');
      const { retryOperation } = require('../src/utils');
      
      retryOperation.mockImplementation((operation: any) => operation());
      
      // Mock responses for each text (4 texts × 4 calls each = 16 total calls)
      const mockResponses = [
        // Text 1 responses
        { Languages: [{ LanguageCode: 'en' }] },
        { KeyPhrases: [{ Text: 'amazing product', Score: 0.8 }] },
        { Entities: [] },
        { Sentiment: 'POSITIVE', SentimentScore: { Positive: 0.8, Negative: 0.1, Neutral: 0.1, Mixed: 0.0 } },
        
        // Text 2 responses
        { Languages: [{ LanguageCode: 'en' }] },
        { KeyPhrases: [{ Text: 'machine learning', Score: 0.9 }] },
        { Entities: [] },
        { Sentiment: 'NEUTRAL', SentimentScore: { Positive: 0.2, Negative: 0.1, Neutral: 0.7, Mixed: 0.0 } },
        
        // Text 3 responses
        { Languages: [{ LanguageCode: 'en' }] },
        { KeyPhrases: [{ Text: 'Python programming', Score: 0.9 }] },
        { Entities: [] },
        { Sentiment: 'NEUTRAL', SentimentScore: { Positive: 0.3, Negative: 0.1, Neutral: 0.6, Mixed: 0.0 } },
        
        // Text 4 responses
        { Languages: [{ LanguageCode: 'en' }] },
        { KeyPhrases: [{ Text: 'funny video', Score: 0.8 }] },
        { Entities: [] },
        { Sentiment: 'POSITIVE', SentimentScore: { Positive: 0.9, Negative: 0.05, Neutral: 0.05, Mixed: 0.0 } },
      ];

      mockResponses.forEach(response => {
        comprehendClient.send.mockResolvedValueOnce(response);
      });

      const results = await intentClassificationService.batchClassifyIntent(texts);

      expect(results).toHaveLength(4);
      expect(results[0].intent).toBe('promotional');
      expect(results[1].intent).toBe('educational'); // "What is machine learning?" is educational
      expect(results[2].intent).toBe('educational');
      expect(results[3].intent).toBe('entertainment');
      
      results.forEach(result => {
        expect(result.confidenceScore).toBeGreaterThan(0);
        expect(result.processingTime).toBeGreaterThanOrEqual(0);
        expect(['informational', 'promotional', 'educational', 'entertainment']).toContain(result.intent);
      });
    });

    it('should handle empty batch', async () => {
      const results = await intentClassificationService.batchClassifyIntent([]);
      expect(results).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle mixed content with balanced indicators', async () => {
      const mixedText = 'Learn about our products. What makes them special? Buy now and save money! This educational content is fun and informative.';
      
      const { comprehendClient } = require('../src/services/aws-clients');
      const { retryOperation } = require('../src/utils');
      
      retryOperation.mockImplementation((operation: any) => operation());
      
      comprehendClient.send
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en' }] })
        .mockResolvedValueOnce({
          KeyPhrases: [
            { Text: 'our products', Score: 0.7 },
            { Text: 'educational content', Score: 0.8 },
            { Text: 'buy now', Score: 0.6 },
          ]
        })
        .mockResolvedValueOnce({ Entities: [] })
        .mockResolvedValueOnce({
          Sentiment: 'POSITIVE',
          SentimentScore: { Positive: 0.6, Negative: 0.1, Neutral: 0.3, Mixed: 0.0 }
        });

      const result = await intentClassificationService.classifyIntent(mixedText);

      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThan(0.3);
      
      // Should have reasonable scores for multiple intents
      const indicators = result.features.contentIndicators;
      const nonZeroIndicators = Object.values(indicators).filter(score => score > 0).length;
      expect(nonZeroIndicators).toBeGreaterThan(1);
    });

    it('should assign minimum confidence when content is ambiguous', async () => {
      const ambiguousText = 'This is some text that does not clearly indicate any specific intent category.';
      
      const { comprehendClient } = require('../src/services/aws-clients');
      const { retryOperation } = require('../src/utils');
      
      retryOperation.mockImplementation((operation: any) => operation());
      
      comprehendClient.send
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en' }] })
        .mockResolvedValueOnce({ KeyPhrases: [] })
        .mockResolvedValueOnce({ Entities: [] })
        .mockResolvedValueOnce({
          Sentiment: 'NEUTRAL',
          SentimentScore: { Positive: 0.25, Negative: 0.25, Neutral: 0.5, Mixed: 0.0 }
        });

      const result = await intentClassificationService.classifyIntent(ambiguousText);

      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.3); // Minimum confidence threshold
    });
  });
});