// Tests for platform optimization Lambda functions

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler as optimizeContentHandler } from '../src/lambda/platform/optimize-content';
import { handler as getTemplatesHandler } from '../src/lambda/platform/get-templates';
import { handler as getGuidelinesHandler } from '../src/lambda/platform/get-guidelines';
import { generateJWT, generateContentId, generateIdeaId, getCurrentTimestamp } from '../src/utils';
import { GeneratedContent } from '../src/types';

// Mock the services
jest.mock('../src/services/platform-optimization');
jest.mock('../src/services/database');

const mockPlatformOptimizationService = {
  optimizeForPlatform: jest.fn(),
  getPlatformTemplates: jest.fn(),
  getPlatformTemplate: jest.fn(),
  getPlatformGuidelines: jest.fn(),
};

const mockGeneratedContentService = {
  getGeneratedContent: jest.fn(),
  updateGeneratedContent: jest.fn(),
};

const mockUserService = {
  getUserById: jest.fn(),
};

const mockAudienceProfileService = {
  getUserAudienceProfiles: jest.fn(),
};

// Mock the imported services
require('../src/services/platform-optimization').platformOptimizationService = mockPlatformOptimizationService;
require('../src/services/database').generatedContentService = mockGeneratedContentService;
require('../src/services/database').userService = mockUserService;
require('../src/services/database').audienceProfileService = mockAudienceProfileService;

