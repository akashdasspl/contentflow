// Unit tests for audience analysis functionality
// Requirements: 2.1, 2.4

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock all external dependencies first
jest.mock('../src/services/aws-clients');
jest.mock('../src/services/database');
jest.mock('../src/utils');

// Import after mocking
import { 
  handler, 
  getAudienceProfileHandler, 
  updateAudienceProfileHandler,
  getAudienceProfileHistoryHandler,
  updateAudienceProfileFieldHandler 
} from '../src/lambda/content/analyze-audience';
import { audienceAnalysisService, AudienceAnalysisService } from '../src/services/audience-analysis';
import {
  AudienceAnalysisResult,
  Demographics,
  BehaviorPatterns,
  AudienceProfile,
  ContentIdea,
  Platform,
  ContentType,
} from '../src/types';

// Create mock functions
const mockExtractTokenFromEvent = jest.fn();
const mockVerifyJWT = jest.fn();
const mockGetCurrentTimestamp = jest.fn();
const mockGenerateProfileId = jest.fn();
const mockCreateSuccessResponse = jest.fn();
const mockCreateErrorResponse = jest.fn();
const mockGetContentIdea = jest.fn();
const mockUpdateContentIdea = jest.fn();
const mockGetUserAudienceProfiles = jest.fn();
const mockUpdateAudienceProfile = jest.fn();

// Mock modules
jest.mock('../src/utils', () => ({
  extractTokenFromEvent: mockExtractTokenFromEvent,
  verifyJWT: mockVerifyJWT,
  getCurrentTimestamp: mockGetCurrentTimestamp,
  generateProfileId: mockGenerateProfileId,
  createSuccessResponse: mockCreateSuccessResponse,
  createErrorResponse: mockCreateErrorResponse,
  logInfo: jest.fn(),
  logError: jest.fn(),
  handleLambdaError: jest.fn(),
}));

jest.mock('../src/services/database', () => ({
  contentIdeaService: {
    getContentIdea: mockGetContentIdea,
    updateContentIdea: mockUpdateContentIdea,
  },
  audienceProfileService: {
    getUserAudienceProfiles: mockGetUserAudienceProfiles,
    updateAudienceProfile: mockUpdateAudienceProfile,
  },
  getCurrentTimestamp: mockGetCurrentTimestamp,
}));

// Mock Comprehend responses
const mockComprehendResponses = {
  detectKeyPhrases: {
    KeyPhrases: [
      { Text: 'young professionals', Score: 0.95 },
      { Text: 'career development', Score: 0.88 },
      { Text: 'social media marketing', Score: 0.82 },
      { Text: 'technology trends', Score: 0.76 },
    ],
  },
  detectEntities: {
    Entities: [
      { Text: 'LinkedIn', Type: 'ORGANIZATION', Score: 0.92 },
      { Text: 'San Francisco', Type: 'LOCATION', Score: 0.89 },
      { Text: 'millennials', Type: 'OTHER', Score: 0.85 },
    ],
  },
  detectSentiment: {
    Sentiment: 'POSITIVE',
    SentimentScore: {
      Positive: 0.85,
      Negative: 0.05,
      Neutral: 0.08,
      Mixed: 0.02,
    },
  },
  detectDominantLanguage: {
    Languages: [{ LanguageCode: 'en', Score: 0.99 }],
  },
};

