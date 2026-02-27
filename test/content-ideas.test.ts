// Unit tests for content idea functionality
// Tests Requirements: 1.1, 1.4

// Set up environment variables before importing modules
process.env.USERS_TABLE_NAME = 'test-users-table';
process.env.CONTENT_IDEAS_TABLE_NAME = 'test-content-ideas-table';
process.env.GENERATED_CONTENT_TABLE_NAME = 'test-generated-content-table';
process.env.ENGAGEMENT_FEEDBACK_TABLE_NAME = 'test-engagement-feedback-table';
process.env.AUDIENCE_PROFILES_TABLE_NAME = 'test-audience-profiles-table';
process.env.CONTENT_STORAGE_BUCKET_NAME = 'test-content-storage-bucket';
process.env.ANALYTICS_BUCKET_NAME = 'test-analytics-bucket';
process.env.JWT_SECRET = 'test-jwt-secret';

import { handler as submitIdeaHandler } from '../src/lambda/content/submit-idea';
import { handler as getIdeasHandler } from '../src/lambda/content/get-ideas';
import { handler as getIdeaHandler } from '../src/lambda/content/get-idea';
import { handler as updateIdeaHandler } from '../src/lambda/content/update-idea';
import { handler as deleteIdeaHandler } from '../src/lambda/content/delete-idea';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { contentIdeaService } from '../src/services/database';
import * as utils from '../src/utils';

// Mock dependencies
jest.mock('../src/services/database');
jest.mock('../src/utils', () => ({
  ...jest.requireActual('../src/utils'),
  verifyJWT: jest.fn(),
  generateIdeaId: jest.fn(),
  getCurrentTimestamp: jest.fn(),
}));

const mockContentIdeaService = contentIdeaService as jest.Mocked<typeof contentIdeaService>;
const mockVerifyJWT = utils.verifyJWT as jest.MockedFunction<typeof utils.verifyJWT>;
const mockGenerateIdeaId = utils.generateIdeaId as jest.MockedFunction<typeof utils.generateIdeaId>;
const mockGetCurrentTimestamp = utils.getCurrentTimestamp as jest.MockedFunction<typeof utils.getCurrentTimestamp>;

