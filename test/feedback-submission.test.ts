import { handler } from '../src/lambda/feedback/submit-feedback';
import { APIGatewayEvent } from '../src/types';
import { engagementFeedbackService, generatedContentService } from '../src/services/database';
import { feedbackProcessingService, PerformanceCategory } from '../src/services/feedback-processing';
import { openSearchService } from '../src/services/opensearch-service';

// Mock the services
jest.mock('../src/services/database');
jest.mock('../src/services/feedback-processing');
jest.mock('../src/services/opensearch-service');

// Mock utils
const mockValidateToken = jest.fn();
const mockCreateResponse = jest.fn();
const mockGenerateFeedbackId = jest.fn();
const mockGetCurrentTimestamp = jest.fn();

jest.mock('../src/utils', () => ({
  validateToken: mockValidateToken,
  createResponse: mockCreateResponse,
  generateFeedbackId: mockGenerateFeedbackId,
  getCurrentTimestamp: mockGetCurrentTimestamp
}));

const mockEngagementFeedbackService = engagementFeedbackService as jest.Mocked<typeof engagementFeedbackService>;
const mockGeneratedContentService = generatedContentService as jest.Mocked<typeof generatedContentService>;
const mockFeedbackProcessingService = feedbackProcessingService as jest.Mocked<typeof feedbackProcessingService>;
const mockOpenSearchService = openSearchService as jest.Mocked<typeof openSearchService>;