describe('Audience Analysis Service', () => {
  let service: AudienceAnalysisService;
  let mockComprehendClient: any;

  beforeEach(() => {
    service = new AudienceAnalysisService();
    mockComprehendClient = {
      send: jest.fn(),
    };
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('analyzeAudience', () => {
    it('should analyze audience demographics and behavior patterns', async () => {
      // Setup mocks
      mockComprehendClient.send
        .mockResolvedValueOnce(mockComprehendResponses.detectDominantLanguage)
        .mockResolvedValueOnce(mockComprehendResponses.detectKeyPhrases)
        .mockResolvedValueOnce(mockComprehendResponses.detectEntities)
        .mockResolvedValueOnce(mockComprehendResponses.detectSentiment);

      const testText = 'Looking to connect with young professionals interested in career development and social media marketing in the tech industry';

      const result = await service.analyzeAudience(testText, 'user123');

      expect(result).toBeDefined();
      expect(result.demographics).toBeDefined();
      expect(result.behaviorPatterns).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
      expect(result.insights).toBeInstanceOf(Array);
      expect(result.recommendedPlatforms).toBeInstanceOf(Array);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle empty text input', async () => {
      await expect(service.analyzeAudience('')).rejects.toThrow('Text content is required for audience analysis');
    });

    it('should provide confidence scores within valid range', async () => {
      mockComprehendClient.send
        .mockResolvedValueOnce(mockComprehendResponses.detectDominantLanguage)
        .mockResolvedValueOnce(mockComprehendResponses.detectKeyPhrases)
        .mockResolvedValueOnce(mockComprehendResponses.detectEntities)
        .mockResolvedValueOnce(mockComprehendResponses.detectSentiment);

      const testText = 'Sample content for audience analysis';
      const result = await service.analyzeAudience(testText);

      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
    });
  });
});

describe('Audience Analysis Lambda Handler', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    httpMethod: 'POST',
    path: '/content/analyze-audience',
    headers: {
      'Authorization': 'Bearer valid-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: 'Sample content for audience analysis testing',
      options: {
        minConfidence: 0.6,
        maxInsights: 5,
      },
    }),
    requestContext: {
      requestId: 'test-request-id',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
    } as any,
  };

  beforeEach(() => {
    // Mock utility functions
    mockExtractTokenFromEvent.mockReturnValue('valid-token');
    mockVerifyJWT.mockReturnValue({ userId: 'user123' });
    mockGetCurrentTimestamp.mockReturnValue('2024-01-01T00:00:00Z');
    mockGenerateProfileId.mockReturnValue('profile123');
    mockCreateSuccessResponse.mockImplementation((data, statusCode = 200) => ({
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data }),
    }));
    mockCreateErrorResponse.mockImplementation((message, statusCode = 400) => ({
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: { message } }),
    }));

    // Mock audience analysis service
    jest.spyOn(audienceAnalysisService, 'analyzeAudience').mockResolvedValue({
      demographics: {
        ageRange: '25-34',
        location: 'United States',
        interests: ['Technology', 'Business'],
      },
      behaviorPatterns: {
        preferredContentTypes: ['blog-post'],
        engagementTimes: ['morning'],
        platformUsage: {} as any,
      },
      confidenceScore: 0.8,
      processingTime: 1500,
      insights: ['Target audience is primarily 25-34 years old'],
      recommendedPlatforms: ['linkedin', 'twitter'],
      targetAgeRange: '25-34',
      primaryInterests: ['Technology', 'Business'],
    });

    jest.spyOn(audienceAnalysisService, 'createOrUpdateAudienceProfile').mockResolvedValue({
      profileId: 'profile123',
      userId: 'user123',
      demographics: {
        ageRange: '25-34',
        location: 'United States',
        interests: ['Technology', 'Business'],
      },
      behaviorPatterns: {
        preferredContentTypes: ['blog-post'],
        engagementTimes: ['morning'],
        platformUsage: {} as any,
      },
      updatedAt: '2024-01-01T00:00:00Z',
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /content/analyze-audience', () => {
    it('should analyze audience for provided text', async () => {
      const response = await handler(mockEvent as APIGatewayProxyEvent);

      expect(response.statusCode).toBe(200);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.analysis).toBeDefined();
      expect(responseBody.data.analysis.demographics).toBeDefined();
      expect(responseBody.data.analysis.behaviorPatterns).toBeDefined();
      expect(responseBody.data.analysis.confidenceScore).toBe(0.8);
      expect(responseBody.data.profileUpdated).toBe(true);
    });

    it('should return 400 for missing text and ideaId', async () => {
      const eventWithoutContent = {
        ...mockEvent,
        body: JSON.stringify({ options: { minConfidence: 0.6 } }),
      };

      const response = await handler(eventWithoutContent as APIGatewayProxyEvent);

      expect(response.statusCode).toBe(400);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Either text or ideaId must be provided');
    });

    it('should return 401 for missing authorization token', async () => {
      mockExtractTokenFromEvent.mockReturnValue(null);

      const response = await handler(mockEvent as APIGatewayProxyEvent);

      expect(response.statusCode).toBe(401);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Authorization token required');
    });
  });
});