describe('Content Ideas Lambda Functions', () => {
  const mockUserId = 'user_123';
  const mockIdeaId = 'idea_456';
  const mockTimestamp = '2024-01-01T00:00:00.000Z';

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyJWT.mockReturnValue({ userId: mockUserId });
    mockGenerateIdeaId.mockReturnValue(mockIdeaId);
    mockGetCurrentTimestamp.mockReturnValue(mockTimestamp);
  });

  const createMockContentIdea = (overrides: Partial<any> = {}): any => ({
    ideaId: mockIdeaId,
    userId: mockUserId,
    content: 'Test idea content',
    extractedThemes: ['theme1'],
    targetAudience: {
      profileId: 'profile_1',
      userId: mockUserId,
      demographics: { ageRange: '25-35', location: 'US', interests: ['tech'] },
      behaviorPatterns: {
        preferredContentTypes: ['blog-post'],
        engagementTimes: ['morning'],
        platformUsage: {
          blog: { frequency: 'daily', engagementRate: 0.5, preferredContentLength: 'long', bestPostingTimes: ['9am'] },
          twitter: { frequency: 'hourly', engagementRate: 0.3, preferredContentLength: 'short', bestPostingTimes: ['12pm'] },
          facebook: { frequency: 'daily', engagementRate: 0.4, preferredContentLength: 'medium', bestPostingTimes: ['6pm'] },
          instagram: { frequency: 'daily', engagementRate: 0.6, preferredContentLength: 'short', bestPostingTimes: ['8pm'] },
          linkedin: { frequency: 'weekly', engagementRate: 0.7, preferredContentLength: 'long', bestPostingTimes: ['10am'] },
          youtube: { frequency: 'weekly', engagementRate: 0.8, preferredContentLength: 'long', bestPostingTimes: ['7pm'] },
          tiktok: { frequency: 'daily', engagementRate: 0.5, preferredContentLength: 'short', bestPostingTimes: ['9pm'] },
        },
      },
      updatedAt: mockTimestamp,
    },
    intent: 'informational' as const,
    confidenceScore: 0.8,
    createdAt: mockTimestamp,
    ...overrides,
  });

  const createMockEvent = (
    httpMethod: string,
    body?: any,
    pathParameters?: any,
    queryStringParameters?: any
  ): APIGatewayProxyEvent => ({
    httpMethod,
    path: '/content/ideas',
    pathParameters,
    queryStringParameters,
    headers: {
      Authorization: 'Bearer valid-token',
    },
    multiValueHeaders: {},
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '/content/ideas',
    requestContext: {
      requestId: 'test-request-id',
      accountId: '123456789012',
      apiId: 'test-api-id',
      stage: 'test',
      protocol: 'HTTP/1.1',
      httpMethod,
      path: '/content/ideas',
      resourceId: 'test-resource-id',
      resourcePath: '/content/ideas',
      authorizer: {},
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        user: null,
        userArn: null,
        clientCert: null,
      },
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: 1704067200000,
    },
  });

  describe('Submit Content Idea', () => {
    it('should successfully submit a valid content idea', async () => {
      const mockEvent = createMockEvent('POST', {
        content: 'This is a test content idea for blog post about AI.',
      });

      mockContentIdeaService.createContentIdea.mockResolvedValue();

      const result = await submitIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body).success).toBe(true);
      expect(JSON.parse(result.body).data.ideaId).toBe(mockIdeaId);
      expect(mockContentIdeaService.createContentIdea).toHaveBeenCalledWith(
        expect.objectContaining({
          ideaId: mockIdeaId,
          userId: mockUserId,
          content: 'This is a test content idea for blog post about AI.',
          createdAt: mockTimestamp,
        })
      );
    });

    it('should reject content exceeding 500 characters', async () => {
      const longContent = 'a'.repeat(501);
      const mockEvent = createMockEvent('POST', {
        content: longContent,
      });

      const result = await submitIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).success).toBe(false);
      expect(JSON.parse(result.body).error.message).toContain('exceeds maximum length of 500 characters');
      expect(mockContentIdeaService.createContentIdea).not.toHaveBeenCalled();
    });

    it('should accept content at exactly 500 characters', async () => {
      const exactContent = 'a'.repeat(500);
      const mockEvent = createMockEvent('POST', {
        content: exactContent,
      });

      mockContentIdeaService.createContentIdea.mockResolvedValue();

      const result = await submitIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body).success).toBe(true);
      expect(mockContentIdeaService.createContentIdea).toHaveBeenCalled();
    });

    it('should reject empty content', async () => {
      const mockEvent = createMockEvent('POST', {
        content: '   ',
      });

      const result = await submitIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).success).toBe(false);
      expect(JSON.parse(result.body).error.message).toContain('Required fields are missing');
      expect(mockContentIdeaService.createContentIdea).not.toHaveBeenCalled();
    });

    it('should reject request without content field', async () => {
      const mockEvent = createMockEvent('POST', {
        title: 'Missing content field',
      });

      const result = await submitIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).success).toBe(false);
      expect(JSON.parse(result.body).error.message).toContain('Required fields are missing');
    });

    it('should reject request without authorization token', async () => {
      const mockEvent = createMockEvent('POST', {
        content: 'Test content',
      });
      mockEvent.headers = {};

      const result = await submitIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).success).toBe(false);
      expect(JSON.parse(result.body).error.message).toContain('Authorization token required');
    });

    it('should reject invalid HTTP method', async () => {
      const mockEvent = createMockEvent('GET', {
        content: 'Test content',
      });

      const result = await submitIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(405);
      expect(JSON.parse(result.body).success).toBe(false);
      expect(JSON.parse(result.body).error.message).toContain('Method not allowed');
    });
  });

  describe('Get Content Ideas', () => {
    it('should successfully retrieve user content ideas', async () => {
      const mockEvent = createMockEvent('GET', null, null, { limit: '10' });
      const mockIdeas = [
        createMockContentIdea({ ideaId: 'idea_1', content: 'First idea' }),
        createMockContentIdea({ ideaId: 'idea_2', content: 'Second idea', intent: 'educational' }),
      ];

      mockContentIdeaService.getUserContentIdeas.mockResolvedValue(mockIdeas);

      const result = await getIdeasHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).success).toBe(true);
      expect(JSON.parse(result.body).data.ideas).toEqual(mockIdeas);
      expect(JSON.parse(result.body).data.count).toBe(2);
      expect(mockContentIdeaService.getUserContentIdeas).toHaveBeenCalledWith(mockUserId, 10);
    });

    it('should use default limit when not specified', async () => {
      const mockEvent = createMockEvent('GET');
      mockContentIdeaService.getUserContentIdeas.mockResolvedValue([]);

      const result = await getIdeasHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockContentIdeaService.getUserContentIdeas).toHaveBeenCalledWith(mockUserId, 20);
    });

    it('should reject invalid limit parameter', async () => {
      const mockEvent = createMockEvent('GET', null, null, { limit: '150' });

      const result = await getIdeasHandler(mockEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).success).toBe(false);
      expect(JSON.parse(result.body).error.message).toContain('Limit must be a number between 1 and 100');
    });
  });

  describe('Get Specific Content Idea', () => {
    it('should successfully retrieve a specific content idea', async () => {
      const mockEvent = createMockEvent('GET', null, { ideaId: mockIdeaId });
      const mockIdea = createMockContentIdea();

      mockContentIdeaService.getContentIdea.mockResolvedValue(mockIdea);

      const result = await getIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).success).toBe(true);
      expect(JSON.parse(result.body).data).toEqual(mockIdea);
      expect(mockContentIdeaService.getContentIdea).toHaveBeenCalledWith(mockIdeaId, mockUserId);
    });

    it('should return 404 when content idea not found', async () => {
      const mockEvent = createMockEvent('GET', null, { ideaId: mockIdeaId });

      mockContentIdeaService.getContentIdea.mockResolvedValue(null);

      const result = await getIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).success).toBe(false);
      expect(JSON.parse(result.body).error.message).toContain('Content idea not found');
    });

    it('should reject request without idea ID', async () => {
      const mockEvent = createMockEvent('GET');

      const result = await getIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).success).toBe(false);
      expect(JSON.parse(result.body).error.message).toContain('Idea ID is required in path');
    });
  });

  describe('Update Content Idea', () => {
    it('should successfully update content idea', async () => {
      const mockEvent = createMockEvent('PUT', {
        content: 'Updated content idea',
      }, { ideaId: mockIdeaId });

      const existingIdea = createMockContentIdea({ content: 'Original content' });
      const updatedIdea = createMockContentIdea({ content: 'Updated content idea' });

      mockContentIdeaService.getContentIdea.mockResolvedValue(existingIdea);
      mockContentIdeaService.updateContentIdea.mockResolvedValue(updatedIdea);

      const result = await updateIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).success).toBe(true);
      expect(JSON.parse(result.body).data.content).toBe('Updated content idea');
      expect(mockContentIdeaService.updateContentIdea).toHaveBeenCalledWith(
        mockIdeaId,
        mockUserId,
        { content: 'Updated content idea' }
      );
    });

    it('should reject update with content exceeding 500 characters', async () => {
      const longContent = 'a'.repeat(501);
      const mockEvent = createMockEvent('PUT', {
        content: longContent,
      }, { ideaId: mockIdeaId });

      const existingIdea = createMockContentIdea({ content: 'Original content' });

      mockContentIdeaService.getContentIdea.mockResolvedValue(existingIdea);

      const result = await updateIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).success).toBe(false);
      expect(JSON.parse(result.body).error.message).toContain('exceeds maximum length of 500 characters');
      expect(mockContentIdeaService.updateContentIdea).not.toHaveBeenCalled();
    });

    it('should return 404 when trying to update non-existent idea', async () => {
      const mockEvent = createMockEvent('PUT', {
        content: 'Updated content',
      }, { ideaId: mockIdeaId });

      mockContentIdeaService.getContentIdea.mockResolvedValue(null);

      const result = await updateIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).success).toBe(false);
      expect(JSON.parse(result.body).error.message).toContain('Content idea not found');
    });
  });

  describe('Delete Content Idea', () => {
    it('should successfully delete content idea', async () => {
      const mockEvent = createMockEvent('DELETE', null, { ideaId: mockIdeaId });

      const existingIdea = createMockContentIdea({ content: 'Content to delete' });

      mockContentIdeaService.getContentIdea.mockResolvedValue(existingIdea);
      mockContentIdeaService.deleteContentIdea.mockResolvedValue();

      const result = await deleteIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).success).toBe(true);
      expect(JSON.parse(result.body).data.ideaId).toBe(mockIdeaId);
      expect(mockContentIdeaService.deleteContentIdea).toHaveBeenCalledWith(mockIdeaId, mockUserId);
    });

    it('should return 404 when trying to delete non-existent idea', async () => {
      const mockEvent = createMockEvent('DELETE', null, { ideaId: mockIdeaId });

      mockContentIdeaService.getContentIdea.mockResolvedValue(null);

      const result = await deleteIdeaHandler(mockEvent);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).success).toBe(false);
      expect(JSON.parse(result.body).error.message).toContain('Content idea not found');
    });
  });
});