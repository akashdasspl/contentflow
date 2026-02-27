// Unit tests for intent classification Lambda function
// Requirements: 2.2

import { handler, batchHandler, getIntentStatsHandler } from '../src/lambda/content/classify-intent';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock services
jest.mock('../src/services/intent-classification', () => ({
  intentClassificationService: {
    classifyIntent: jest.fn(),
    batchClassifyIntent: jest.fn(),
  },
}));

jest.mock('../src/services/database', () => ({
  contentIdeaService: {
    getContentIdea: jest.fn(),
    updateContentIdea: jest.fn(),
    getUserContentIdeas: jest.fn(),
  },
}));

// Mock utils
jest.mock('../src/utils', () => ({
  createSuccessResponse: jest.fn().mockImplementation((data, statusCode = 200) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, data }),
  })),
  createErrorResponse: jest.fn().mockImplementation((error, statusCode = 400) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: false, error }),
  })),
  handleLambdaError: jest.fn().mockReturnValue({
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: false, error: 'Internal server error' }),
  }),
  extractTokenFromEvent: jest.fn(),
  verifyJWT: jest.fn(),
  logInfo: jest.fn(),
  logError: jest.fn(),
  validateContentIntent: jest.fn(),
}));

describe('Intent Classification Lambda Functions', () => {
  const mockEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
    httpMethod: 'POST',
    path: '/content/classify-intent',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    headers: {
      'Authorization': 'Bearer valid-token',
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    body: null,
    isBase64Encoded: false,
    stageVariables: null,
    resource: '',
    requestContext: {
      requestId: 'test-request-id',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        user: null,
        userArn: null,
      },
    } as any,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handler (single intent classification)', () => {
    it('should classify intent for provided text', async () => {
      const { intentClassificationService } = require('../src/services/intent-classification');
      const { extractTokenFromEvent, verifyJWT, createSuccessResponse } = require('../src/utils');

      extractTokenFromEvent.mockReturnValue('valid-token');
      verifyJWT.mockReturnValue({ userId: 'user123' });

      const mockClassificationResult = {
        intent: 'promotional',
        confidenceScore: 0.85,
        processingTime: 150,
        alternativeIntents: [
          { intent: 'informational', confidence: 0.3 },
        ],
        features: {
          keyPhrases: [{ text: 'buy now', score: 0.9 }],
          entities: [],
          sentiment: { sentiment: 'POSITIVE', sentimentScore: { positive: 0.8, negative: 0.1, neutral: 0.1, mixed: 0.0 } },
          textMetrics: {
            wordCount: 10,
            sentenceCount: 2,
            avgWordsPerSentence: 5,
            questionCount: 0,
            exclamationCount: 1,
            callToActionIndicators: 2,
          },
          contentIndicators: {
            promotional: 0.8,
            informational: 0.2,
            educational: 0.1,
            entertainment: 0.1,
          },
        },
        modelVersion: 'rule-based-v1.0',
      };

      intentClassificationService.classifyIntent.mockResolvedValue(mockClassificationResult);

      const event = mockEvent({
        body: JSON.stringify({
          text: 'Buy our amazing product now! Limited time offer!',
          options: { includeAlternatives: true },
        }),
      });

      const result = await handler(event);

      expect(extractTokenFromEvent).toHaveBeenCalledWith(event);
      expect(verifyJWT).toHaveBeenCalledWith('valid-token');
      expect(intentClassificationService.classifyIntent).toHaveBeenCalledWith(
        'Buy our amazing product now! Limited time offer!',
        expect.objectContaining({
          includeAlternatives: true,
        })
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          classification: mockClassificationResult,
          ideaUpdated: false,
        }),
        200
      );
    });

    it('should classify intent for existing content idea', async () => {
      const { intentClassificationService } = require('../src/services/intent-classification');
      const { contentIdeaService } = require('../src/services/database');
      const { extractTokenFromEvent, verifyJWT, createSuccessResponse } = require('../src/utils');

      extractTokenFromEvent.mockReturnValue('valid-token');
      verifyJWT.mockReturnValue({ userId: 'user123' });

      const mockContentIdea = {
        ideaId: 'idea123',
        userId: 'user123',
        content: 'Learn how to code in Python',
        extractedThemes: ['programming', 'education'],
        intent: 'educational',
        confidenceScore: 0.7,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockClassificationResult = {
        intent: 'educational',
        confidenceScore: 0.9,
        processingTime: 120,
        alternativeIntents: [],
        features: {
          keyPhrases: [{ text: 'learn how to code', score: 0.9 }],
          entities: [{ text: 'Python', type: 'OTHER', score: 0.8 }],
          sentiment: null,
          textMetrics: {
            wordCount: 6,
            sentenceCount: 1,
            avgWordsPerSentence: 6,
            questionCount: 0,
            exclamationCount: 0,
            callToActionIndicators: 0,
          },
          contentIndicators: {
            promotional: 0.1,
            informational: 0.3,
            educational: 0.8,
            entertainment: 0.1,
          },
        },
        modelVersion: 'rule-based-v1.0',
      };

      contentIdeaService.getContentIdea.mockResolvedValue(mockContentIdea);
      contentIdeaService.updateContentIdea.mockResolvedValue(mockContentIdea);
      intentClassificationService.classifyIntent.mockResolvedValue(mockClassificationResult);

      const event = mockEvent({
        body: JSON.stringify({
          ideaId: 'idea123',
        }),
      });

      const result = await handler(event);

      expect(contentIdeaService.getContentIdea).toHaveBeenCalledWith('idea123', 'user123');
      expect(intentClassificationService.classifyIntent).toHaveBeenCalledWith(
        'Learn how to code in Python',
        expect.any(Object)
      );
      expect(contentIdeaService.updateContentIdea).toHaveBeenCalledWith(
        'idea123',
        'user123',
        expect.objectContaining({
          intent: 'educational',
          confidenceScore: 0.9,
        })
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          classification: mockClassificationResult,
          ideaId: 'idea123',
          ideaUpdated: true,
        }),
        200
      );
    });

    it('should return 400 for missing text and ideaId', async () => {
      const { extractTokenFromEvent, verifyJWT, createErrorResponse } = require('../src/utils');

      extractTokenFromEvent.mockReturnValue('valid-token');
      verifyJWT.mockReturnValue({ userId: 'user123' });

      const event = mockEvent({
        body: JSON.stringify({}),
      });

      const result = await handler(event);

      expect(createErrorResponse).toHaveBeenCalledWith('Either text or ideaId must be provided', 400);
    });

    it('should return 401 for missing authorization token', async () => {
      const { extractTokenFromEvent, createErrorResponse } = require('../src/utils');

      extractTokenFromEvent.mockReturnValue(null);

      const event = mockEvent({
        headers: {},
        body: JSON.stringify({ text: 'test' }),
      });

      const result = await handler(event);

      expect(createErrorResponse).toHaveBeenCalledWith('Authorization token required', 401);
    });

    it('should return 401 for invalid token', async () => {
      const { extractTokenFromEvent, verifyJWT, createErrorResponse } = require('../src/utils');

      extractTokenFromEvent.mockReturnValue('invalid-token');
      verifyJWT.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const event = mockEvent({
        body: JSON.stringify({ text: 'test' }),
      });

      const result = await handler(event);

      expect(createErrorResponse).toHaveBeenCalledWith('Invalid or expired token', 401);
    });

    it('should return 404 for non-existent content idea', async () => {
      const { contentIdeaService } = require('../src/services/database');
      const { extractTokenFromEvent, verifyJWT, createErrorResponse } = require('../src/utils');

      extractTokenFromEvent.mockReturnValue('valid-token');
      verifyJWT.mockReturnValue({ userId: 'user123' });
      contentIdeaService.getContentIdea.mockResolvedValue(null);

      const event = mockEvent({
        body: JSON.stringify({ ideaId: 'nonexistent' }),
      });

      const result = await handler(event);

      expect(createErrorResponse).toHaveBeenCalledWith('Content idea not found', 404);
    });

    it('should return 405 for non-POST method', async () => {
      const { createErrorResponse } = require('../src/utils');

      const event = mockEvent({
        httpMethod: 'GET',
      });

      const result = await handler(event);

      expect(createErrorResponse).toHaveBeenCalledWith('Method not allowed', 405);
    });

    it('should handle classification service errors', async () => {
      const { intentClassificationService } = require('../src/services/intent-classification');
      const { extractTokenFromEvent, verifyJWT, handleLambdaError } = require('../src/utils');

      extractTokenFromEvent.mockReturnValue('valid-token');
      verifyJWT.mockReturnValue({ userId: 'user123' });
      intentClassificationService.classifyIntent.mockRejectedValue(new Error('Classification failed'));

      const event = mockEvent({
        body: JSON.stringify({ text: 'test text' }),
      });

      const result = await handler(event);

      expect(handleLambdaError).toHaveBeenCalled();
    });
  });

  describe('batchHandler (batch intent classification)', () => {
    it('should classify multiple texts in batch', async () => {
      const { intentClassificationService } = require('../src/services/intent-classification');
      const { extractTokenFromEvent, verifyJWT, createSuccessResponse } = require('../src/utils');

      extractTokenFromEvent.mockReturnValue('valid-token');
      verifyJWT.mockReturnValue({ userId: 'user123' });

      const mockBatchResults = [
        {
          intent: 'promotional',
          confidenceScore: 0.8,
          processingTime: 100,
          alternativeIntents: [],
          features: {} as any,
          modelVersion: 'rule-based-v1.0',
        },
        {
          intent: 'informational',
          confidenceScore: 0.7,
          processingTime: 120,
          alternativeIntents: [],
          features: {} as any,
          modelVersion: 'rule-based-v1.0',
        },
      ];

      intentClassificationService.batchClassifyIntent.mockResolvedValue(mockBatchResults);

      const event = mockEvent({
        path: '/content/classify-intent/batch',
        body: JSON.stringify({
          texts: ['Buy now!', 'What is AI?'],
        }),
      });

      const result = await batchHandler(event);

      expect(intentClassificationService.batchClassifyIntent).toHaveBeenCalledWith(
        ['Buy now!', 'What is AI?'],
        expect.any(Object)
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          classifications: mockBatchResults,
          totalProcessed: 2,
          averageConfidence: 0.75,
        }),
        200
      );
    });

    it('should return 400 for empty texts array', async () => {
      const { extractTokenFromEvent, verifyJWT, createErrorResponse } = require('../src/utils');

      extractTokenFromEvent.mockReturnValue('valid-token');
      verifyJWT.mockReturnValue({ userId: 'user123' });

      const event = mockEvent({
        body: JSON.stringify({ texts: [] }),
      });

      const result = await batchHandler(event);

      expect(createErrorResponse).toHaveBeenCalledWith('texts array is required and must not be empty', 400);
    });

    it('should return 400 for too many texts', async () => {
      const { extractTokenFromEvent, verifyJWT, createErrorResponse } = require('../src/utils');

      extractTokenFromEvent.mockReturnValue('valid-token');
      verifyJWT.mockReturnValue({ userId: 'user123' });

      const texts = Array(51).fill('test text');
      const event = mockEvent({
        body: JSON.stringify({ texts }),
      });

      const result = await batchHandler(event);

      expect(createErrorResponse).toHaveBeenCalledWith('Maximum 50 texts allowed per batch request', 400);
    });

    it('should return 400 for invalid text in array', async () => {
      const { extractTokenFromEvent, verifyJWT, createErrorResponse } = require('../src/utils');

      extractTokenFromEvent.mockReturnValue('valid-token');
      verifyJWT.mockReturnValue({ userId: 'user123' });

      const event = mockEvent({
        body: JSON.stringify({ texts: ['valid text', '', 'another valid text'] }),
      });

      const result = await batchHandler(event);

      expect(createErrorResponse).toHaveBeenCalledWith('Text at index 1 is invalid or empty', 400);
    });
  });

  describe('getIntentStatsHandler', () => {
    it('should return intent statistics for user', async () => {
      const { contentIdeaService } = require('../src/services/database');
      const { extractTokenFromEvent, verifyJWT, createSuccessResponse } = require('../src/utils');

      extractTokenFromEvent.mockReturnValue('valid-token');
      verifyJWT.mockReturnValue({ userId: 'user123' });

      const mockContentIdeas = [
        {
          ideaId: 'idea1',
          userId: 'user123',
          content: 'Buy now!',
          intent: 'promotional',
          confidenceScore: 0.8,
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          ideaId: 'idea2',
          userId: 'user123',
          content: 'What is AI?',
          intent: 'informational',
          confidenceScore: 0.7,
          createdAt: '2024-01-02T00:00:00Z',
        },
        {
          ideaId: 'idea3',
          userId: 'user123',
          content: 'Learn Python',
          intent: 'educational',
          confidenceScore: 0.9,
          createdAt: '2024-01-03T00:00:00Z',
        },
      ];

      contentIdeaService.getUserContentIdeas.mockResolvedValue(mockContentIdeas);

      const event = mockEvent({
        httpMethod: 'GET',
        path: '/content/intent-stats',
        body: null,
      });

      const result = await getIntentStatsHandler(event);

      expect(contentIdeaService.getUserContentIdeas).toHaveBeenCalledWith('user123', 100);
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          totalIdeas: 3,
          intentDistribution: {
            promotional: 1,
            informational: 1,
            educational: 1,
          },
          averageConfidence: expect.closeTo(0.8, 2),
          recentClassifications: expect.arrayContaining([
            expect.objectContaining({
              ideaId: 'idea3',
              intent: 'educational',
              confidenceScore: 0.9,
            }),
          ]),
          statistics: expect.objectContaining({
            highConfidenceClassifications: 1,
            mediumConfidenceClassifications: 2,
            lowConfidenceClassifications: 0,
          }),
        }),
        200
      );
    });

    it('should return empty stats for user with no content ideas', async () => {
      const { contentIdeaService } = require('../src/services/database');
      const { extractTokenFromEvent, verifyJWT, createSuccessResponse } = require('../src/utils');

      extractTokenFromEvent.mockReturnValue('valid-token');
      verifyJWT.mockReturnValue({ userId: 'user123' });
      contentIdeaService.getUserContentIdeas.mockResolvedValue([]);

      const event = mockEvent({
        httpMethod: 'GET',
        path: '/content/intent-stats',
        body: null,
      });

      const result = await getIntentStatsHandler(event);

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          totalIdeas: 0,
          intentDistribution: {},
          averageConfidence: 0,
          recentClassifications: [],
        }),
        200
      );
    });

    it('should return 405 for non-GET method', async () => {
      const { createErrorResponse } = require('../src/utils');

      const event = mockEvent({
        httpMethod: 'POST',
        path: '/content/intent-stats',
      });

      const result = await getIntentStatsHandler(event);

      expect(createErrorResponse).toHaveBeenCalledWith('Method not allowed', 405);
    });
  });
});