describe('Submit Feedback Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockValidateToken.mockResolvedValue({
      isValid: true,
      userId: 'test-user-123',
      email: 'test@example.com'
    });
    
    mockCreateResponse.mockImplementation((statusCode, body) => ({
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify(body)
    }));
    
    mockGenerateFeedbackId.mockReturnValue('feedback-123');
    mockGetCurrentTimestamp.mockReturnValue('2024-01-15T10:00:00.000Z');

    // Setup service mocks
    mockGeneratedContentService.getContent = jest.fn();
    mockEngagementFeedbackService.createFeedback = jest.fn();
    mockFeedbackProcessingService.processFeedback = jest.fn();
    mockOpenSearchService.indexFeedback = jest.fn();
  });

  const createMockEvent = (body: any, headers: any = {}): APIGatewayEvent => ({
    httpMethod: 'POST',
    path: '/feedback/submit',
    pathParameters: null,
    queryStringParameters: null,
    headers: {
      'Authorization': 'Bearer valid-token',
      ...headers
    },
    body: JSON.stringify(body),
    requestContext: {
      requestId: 'test-request-id',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent'
      }
    }
  });

  const createValidFeedbackRequest = () => ({
    contentId: 'content-123',
    platform: 'twitter',
    metrics: {
      likes: 50,
      shares: 10,
      comments: 5,
      clickThroughRate: 0.03,
      engagementRate: 0.08,
      impressions: 1000,
      reach: 800
    }
  });

  const createMockContent = () => ({
    contentId: 'content-123',
    userId: 'test-user-123',
    platform: 'twitter',
    contentType: 'social-post',
    generatedText: 'Test content',
    metadata: {
      wordCount: 10,
      hashtags: ['#test', '#content'],
      seoKeywords: ['test', 'content']
    },
    createdAt: '2024-01-15T09:00:00.000Z'
  });

  const createMockProcessedFeedback = () => ({
    feedback: expect.any(Object),
    content: expect.any(Object),
    derivedMetrics: {
      totalEngagement: 65,
      engagementScore: 0.05,
      viralityCoefficient: 0.15,
      interactionDepth: 0.1,
      engagementPerImpression: 0.065,
      engagementPerReach: 0.08125,
      engagementPerWord: 6.5,
      performanceCategory: 'medium' as PerformanceCategory,
      qualityScore: 7.5
    },
    performanceAnalysis: expect.any(Object),
    insights: [
      'This content achieved medium performance on twitter',
      'High engagement per word indicates concise, impactful content'
    ],
    processedAt: expect.any(String)
  });

  describe('Successful feedback submission', () => {
    it('should successfully submit valid feedback', async () => {
      // Arrange
      const requestBody = createValidFeedbackRequest();
      const event = createMockEvent(requestBody);
      const mockContent = createMockContent();
      const mockProcessedFeedback = createMockProcessedFeedback();

      (mockGeneratedContentService.getContent as jest.Mock).mockResolvedValue(mockContent);
      (mockEngagementFeedbackService.createFeedback as jest.Mock).mockResolvedValue(undefined);
      (mockFeedbackProcessingService.processFeedback as jest.Mock).mockResolvedValue(mockProcessedFeedback);
      (mockOpenSearchService.indexFeedback as jest.Mock).mockResolvedValue(undefined);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(201);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody).toEqual({
        message: 'Feedback submitted successfully',
        feedbackId: 'feedback-123',
        timestamp: '2024-01-15T10:00:00.000Z',
        insights: mockProcessedFeedback.insights,
        performanceCategory: 'medium',
        qualityScore: 7.5
      });

      // Verify service calls
      expect(mockGeneratedContentService.getContent).toHaveBeenCalledWith('content-123');
      expect(mockEngagementFeedbackService.createFeedback).toHaveBeenCalledWith({
        feedbackId: 'feedback-123',
        contentId: 'content-123',
        userId: 'test-user-123',
        platform: 'twitter',
        metrics: requestBody.metrics,
        timestamp: '2024-01-15T10:00:00.000Z'
      });
      expect(mockFeedbackProcessingService.processFeedback).toHaveBeenCalled();
    });

    it('should handle custom timestamp in request', async () => {
      // Arrange
      const customTimestamp = '2024-01-15T12:00:00.000Z';
      const requestBody = {
        ...createValidFeedbackRequest(),
        timestamp: customTimestamp
      };
      const event = createMockEvent(requestBody);
      const mockContent = createMockContent();
      const mockProcessedFeedback = createMockProcessedFeedback();

      (mockGeneratedContentService.getContent as jest.Mock).mockResolvedValue(mockContent);
      (mockEngagementFeedbackService.createFeedback as jest.Mock).mockResolvedValue(undefined);
      (mockFeedbackProcessingService.processFeedback as jest.Mock).mockResolvedValue(mockProcessedFeedback);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(201);
      expect(mockEngagementFeedbackService.createFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: customTimestamp
        })
      );
    });

    it('should handle OpenSearch indexing failure gracefully', async () => {
      // Arrange
      const requestBody = createValidFeedbackRequest();
      const event = createMockEvent(requestBody);
      const mockContent = createMockContent();
      const mockProcessedFeedback = createMockProcessedFeedback();

      mockGeneratedContentService.getContent.mockResolvedValue(mockContent);
      mockEngagementFeedbackService.createFeedback.mockResolvedValue();
      mockFeedbackProcessingService.processFeedback.mockResolvedValue(mockProcessedFeedback);
      mockOpenSearchService.indexFeedback.mockRejectedValue(new Error('OpenSearch error'));

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(201); // Should still succeed
      const responseBody = JSON.parse(result.body);
      expect(responseBody.message).toBe('Feedback submitted successfully');
    });
  });

  describe('Authentication validation', () => {
    it('should return 401 for missing authorization header', async () => {
      // Arrange
      const requestBody = createValidFeedbackRequest();
      const event = createMockEvent(requestBody, { Authorization: undefined });
      
      mockUtils.validateToken.mockResolvedValue({
        isValid: false,
        userId: null,
        email: null
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(401);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Unauthorized');
    });

    it('should return 401 for invalid token', async () => {
      // Arrange
      const requestBody = createValidFeedbackRequest();
      const event = createMockEvent(requestBody);
      
      mockUtils.validateToken.mockResolvedValue({
        isValid: false,
        userId: null,
        email: null
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(401);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Unauthorized');
    });
  });

  describe('Request validation', () => {
    it('should return 400 for missing request body', async () => {
      // Arrange
      const event = createMockEvent(null);
      event.body = null;

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Request body is required');
    });

    it('should return 400 for invalid JSON', async () => {
      // Arrange
      const event = createMockEvent({});
      event.body = 'invalid json';

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Invalid JSON in request body');
    });

    it('should return 400 for missing required fields', async () => {
      // Arrange
      const requestBody = {
        // Missing contentId, platform, and metrics
      };
      const event = createMockEvent(requestBody);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Validation failed');
      expect(responseBody.details).toContain('contentId is required and must be a string');
      expect(responseBody.details).toContain('platform is required and must be a string');
      expect(responseBody.details).toContain('metrics is required and must be an object');
    });

    it('should return 400 for invalid platform', async () => {
      // Arrange
      const requestBody = {
        ...createValidFeedbackRequest(),
        platform: 'invalid-platform'
      };
      const event = createMockEvent(requestBody);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Validation failed');
      expect(responseBody.details).toContain('platform must be one of: blog, twitter, facebook, instagram, linkedin, youtube, tiktok');
    });

    it('should return 400 for invalid metrics', async () => {
      // Arrange
      const requestBody = {
        ...createValidFeedbackRequest(),
        metrics: {
          likes: -5, // Invalid negative value
          shares: 'invalid', // Invalid type
          // Missing required fields
        }
      };
      const event = createMockEvent(requestBody);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Validation failed');
      expect(responseBody.details).toContain('metrics.likes must be non-negative');
      expect(responseBody.details).toContain('metrics.shares must be a number');
      expect(responseBody.details).toContain('metrics.comments is required');
    });

    it('should return 400 for invalid rate metrics', async () => {
      // Arrange
      const requestBody = {
        ...createValidFeedbackRequest(),
        metrics: {
          ...createValidFeedbackRequest().metrics,
          clickThroughRate: 1.5, // Invalid > 1
          engagementRate: -0.1 // Invalid < 0
        }
      };
      const event = createMockEvent(requestBody);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Validation failed');
      expect(responseBody.details).toContain('metrics.clickThroughRate must be between 0 and 1');
      expect(responseBody.details).toContain('metrics.engagementRate must be between 0 and 1');
    });
  });

  describe('Content validation', () => {
    it('should return 404 for non-existent content', async () => {
      // Arrange
      const requestBody = createValidFeedbackRequest();
      const event = createMockEvent(requestBody);

      mockGeneratedContentService.getContent.mockResolvedValue(null);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(404);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Content not found');
    });

    it('should return 403 for content not owned by user', async () => {
      // Arrange
      const requestBody = createValidFeedbackRequest();
      const event = createMockEvent(requestBody);
      const mockContent = {
        ...createMockContent(),
        userId: 'different-user-456' // Different user
      };

      mockGeneratedContentService.getContent.mockResolvedValue(mockContent);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(403);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Access denied to this content');
    });
  });

  describe('Error handling', () => {
    it('should return 500 for database errors', async () => {
      // Arrange
      const requestBody = createValidFeedbackRequest();
      const event = createMockEvent(requestBody);
      const mockContent = createMockContent();

      mockGeneratedContentService.getContent.mockResolvedValue(mockContent);
      mockEngagementFeedbackService.createFeedback.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Internal server error');
      expect(responseBody.message).toBe('Failed to submit feedback');
    });

    it('should return 500 for feedback processing errors', async () => {
      // Arrange
      const requestBody = createValidFeedbackRequest();
      const event = createMockEvent(requestBody);
      const mockContent = createMockContent();

      mockGeneratedContentService.getContent.mockResolvedValue(mockContent);
      mockEngagementFeedbackService.createFeedback.mockResolvedValue();
      mockFeedbackProcessingService.processFeedback.mockRejectedValue(new Error('Processing error'));

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Internal server error');
    });
  });

  describe('Edge cases', () => {
    it('should handle zero engagement metrics', async () => {
      // Arrange
      const requestBody = {
        ...createValidFeedbackRequest(),
        metrics: {
          likes: 0,
          shares: 0,
          comments: 0,
          clickThroughRate: 0,
          engagementRate: 0
        }
      };
      const event = createMockEvent(requestBody);
      const mockContent = createMockContent();
      const mockProcessedFeedback = createMockProcessedFeedback();

      mockGeneratedContentService.getContent.mockResolvedValue(mockContent);
      mockEngagementFeedbackService.createFeedback.mockResolvedValue();
      mockFeedbackProcessingService.processFeedback.mockResolvedValue(mockProcessedFeedback);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(201);
      expect(mockEngagementFeedbackService.createFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: requestBody.metrics
        })
      );
    });

    it('should handle maximum engagement metrics', async () => {
      // Arrange
      const requestBody = {
        ...createValidFeedbackRequest(),
        metrics: {
          likes: 999999,
          shares: 999999,
          comments: 999999,
          clickThroughRate: 1.0,
          engagementRate: 1.0,
          impressions: 999999,
          reach: 999999
        }
      };
      const event = createMockEvent(requestBody);
      const mockContent = createMockContent();
      const mockProcessedFeedback = createMockProcessedFeedback();

      mockGeneratedContentService.getContent.mockResolvedValue(mockContent);
      mockEngagementFeedbackService.createFeedback.mockResolvedValue();
      mockFeedbackProcessingService.processFeedback.mockResolvedValue(mockProcessedFeedback);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(201);
      expect(mockEngagementFeedbackService.createFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: requestBody.metrics
        })
      );
    });

    it('should handle optional metrics fields', async () => {
      // Arrange
      const requestBody = {
        contentId: 'content-123',
        platform: 'twitter',
        metrics: {
          likes: 50,
          shares: 10,
          comments: 5,
          clickThroughRate: 0.03,
          engagementRate: 0.08
          // Missing optional impressions and reach
        }
      };
      const event = createMockEvent(requestBody);
      const mockContent = createMockContent();
      const mockProcessedFeedback = createMockProcessedFeedback();

      mockGeneratedContentService.getContent.mockResolvedValue(mockContent);
      mockEngagementFeedbackService.createFeedback.mockResolvedValue();
      mockFeedbackProcessingService.processFeedback.mockResolvedValue(mockProcessedFeedback);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(201);
    });
  });
});