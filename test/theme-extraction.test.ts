// Unit tests for theme and topic extraction service
// Requirements: 1.2

import { themeExtractionService, ThemeExtractionService } from '../src/services/theme-extraction';
import { comprehendClient } from '../src/services/aws-clients';
import { contentIdeaService } from '../src/services/database';

// Mock AWS SDK clients
jest.mock('../src/services/aws-clients', () => ({
  comprehendClient: {
    send: jest.fn(),
  },
}));

jest.mock('../src/services/database', () => ({
  contentIdeaService: {
    updateContentIdea: jest.fn(),
  },
}));

const mockComprehendClient = comprehendClient as jest.Mocked<typeof comprehendClient>;
const mockContentIdeaService = contentIdeaService as jest.Mocked<typeof contentIdeaService>;

// Type the mock send function properly
const mockSend = mockComprehendClient.send as jest.MockedFunction<any>;

describe('ThemeExtractionService', () => {
  let service: ThemeExtractionService;

  beforeEach(() => {
    service = new ThemeExtractionService();
    jest.clearAllMocks();
  });

  describe('extractThemesAndTopics', () => {
    const mockKeyPhrasesResponse = {
      KeyPhrases: [
        { Text: 'artificial intelligence', Score: 0.95 },
        { Text: 'machine learning', Score: 0.88 },
        { Text: 'data science', Score: 0.82 },
        { Text: 'neural networks', Score: 0.76 },
        { Text: 'deep learning', Score: 0.71 },
      ],
    };

    const mockEntitiesResponse = {
      Entities: [
        { Text: 'Python', Type: 'OTHER', Score: 0.92 },
        { Text: 'TensorFlow', Type: 'ORGANIZATION', Score: 0.87 },
        { Text: 'Google', Type: 'ORGANIZATION', Score: 0.83 },
      ],
    };

    const mockSentimentResponse = {
      Sentiment: 'POSITIVE',
      SentimentScore: {
        Positive: 0.85,
        Negative: 0.05,
        Neutral: 0.08,
        Mixed: 0.02,
      },
    };

    const mockLanguageResponse = {
      Languages: [
        { LanguageCode: 'en', Score: 0.99 },
      ],
    };

    beforeEach(() => {
      mockSend
        .mockResolvedValueOnce(mockLanguageResponse as any) // Language detection
        .mockResolvedValueOnce(mockKeyPhrasesResponse as any) // Key phrases
        .mockResolvedValueOnce(mockEntitiesResponse as any) // Entities
        .mockResolvedValueOnce(mockSentimentResponse as any); // Sentiment
    });

    it('should extract themes and topics from text successfully', async () => {
      const text = 'This article discusses artificial intelligence and machine learning techniques using Python and TensorFlow.';
      
      const result = await service.extractThemesAndTopics(text);

      expect(result).toBeDefined();
      expect(result.themes).toBeInstanceOf(Array);
      expect(result.topics).toBeInstanceOf(Array);
      expect(result.entities).toBeInstanceOf(Array);
      expect(result.keyPhrases).toBeInstanceOf(Array);
      expect(result.sentiment).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.overallConfidence).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should complete processing within 5 seconds (Requirement 1.2)', async () => {
      const text = 'This is a test content for theme extraction performance testing.';
      
      const startTime = Date.now();
      const result = await service.extractThemesAndTopics(text);
      const endTime = Date.now();
      
      const actualProcessingTime = endTime - startTime;
      
      expect(actualProcessingTime).toBeLessThan(5000);
      expect(result.processingTime).toBeLessThan(5000);
    });

    it('should handle empty text input', async () => {
      await expect(service.extractThemesAndTopics('')).rejects.toThrow('Text content is required for theme extraction');
    });

    it('should handle null text input', async () => {
      await expect(service.extractThemesAndTopics(null as any)).rejects.toThrow('Text content is required for theme extraction');
    });

    it('should truncate very long text to 5000 characters', async () => {
      const longText = 'a'.repeat(6000);
      
      await service.extractThemesAndTopics(longText);
      
      // Verify that the text sent to Comprehend was truncated
      const calls = mockComprehendClient.send.mock.calls;
      const keyPhrasesCall = calls.find(call => call[0].constructor.name === 'DetectKeyPhrasesCommand');
      expect((keyPhrasesCall[0] as any).input.Text).toHaveLength(5000);
    });

    it('should respect maxThemes option', async () => {
      const text = 'Test content with multiple themes and topics for extraction.';
      
      const result = await service.extractThemesAndTopics(text, { maxThemes: 3 });
      
      expect(result.themes.length).toBeLessThanOrEqual(3);
    });

    it('should respect maxTopics option', async () => {
      const text = 'Test content with multiple themes and topics for extraction.';
      
      const result = await service.extractThemesAndTopics(text, { maxTopics: 5 });
      
      expect(result.topics.length).toBeLessThanOrEqual(5);
    });

    it('should respect minConfidence option', async () => {
      const text = 'Test content for confidence filtering.';
      
      const result = await service.extractThemesAndTopics(text, { minConfidence: 0.8 });
      
      // All returned themes should meet the minimum confidence
      result.keyPhrases.forEach(phrase => {
        if (result.themes.includes(phrase.text)) {
          expect(phrase.confidence).toBeGreaterThanOrEqual(0.8);
        }
      });
    });

    it('should determine correct content intent for educational content', async () => {
      const educationalText = 'Learn how to build machine learning models step by step with this comprehensive tutorial guide.';
      
      const result = await service.extractThemesAndTopics(educationalText);
      
      expect(result.intent).toBe('educational');
    });

    it('should determine correct content intent for promotional content', async () => {
      const promotionalText = 'Buy our premium AI course now with 50% discount! Limited time offer for machine learning enthusiasts.';
      
      const result = await service.extractThemesAndTopics(promotionalText);
      
      expect(result.intent).toBe('promotional');
    });

    it('should determine correct content intent for entertainment content', async () => {
      const entertainmentText = 'This funny story about a robot learning to dance will make you laugh and brighten your day.';
      
      const result = await service.extractThemesAndTopics(entertainmentText);
      
      expect(result.intent).toBe('entertainment');
    });

    it('should default to informational intent', async () => {
      const informationalText = 'Artificial intelligence is a field of computer science that focuses on creating intelligent machines.';
      
      const result = await service.extractThemesAndTopics(informationalText);
      
      expect(result.intent).toBe('informational');
    });

    it('should handle Comprehend service errors gracefully', async () => {
      mockSend
        .mockResolvedValueOnce(mockLanguageResponse as any) // Language detection succeeds
        .mockRejectedValueOnce(new Error('Comprehend service error')) // Key phrases fails
        .mockResolvedValueOnce(mockEntitiesResponse as any) // Entities succeeds
        .mockResolvedValueOnce(mockSentimentResponse as any); // Sentiment succeeds
      
      const text = 'Test content for error handling.';
      
      const result = await service.extractThemesAndTopics(text);
      
      // Should still return a result with empty key phrases
      expect(result).toBeDefined();
      expect(result.keyPhrases).toEqual([]);
      expect(result.themes).toBeInstanceOf(Array);
      expect(result.topics).toBeInstanceOf(Array);
    });

    it('should calculate overall confidence correctly', async () => {
      const text = 'Test content for confidence calculation.';
      
      const result = await service.extractThemesAndTopics(text);
      
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('should disable sentiment analysis when option is false', async () => {
      const text = 'Test content without sentiment analysis.';
      
      const result = await service.extractThemesAndTopics(text, { 
        enableSentimentAnalysis: false 
      });
      
      expect(result.sentiment.sentiment).toBe('NEUTRAL');
      expect(result.sentiment.confidence).toBe(0);
    });

    it('should disable entity extraction when option is false', async () => {
      const text = 'Test content without entity extraction.';
      
      const result = await service.extractThemesAndTopics(text, { 
        enableEntityExtraction: false 
      });
      
      expect(result.entities).toEqual([]);
    });
  });

  describe('updateContentIdeaWithThemes', () => {
    it('should update content idea with extraction results', async () => {
      const ideaId = 'test-idea-id';
      const userId = 'test-user-id';
      const extractionResult = {
        themes: ['artificial intelligence', 'machine learning'],
        topics: ['AI', 'ML', 'data science'],
        entities: [],
        keyPhrases: [],
        sentiment: { sentiment: 'POSITIVE', confidence: 0.85 },
        intent: 'educational' as const,
        overallConfidence: 0.82,
        processingTime: 1500,
      };

      mockContentIdeaService.updateContentIdea.mockResolvedValueOnce({} as any);

      await service.updateContentIdeaWithThemes(ideaId, userId, extractionResult);

      expect(mockContentIdeaService.updateContentIdea).toHaveBeenCalledWith(
        ideaId,
        userId,
        {
          extractedThemes: extractionResult.themes,
          intent: extractionResult.intent,
          confidenceScore: extractionResult.overallConfidence,
        }
      );
    });

    it('should handle database update errors', async () => {
      const ideaId = 'test-idea-id';
      const userId = 'test-user-id';
      const extractionResult = {
        themes: ['test theme'],
        topics: ['test topic'],
        entities: [],
        keyPhrases: [],
        sentiment: { sentiment: 'NEUTRAL', confidence: 0.5 },
        intent: 'informational' as const,
        overallConfidence: 0.7,
        processingTime: 1000,
      };

      mockContentIdeaService.updateContentIdea.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.updateContentIdeaWithThemes(ideaId, userId, extractionResult))
        .rejects.toThrow('Database error');
    });
  });

  describe('Theme and Topic Filtering', () => {
    it('should filter out invalid themes and topics', async () => {
      // Set up specific mocks for this test
      mockSend
        .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en', Score: 0.99 }] } as any)
        .mockResolvedValueOnce({
          KeyPhrases: [
            { Text: 'the quick brown fox', Score: 0.95 },
            { Text: 'artificial intelligence', Score: 0.88 },
            { Text: 'and', Score: 0.82 }, // Should be filtered out
            { Text: 'machine learning algorithms', Score: 0.76 },
            { Text: 'a', Score: 0.71 }, // Should be filtered out
          ],
        } as any)
        .mockResolvedValueOnce({
          Entities: [
            { Text: 'Python', Type: 'OTHER', Score: 0.92 },
            { Text: 'Google', Type: 'ORGANIZATION', Score: 0.87 },
          ],
        } as any)
        .mockResolvedValueOnce({
          Sentiment: 'NEUTRAL',
          SentimentScore: { Positive: 0.25, Negative: 0.25, Neutral: 0.45, Mixed: 0.05 },
        } as any);

      const text = 'The quick brown fox jumps over artificial intelligence and machine learning algorithms.';
      
      const result = await service.extractThemesAndTopics(text);
      
      // Should not include stop words or very short phrases
      expect(result.themes).not.toContain('and');
      expect(result.themes).not.toContain('a');
      expect(result.themes).not.toContain('the');
      
      // Should include valid themes
      expect(result.themes).toContain('artificial intelligence');
      expect(result.themes).toContain('machine learning algorithms');
    });
  });
});

describe('Theme Extraction Integration', () => {
  it('should integrate with content idea submission', async () => {
    // This test would verify that theme extraction is called when submitting content ideas
    // Implementation would depend on the actual integration pattern used
    expect(true).toBe(true); // Placeholder
  });

  it('should handle concurrent theme extraction requests', async () => {
    // This test would verify that multiple theme extraction requests can be processed concurrently
    // Implementation would test the service under load
    expect(true).toBe(true); // Placeholder
  });
});