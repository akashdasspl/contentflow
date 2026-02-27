// Lambda function tests for Learning Integration

import { handler as trainModelHandler } from '../src/lambda/learning/train-model';
import { handler as getInsightsHandler } from '../src/lambda/learning/get-insights';
import { handler as updateProfilesHandler } from '../src/lambda/learning/update-profiles';
import { learningIntegrationService } from '../src/services/learning-integration';
import { APIGatewayEvent, SQSEvent } from '../src/types';

// Mock the learning integration service
jest.mock('../src/services/learning-integration');
jest.mock('../src/utils/auth');

const mockLearningIntegrationService = learningIntegrationService as jest.Mocked<typeof learningIntegrationService>;

// Mock auth validation
const mockValidateToken = require('../src/utils/auth').validateToken as jest.MockedFunction<any>;

describe('Learning Lambda Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateToken.mockResolvedValue({ isValid: true, userId: 'user123' });
  });

  describe('train-model Lambda', () => {
    it('should successfully train a model', async () => {
      const mockTrainingResult = {
        trainingJobName: 'test-job',
        modelName: 'test-model',
        endpoint: 'test-endpoint',
        status: 'Completed',
        trainingDataSize: 50,
        metrics: {
          trainingAccuracy: 0.85,
          validationAccuracy: 0.82,
        },
      };

      mockLearningIntegrationService.trainUserPreferenceModel.mockResolvedValue(mockTrainingResult);

      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        path: '/learning/train-model',
        pathParameters: null,
        queryStringParameters: null,
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRange: {
            start: '2024-01-01',
            end: '2024-01-31',
          },
          instanceType: 'ml.m5.large',
          minSamples: 20,
        }),
        requestContext: {
          requestId: 'test-request-id',
          identity: {
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      };

      const result = await trainModelHandler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        success: true,
        data: mockTrainingResult,
      });
      expect(mockLearningIntegrationService.trainUserPreferenceModel).toHaveBeenCalledWith('user123', {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        instanceType: 'ml.m5.large',
        minSamples: 20,
      });
    });

    it('should handle insufficient training data error', async () => {
      mockLearningIntegrationService.trainUserPreferenceModel.mockRejectedValue(
        new Error('Insufficient training data - need at least 10 feedback samples')
      );

      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        path: '/learning/train-model',
        pathParameters: null,
        queryStringParameters: null,
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        requestContext: {
          requestId: 'test-request-id',
          identity: {
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      };

      const result = await trainModelHandler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Model Training Failed',
        message: 'Insufficient training data - need at least 10 feedback samples',
      });
    });

    it('should handle unauthorized requests', async () => {
      mockValidateToken.mockResolvedValue({ isValid: false });

      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        path: '/learning/train-model',
        pathParameters: null,
        queryStringParameters: null,
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
        body: JSON.stringify({}),
        requestContext: {
          requestId: 'test-request-id',
          identity: {
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      };

      const result = await trainModelHandler(event);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Unauthorized',
        message: 'Invalid or missing authentication token',
      });
    });
  });

  describe('get-insights Lambda', () => {
    it('should successfully get learning insights', async () => {
      const mockInsights = {
        userId: 'user123',
        generatedAt: '2024-01-01T00:00:00Z',
        profileSummary: {
          'user123:twitter:social-post': {
            platform: 'twitter',
            contentType: 'social-post',
            trainingDataSize: 25,
            lastUpdated: '2024-01-01T00:00:00Z',
            modelVersion: 'v1',
            confidenceScore: 0.8,
          },
        },
        performanceImprovements: {
          'user123:twitter:social-post': {
            engagementRateImprovement: 0.15,
            clickThroughRateImprovement: 0.08,
            overallPerformanceGain: 0.12,
            confidenceLevel: 0.85,
          },
        },
        recommendations: [
          'Focus more content on twitter - your best performing platform',
          'Create more social-post content - it performs better than average',
        ],
        modelMetrics: {},
      };

      mockLearningIntegrationService.getLearningInsights.mockResolvedValue(mockInsights);

      const event: APIGatewayEvent = {
        httpMethod: 'GET',
        path: '/learning/insights',
        pathParameters: null,
        queryStringParameters: {
          includeMetrics: 'true',
          includeRecommendations: 'true',
        },
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: null,
        requestContext: {
          requestId: 'test-request-id',
          identity: {
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      };

      const result = await getInsightsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        success: true,
        data: mockInsights,
      });
      expect(mockLearningIntegrationService.getLearningInsights).toHaveBeenCalledWith('user123', {
        includeMetrics: true,
        includeRecommendations: true,
        dateRange: undefined,
      });
    });

    it('should handle query parameters correctly', async () => {
      const mockInsights = {
        userId: 'user123',
        generatedAt: '2024-01-01T00:00:00Z',
        profileSummary: {},
        performanceImprovements: {},
        recommendations: [],
        modelMetrics: {},
      };

      mockLearningIntegrationService.getLearningInsights.mockResolvedValue(mockInsights);

      const event: APIGatewayEvent = {
        httpMethod: 'GET',
        path: '/learning/insights',
        pathParameters: null,
        queryStringParameters: {
          includeMetrics: 'false',
          includeRecommendations: 'false',
          dateRange: JSON.stringify({ start: '2024-01-01', end: '2024-01-31' }),
        },
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: null,
        requestContext: {
          requestId: 'test-request-id',
          identity: {
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          },
        },
      };

      const result = await getInsightsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockLearningIntegrationService.getLearningInsights).toHaveBeenCalledWith('user123', {
        includeMetrics: false,
        includeRecommendations: false,
        dateRange: { start: '2024-01-01', end: '2024-01-31' },
      });
    });
  });

  describe('update-profiles Lambda', () => {
    it('should successfully process feedback update messages', async () => {
      mockLearningIntegrationService.updateLearningProfiles.mockResolvedValue(undefined);

      const sqsEvent: SQSEvent = {
        Records: [
          {
            messageId: 'message-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              eventType: 'feedback-submitted',
              data: {
                feedbackId: 'feedback123',
                contentId: 'content123',
                userId: 'user123',
                platform: 'twitter',
                metrics: {
                  likes: 15,
                  shares: 3,
                  comments: 2,
                  clickThroughRate: 0.06,
                  engagementRate: 0.12,
                },
                timestamp: '2024-01-01T00:00:00Z',
              },
            }),
            attributes: {},
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
            awsRegion: 'us-east-1',
          },
        ],
      };

      await expect(updateProfilesHandler(sqsEvent)).resolves.toBeUndefined();

      expect(mockLearningIntegrationService.updateLearningProfiles).toHaveBeenCalledWith({
        feedbackId: 'feedback123',
        contentId: 'content123',
        userId: 'user123',
        platform: 'twitter',
        metrics: {
          likes: 15,
          shares: 3,
          comments: 2,
          clickThroughRate: 0.06,
          engagementRate: 0.12,
        },
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    it('should skip unknown message types', async () => {
      const sqsEvent: SQSEvent = {
        Records: [
          {
            messageId: 'message-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              eventType: 'unknown-event',
              data: {},
            }),
            attributes: {},
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
            awsRegion: 'us-east-1',
          },
        ],
      };

      await expect(updateProfilesHandler(sqsEvent)).resolves.toBeUndefined();

      expect(mockLearningIntegrationService.updateLearningProfiles).not.toHaveBeenCalled();
    });

    it('should handle processing errors', async () => {
      mockLearningIntegrationService.updateLearningProfiles.mockRejectedValue(
        new Error('Database connection failed')
      );

      const sqsEvent: SQSEvent = {
        Records: [
          {
            messageId: 'message-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              eventType: 'feedback-submitted',
              data: {
                feedbackId: 'feedback123',
                contentId: 'content123',
                userId: 'user123',
                platform: 'twitter',
                metrics: {
                  likes: 15,
                  shares: 3,
                  comments: 2,
                  clickThroughRate: 0.06,
                  engagementRate: 0.12,
                },
                timestamp: '2024-01-01T00:00:00Z',
              },
            }),
            attributes: {},
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
            awsRegion: 'us-east-1',
          },
        ],
      };

      await expect(updateProfilesHandler(sqsEvent)).rejects.toThrow('Database connection failed');
    });

    it('should process multiple records', async () => {
      mockLearningIntegrationService.updateLearningProfiles.mockResolvedValue(undefined);

      const sqsEvent: SQSEvent = {
        Records: [
          {
            messageId: 'message-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              eventType: 'feedback-submitted',
              data: {
                feedbackId: 'feedback123',
                contentId: 'content123',
                userId: 'user123',
                platform: 'twitter',
                metrics: {
                  likes: 15,
                  shares: 3,
                  comments: 2,
                  clickThroughRate: 0.06,
                  engagementRate: 0.12,
                },
                timestamp: '2024-01-01T00:00:00Z',
              },
            }),
            attributes: {},
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
            awsRegion: 'us-east-1',
          },
          {
            messageId: 'message-2',
            receiptHandle: 'receipt-2',
            body: JSON.stringify({
              eventType: 'feedback-submitted',
              data: {
                feedbackId: 'feedback456',
                contentId: 'content456',
                userId: 'user456',
                platform: 'facebook',
                metrics: {
                  likes: 25,
                  shares: 5,
                  comments: 3,
                  clickThroughRate: 0.08,
                  engagementRate: 0.15,
                },
                timestamp: '2024-01-01T01:00:00Z',
              },
            }),
            attributes: {},
            messageAttributes: {},
            md5OfBody: 'test-md5-2',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
            awsRegion: 'us-east-1',
          },
        ],
      };

      await expect(updateProfilesHandler(sqsEvent)).resolves.toBeUndefined();

      expect(mockLearningIntegrationService.updateLearningProfiles).toHaveBeenCalledTimes(2);
    });
  });
});