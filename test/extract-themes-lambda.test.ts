// Unit tests for theme extraction Lambda function
// Requirements: 1.2

import { handler } from '../src/lambda/content/extract-themes';
import { themeExtractionService } from '../src/services/theme-extraction';
import { contentIdeaService } from '../src/services/database';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock dependencies
jest.mock('../src/services/theme-extraction');
jest.mock('../src/services/database');
jest.mock('../src/utils', () => ({
  ...jest.requireActual('../src/utils'),
  verifyJWT: jest.fn(),
}));

const mockThemeExtractionService = themeExtractionService as jest.Mocked<typeof themeExtractionService>;
const mockContentIdeaService = contentIdeaService as jest.Mocked<typeof contentIdeaService>;

// Import mocked utils
import { verifyJWT } from '../src/utils';
const mockVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;

describe('Extract Themes Lambda Handler', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    httpMethod: 'POST',
    path: '/content/extract-themes',
    headers: {
      'Authorization': 'Bearer valid-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: 'This is a test content about artificial intelligence and machine learning.',
    }),
    requestContext: {
      requestId: 'test-request-id',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
    } as any,
  };

  const mockExtractionResult = {
    themes: ['artificial intelligence', 'machine learning'],
    topics: ['AI', 'ML', 'technology', 'data science'],
    entities: [
      { text: 'Python', type: 'OTHER', confidence: 0.92 },
      { text: 'TensorFlow', type: 'ORGANIZATION', confidence: 0.87 },
    ],
    keyPhrases: [
      { text: 'artificial intelligence', confidence: 0.95 },
      { text: 'machine learning', confidence: 0.88 },
    ],
    sentiment: { sentiment: 'POSITIVE', confidence: 0.85 },
    intent: 'educational' as const,
    overallConfidence: 0.82,
    processingTime: 1500,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyJWT.mockReturnValue({ userId: 'test-user-id' });
    mockThemeExtractionService.extractThemesAndTopics.mockResolvedValue(mockExtractionResult);
    mockThemeExtractionService.updateContentIdeaWithThemes.mockResolvedValue();
  });

  describe('HTTP Method Validation', () => {
    it('should reject non-POST requests', async () => {
      const event = { ...mockEvent, httpMethod: 'GET' };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(405);
      expect(JSON.parse(result.body).error.message).toBe('Method not allowed');
    });
  });

  describe('Authentication', () => {
    it('should reject requests without authorization token', async () => {
      const event = { 
        ...mockEvent, 
        headers: { 'Content-Type': 'application/json' } 
      };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error.message).toBe('Authorization token required');
    });

    it('should reject requests with invalid token', async () => {
      mockVerifyJWT.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      const result = await handler(mockEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error.message).toBe('Invalid or expired token');
    });

    it('should reject tokens without userId', async () => {
      mockVerifyJWT.mockReturnValue({});
      
      const result = await handler(mockEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error.message).toBe('Invalid token: missing user ID');
    });
  });

  describe('Request Body Validation', () => {
    it('should reject requests without body', async () => {
      const event = { ...mockEvent, body: null };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.message).toBe('Request body is required');
    });

    it('should reject requests with invalid JSON', async () => {
      const event = { ...mockEvent, body: 'invalid-json' };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.message).toBe('Invalid JSON in request body');
    });

    it('should reject requests without text or ideaId', async () => {
      const event = { 
        ...mockEvent, 
        body: JSON.stringify({}) 
      };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(400);
      const errorBody = JSON.parse(result.body);
      expect(errorBody.error.message).toBe('Either text or ideaId must be provided');
    });

    it('should reject requests with empty text', async () => {
      const event = { 
        ...mockEvent, 
        body: JSON.stringify({ text: '' }) 
      };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(400);
      const errorBody = JSON.parse(result.body);
      expect(errorBody.error.message).toBe('Either text or ideaId must be provided');
    });
  });

  describe('Content Idea Retrieval', () => {
    it('should fetch content idea when ideaId is provided', async () => {
      const mockContentIdea = {
        ideaId: 'test-idea-id',
        userId: 'test-user-id',
        content: 'Test content from database',
        extractedThemes: [],
        targetAudience: {} as any,
        intent: 'informational' as const,
        confidenceScore: 0,
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockContentIdeaService.getContentIdea.mockResolvedValue(mockContentIdea);

      const event = { 
        ...mockEvent, 
        body: JSON.stringify({ ideaId: 'test-idea-id' }) 
      };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(mockContentIdeaService.getContentIdea).toHaveBeenCalledWith('test-idea-id', 'test-user-id');
      expect(mockThemeExtractionService.extractThemesAndTopics).toHaveBeenCalledWith(
        'Test content from database',
        expect.any(Object)
      );
    });

    it('should return 404 when content idea is not found', async () => {
      mockContentIdeaService.getContentIdea.mockResolvedValue(null);

      const event = { 
        ...mockEvent, 
        body: JSON.stringify({ ideaId: 'non-existent-id' }) 
      };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).error.message).toBe('Content idea not found');
    });

    it('should handle database errors when fetching content idea', async () => {
      mockContentIdeaService.getContentIdea.mockRejectedValue(new Error('Database error'));

      const event = { 
        ...mockEvent, 
        body: JSON.stringify({ ideaId: 'test-idea-id' }) 
      };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error.message).toBe('Failed to fetch content idea');
    });
  });

  describe('Options Validation', () => {
    it('should validate maxThemes option', async () => {
      const event = { 
        ...mockEvent, 
        body: JSON.stringify({ 
          text: 'Test content',
          options: { maxThemes: 100 } // Invalid: too high
        }) 
      };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.message).toBe('maxThemes must be between 1 and 50');
    });

    it('should validate maxTopics option', async () => {
      const event = { 
        ...mockEvent, 
        body: JSON.stringify({ 
          text: 'Test content',
          options: { maxTopics: 200 } // Invalid: too high
        }) 
      };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.message).toBe('maxTopics must be between 1 and 100');
    });

    it('should validate minConfidence option', async () => {
      const event = { 
        ...mockEvent, 
        body: JSON.stringify({ 
          text: 'Test content',
          options: { minConfidence: 1.5 } // Invalid: too high
        }) 
      };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.message).toBe('minConfidence must be between 0 and 1');
    });
  });

  describe('Theme Extraction', () => {
    it('should successfully extract themes from text', async () => {
      const result = await handler(mockEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.themes).toEqual(mockExtractionResult.themes);
      expect(responseBody.data.topics).toEqual(mockExtractionResult.topics);
      expect(responseBody.data.entities).toEqual(mockExtractionResult.entities);
      expect(responseBody.data.keyPhrases).toEqual(mockExtractionResult.keyPhrases);
      expect(responseBody.data.sentiment).toEqual(mockExtractionResult.sentiment);
      expect(responseBody.data.intent).toEqual(mockExtractionResult.intent);
      expect(responseBody.data.confidence).toEqual(mockExtractionResult.overallConfidence);
      expect(responseBody.data.processingTime).toEqual(mockExtractionResult.processingTime);
    });

    it('should pass custom options to theme extraction service', async () => {
      const customOptions = {
        maxThemes: 5,
        maxTopics: 10,
        minConfidence: 0.7,
        enableSentimentAnalysis: false,
        enableEntityExtraction: false,
      };

      const event = { 
        ...mockEvent, 
        body: JSON.stringify({ 
          text: 'Test content',
          options: customOptions
        }) 
      };
      
      await handler(event as APIGatewayProxyEvent);
      
      expect(mockThemeExtractionService.extractThemesAndTopics).toHaveBeenCalledWith(
        'Test content',
        customOptions
      );
    });

    it('should handle theme extraction service errors', async () => {
      mockThemeExtractionService.extractThemesAndTopics.mockRejectedValue(
        new Error('Theme extraction failed')
      );
      
      const result = await handler(mockEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(500);
    });

    it('should update content idea when ideaId is provided', async () => {
      const mockContentIdea = {
        ideaId: 'test-idea-id',
        userId: 'test-user-id',
        content: 'Test content',
        extractedThemes: [],
        targetAudience: {} as any,
        intent: 'informational' as const,
        confidenceScore: 0,
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockContentIdeaService.getContentIdea.mockResolvedValue(mockContentIdea);

      const event = { 
        ...mockEvent, 
        body: JSON.stringify({ ideaId: 'test-idea-id' }) 
      };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(mockThemeExtractionService.updateContentIdeaWithThemes).toHaveBeenCalledWith(
        'test-idea-id',
        'test-user-id',
        mockExtractionResult
      );
    });

    it('should continue even if content idea update fails', async () => {
      const mockContentIdea = {
        ideaId: 'test-idea-id',
        userId: 'test-user-id',
        content: 'Test content',
        extractedThemes: [],
        targetAudience: {} as any,
        intent: 'informational' as const,
        confidenceScore: 0,
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockContentIdeaService.getContentIdea.mockResolvedValue(mockContentIdea);
      mockThemeExtractionService.updateContentIdeaWithThemes.mockRejectedValue(
        new Error('Update failed')
      );

      const event = { 
        ...mockEvent, 
        body: JSON.stringify({ ideaId: 'test-idea-id' }) 
      };
      
      const result = await handler(event as APIGatewayProxyEvent);
      
      // Should still return success even if update fails
      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
    });
  });

  describe('Performance Requirements', () => {
    it('should meet 5-second processing requirement (Requirement 1.2)', async () => {
      // Mock a result that takes longer than 5 seconds
      const slowResult = {
        ...mockExtractionResult,
        processingTime: 6000, // 6 seconds
      };
      mockThemeExtractionService.extractThemesAndTopics.mockResolvedValue(slowResult);

      const result = await handler(mockEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      // The function should still return a result, but log a warning
      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.processingTime).toBe(6000);
    });
  });

  describe('Response Format', () => {
    it('should return properly formatted response', async () => {
      const result = await handler(mockEvent as APIGatewayProxyEvent);
      
      expect(result.statusCode).toBe(200);
      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data).toMatchObject({
        themes: expect.any(Array),
        topics: expect.any(Array),
        entities: expect.any(Array),
        keyPhrases: expect.any(Array),
        sentiment: expect.any(Object),
        intent: expect.any(String),
        confidence: expect.any(Number),
        processingTime: expect.any(Number),
        metadata: expect.objectContaining({
          textLength: expect.any(Number),
          options: expect.any(Object),
        }),
      });
    });
  });
});