describe('Platform Optimization Lambda Functions', () => {
  const mockUserId = 'test-user-123';
  const mockToken = generateJWT({ userId: mockUserId });
  
  const mockContent: GeneratedContent = {
    contentId: generateContentId(),
    ideaId: generateIdeaId(),
    userId: mockUserId,
    platform: 'blog',
    contentType: 'blog-post',
    generatedText: 'Test blog content for optimization',
    metadata: {
      wordCount: 6,
      hashtags: [],
      seoKeywords: ['test'],
      readingTime: 1,
    },
    version: 1,
    status: 'generated',
    createdAt: getCurrentTimestamp(),
  };

  const createMockEvent = (
    httpMethod: string,
    path: string,
    body?: any,
    pathParameters?: Record<string, string>,
    queryStringParameters?: Record<string, string>
  ): APIGatewayProxyEvent => ({
    httpMethod,
    path,
    pathParameters: pathParameters || null,
    queryStringParameters: queryStringParameters || null,
    headers: {
      'Authorization': `Bearer ${mockToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
    multiValueHeaders: {},
    isBase64Encoded: false,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: path,
    requestContext: {
      requestId: 'test-request-id',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestTimeEpoch: Date.now(),
    } as any,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Optimize Content Handler', () => {
    it('should optimize content successfully', async () => {
      const optimizedContent = {
        ...mockContent,
        metadata: {
          ...mockContent.metadata,
          platformOptimized: true,
          seoScore: 0.8,
        },
      };

      mockGeneratedContentService.getGeneratedContent.mockResolvedValue(mockContent);
      mockUserService.getUserById.mockResolvedValue({
        userId: mockUserId,
        preferences: { brandVoice: 'professional' },
      });
      mockAudienceProfileService.getUserAudienceProfiles.mockResolvedValue([]);
      mockPlatformOptimizationService.optimizeForPlatform.mockResolvedValue(optimizedContent);
      mockGeneratedContentService.updateGeneratedContent.mockResolvedValue(true);

      const event = createMockEvent('POST', '/platform/optimize', {
        contentId: mockContent.contentId,
        targetPlatform: 'blog',
        seoKeywords: ['test', 'optimization'],
      });

      const result = await optimizeContentHandler(event);

      expect(result.statusCode).toBe(200);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.contentId).toBe(mockContent.contentId);
      expect(responseBody.data.optimizationApplied).toBe(true);
      
      expect(mockGeneratedContentService.getGeneratedContent).toHaveBeenCalledWith(mockContent.contentId);
      expect(mockPlatformOptimizationService.optimizeForPlatform).toHaveBeenCalled();
      expect(mockGeneratedContentService.updateGeneratedContent).toHaveBeenCalled();
    });

    it('should return 401 for missing authorization token', async () => {
      const event = createMockEvent('POST', '/platform/optimize', {
        contentId: mockContent.contentId,
      });
      event.headers = {}; // Remove authorization header

      const result = await optimizeContentHandler(event);

      expect(result.statusCode).toBe(401);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Authorization token required');
    });

    it('should return 400 for missing contentId', async () => {
      const event = createMockEvent('POST', '/platform/optimize', {
        targetPlatform: 'blog',
      });

      const result = await optimizeContentHandler(event);

      expect(result.statusCode).toBe(400);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Validation failed');
    });

    it('should return 404 for non-existent content', async () => {
      mockGeneratedContentService.getGeneratedContent.mockResolvedValue(null);

      const event = createMockEvent('POST', '/platform/optimize', {
        contentId: 'non-existent-id',
      });

      const result = await optimizeContentHandler(event);

      expect(result.statusCode).toBe(404);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Content not found');
    });

    it('should return 403 for content owned by different user', async () => {
      const otherUserContent = {
        ...mockContent,
        userId: 'other-user-456',
      };

      mockGeneratedContentService.getGeneratedContent.mockResolvedValue(otherUserContent);

      const event = createMockEvent('POST', '/platform/optimize', {
        contentId: mockContent.contentId,
      });

      const result = await optimizeContentHandler(event);

      expect(result.statusCode).toBe(403);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Access denied');
    });

    it('should return 405 for non-POST methods', async () => {
      const event = createMockEvent('GET', '/platform/optimize');

      const result = await optimizeContentHandler(event);

      expect(result.statusCode).toBe(405);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Method not allowed');
    });

    it('should validate platform parameter', async () => {
      const event = createMockEvent('POST', '/platform/optimize', {
        contentId: mockContent.contentId,
        targetPlatform: 'invalid-platform',
      });

      const result = await optimizeContentHandler(event);

      expect(result.statusCode).toBe(400);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Invalid target platform');
    });
  });

  describe('Get Templates Handler', () => {
    const mockTemplates = [
      {
        templateId: 'blog-default',
        platform: 'blog',
        contentType: 'blog-post',
        name: 'Default Blog Post',
        description: 'Standard blog post template',
        structure: { sections: [] },
        constraints: { maxLength: 2000 },
        bestPractices: ['Use SEO-optimized titles'],
        examples: ['How to Guide'],
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
      },
    ];

    it('should get all templates successfully', async () => {
      mockPlatformOptimizationService.getPlatformTemplates.mockResolvedValue(mockTemplates);

      const event = createMockEvent('GET', '/platform/templates');

      const result = await getTemplatesHandler(event);

      expect(result.statusCode).toBe(200);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.templatesByPlatform).toBeDefined();
    });

    it('should get templates for specific platform', async () => {
      mockPlatformOptimizationService.getPlatformTemplates.mockResolvedValue(mockTemplates);

      const event = createMockEvent('GET', '/platform/templates', undefined, undefined, {
        platform: 'blog',
      });

      const result = await getTemplatesHandler(event);

      expect(result.statusCode).toBe(200);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.platform).toBe('blog');
      expect(responseBody.data.templates).toEqual(mockTemplates);
      
      expect(mockPlatformOptimizationService.getPlatformTemplates).toHaveBeenCalledWith('blog');
    });

    it('should get specific template by ID', async () => {
      mockPlatformOptimizationService.getPlatformTemplate.mockResolvedValue(mockTemplates[0]);

      const event = createMockEvent('GET', '/platform/templates', undefined, undefined, {
        templateId: 'blog-default',
      });

      const result = await getTemplatesHandler(event);

      expect(result.statusCode).toBe(200);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.template).toEqual(mockTemplates[0]);
      
      expect(mockPlatformOptimizationService.getPlatformTemplate).toHaveBeenCalledWith('blog-default');
    });

    it('should return 404 for non-existent template', async () => {
      mockPlatformOptimizationService.getPlatformTemplate.mockResolvedValue(null);

      const event = createMockEvent('GET', '/platform/templates', undefined, undefined, {
        templateId: 'non-existent',
      });

      const result = await getTemplatesHandler(event);

      expect(result.statusCode).toBe(404);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Template not found');
    });

    it('should return 400 for invalid platform', async () => {
      const event = createMockEvent('GET', '/platform/templates', undefined, undefined, {
        platform: 'invalid-platform',
      });

      const result = await getTemplatesHandler(event);

      expect(result.statusCode).toBe(400);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Invalid platform');
    });

    it('should return 401 for missing authorization token', async () => {
      const event = createMockEvent('GET', '/platform/templates');
      event.headers = {}; // Remove authorization header

      const result = await getTemplatesHandler(event);

      expect(result.statusCode).toBe(401);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Authorization token required');
    });

    it('should return 405 for non-GET methods', async () => {
      const event = createMockEvent('POST', '/platform/templates');

      const result = await getTemplatesHandler(event);

      expect(result.statusCode).toBe(405);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Method not allowed');
    });
  });

  describe('Get Guidelines Handler', () => {
    const mockGuidelines = {
      constraints: {
        maxLength: 280,
        maxHashtags: 2,
        allowedFormats: ['text'],
        restrictedContent: ['spam'],
        requiredElements: ['text'],
      },
      bestPractices: [
        'Keep tweets concise and engaging',
        'Use hashtags sparingly (max 2)',
      ],
      examples: [
        'Just learned something amazing! Thread below 🧵',
        'Quick tip: Always backup your work 💾',
      ],
    };

    it('should get platform guidelines successfully', async () => {
      mockPlatformOptimizationService.getPlatformGuidelines.mockResolvedValue(mockGuidelines);

      const event = createMockEvent('GET', '/platform/guidelines/twitter', null, {
        platform: 'twitter',
      });

      const result = await getGuidelinesHandler(event);

      expect(result.statusCode).toBe(200);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.platform).toBe('twitter');
      expect(responseBody.data.guidelines.constraints).toEqual(mockGuidelines.constraints);
      expect(responseBody.data.guidelines.bestPractices).toEqual(mockGuidelines.bestPractices);
      expect(responseBody.data.guidelines.platformInfo).toBeDefined();
      
      expect(mockPlatformOptimizationService.getPlatformGuidelines).toHaveBeenCalledWith('twitter');
    });

    it('should return 400 for missing platform parameter', async () => {
      const event = createMockEvent('GET', '/platform/guidelines/', null, {});

      const result = await getGuidelinesHandler(event);

      expect(result.statusCode).toBe(400);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Platform parameter is required');
    });

    it('should return 400 for invalid platform', async () => {
      const event = createMockEvent('GET', '/platform/guidelines/invalid', null, {
        platform: 'invalid-platform',
      });

      const result = await getGuidelinesHandler(event);

      expect(result.statusCode).toBe(400);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Invalid platform');
    });

    it('should return 401 for missing authorization token', async () => {
      const event = createMockEvent('GET', '/platform/guidelines/twitter', null, {
        platform: 'twitter',
      });
      event.headers = {}; // Remove authorization header

      const result = await getGuidelinesHandler(event);

      expect(result.statusCode).toBe(401);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Authorization token required');
    });

    it('should return 405 for non-GET methods', async () => {
      const event = createMockEvent('POST', '/platform/guidelines/twitter', null, {
        platform: 'twitter',
      });

      const result = await getGuidelinesHandler(event);

      expect(result.statusCode).toBe(405);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Method not allowed');
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully in optimize content', async () => {
      mockGeneratedContentService.getGeneratedContent.mockRejectedValue(new Error('Database error'));

      const event = createMockEvent('POST', '/platform/optimize', {
        contentId: mockContent.contentId,
      });

      const result = await optimizeContentHandler(event);

      expect(result.statusCode).toBe(500);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
    });

    it('should handle service errors gracefully in get templates', async () => {
      mockPlatformOptimizationService.getPlatformTemplates.mockRejectedValue(new Error('Service error'));

      const event = createMockEvent('GET', '/platform/templates', undefined, undefined, {
        platform: 'blog',
      });

      const result = await getTemplatesHandler(event);

      expect(result.statusCode).toBe(500);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
    });

    it('should handle service errors gracefully in get guidelines', async () => {
      mockPlatformOptimizationService.getPlatformGuidelines.mockRejectedValue(new Error('Service error'));

      const event = createMockEvent('GET', '/platform/guidelines/twitter', null, {
        platform: 'twitter',
      });

      const result = await getGuidelinesHandler(event);

      expect(result.statusCode).toBe(500);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
    });
  });
});