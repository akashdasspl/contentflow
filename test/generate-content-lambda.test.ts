// Tests for content generation Lambda function

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../src/lambda/content/generate-content';
import { ContentGenerationRequest } from '../src/types';

// Mock the platform-specific generators
jest.mock('../src/services/content-generators', () => ({
  generatePlatformContent: jest.fn(),
  generateContentWithVariations: jest.fn(),
}));

// Mock utils
jest.mock('../src/utils', () => ({
  createSuccessResponse: jest.fn((data) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, data }),
  })),
  createErrorResponse: jest.fn((error, statusCode = 400) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: false, error }),
  })),
  handleLambdaError: jest.fn((error) => ({
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: false, error: 'Internal server error' }),
  })),
  validateRequired: jest.fn(() => []),
  validateContentType: jest.fn(() => true),
  validateContentIntent: jest.fn(() => true),
  validatePlatform: jest.fn(() => true),
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

describe('Generate Content Lambda', () => {
  const mockGeneratePlatformContent = require('../src/services/content-generators').generatePlatformContent;
  const mockGenerateContentWithVariations = require('../src/services/content-generators').generateContentWithVariations;
  const mockUtils = require('../src/utils');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockEvent = (body: any): APIGatewayProxyEvent => ({
    httpMethod: 'POST',
    path: '/content/generate',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    headers: {
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    body: JSON.stringify(body),
    isBase64Encoded: false,
    stageVariables: null,
    resource: '/content/generate',
    requestContext: {
      requestId: 'test-request-id',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
    } as any,
  });

  it('should generate content successfully', async () => {
    const requestBody: ContentGenerationRequest = {
      userId: 'user_123',
      contentIdea: 'How to improve productivity at work',
      targetPlatforms: ['twitter', 'linkedin'],
      contentTypes: ['social-post'],
    };

    mockGeneratePlatformContent.mockResolvedValue({
      contentId: 'content_123',
      ideaId: 'idea_123',
      userId: 'user_123',
      platform: 'twitter',
      contentType: 'social-post',
      generatedText: 'Great tips for improving productivity! #productivity #work',
      metadata: {
        wordCount: 8,
        characterCount: 58,
        hashtags: ['productivity', 'work'],
        seoKeywords: ['productivity', 'work', 'tips'],
        readingTime: 1,
      },
      version: 1,
      status: 'generated',
      createdAt: '2024-01-01T00:00:00Z',
    });

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockGeneratePlatformContent).toHaveBeenCalledTimes(2); // 2 platforms
    expect(mockUtils.createSuccessResponse).toHaveBeenCalled();
  });

  it('should handle missing request body', async () => {
    const event = createMockEvent(null);
    event.body = null;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(mockUtils.createErrorResponse).toHaveBeenCalledWith('Request body is required', 400);
  });

  it('should handle invalid JSON', async () => {
    const event = createMockEvent({});
    event.body = 'invalid json';

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(mockUtils.createErrorResponse).toHaveBeenCalledWith('Invalid JSON in request body', 400);
  });

  it('should handle validation errors', async () => {
    mockUtils.validateRequired.mockReturnValue([
      {
        code: 'VALIDATION_ERROR',
        message: 'Field userId is required',
        field: 'userId',
        value: undefined,
        constraint: 'required',
        timestamp: expect.any(String),
      },
    ]);

    const requestBody = {
      contentIdea: 'Test idea',
      targetPlatforms: ['twitter'],
      contentTypes: ['social-post'],
    };

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(mockUtils.createErrorResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      }),
      400
    );
  });

  it('should handle invalid content types', async () => {
    mockUtils.validateRequired.mockReturnValue([]); // No validation errors
    mockUtils.validateContentType.mockReturnValue(false);

    const requestBody: ContentGenerationRequest = {
      userId: 'user_123',
      contentIdea: 'Test idea',
      targetPlatforms: ['twitter'],
      contentTypes: ['invalid-type' as any],
    };

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(mockUtils.createErrorResponse).toHaveBeenCalledWith('Invalid content type: invalid-type', 400);
  });

  it('should handle invalid platforms', async () => {
    mockUtils.validateRequired.mockReturnValue([]); // No validation errors
    mockUtils.validateContentType.mockReturnValue(true);
    mockUtils.validatePlatform.mockReturnValue(false);

    const requestBody: ContentGenerationRequest = {
      userId: 'user_123',
      contentIdea: 'Test idea',
      targetPlatforms: ['invalid-platform' as any],
      contentTypes: ['social-post'],
    };

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(mockUtils.createErrorResponse).toHaveBeenCalledWith('Invalid platform: invalid-platform', 400);
  });

  it('should handle content idea length validation', async () => {
    mockUtils.validateRequired.mockReturnValue([]); // No validation errors
    mockUtils.validateContentType.mockReturnValue(true);
    mockUtils.validatePlatform.mockReturnValue(true);

    const requestBody: ContentGenerationRequest = {
      userId: 'user_123',
      contentIdea: 'a'.repeat(501), // Too long
      targetPlatforms: ['twitter'],
      contentTypes: ['social-post'],
    };

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(mockUtils.createErrorResponse).toHaveBeenCalledWith(
      'Content idea must be between 1 and 500 characters',
      400
    );
  });

  it('should handle content generation errors gracefully', async () => {
    mockUtils.validateRequired.mockReturnValue([]); // No validation errors
    mockUtils.validateContentType.mockReturnValue(true);
    mockUtils.validatePlatform.mockReturnValue(true);

    const requestBody: ContentGenerationRequest = {
      userId: 'user_123',
      contentIdea: 'Test idea',
      targetPlatforms: ['twitter'],
      contentTypes: ['social-post'],
    };

    mockGeneratePlatformContent.mockRejectedValue(new Error('Social media post generation failed: Bedrock service error'));

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(200); // Should still return success with partial results
    const responseBody = JSON.parse(result.body);
    expect(responseBody.data.status).toBe('failed');
    expect(responseBody.data.errors).toContain('Failed to generate social-post for twitter: Social media post generation failed: Bedrock service error');
  });

  it('should handle partial success', async () => {
    mockUtils.validateRequired.mockReturnValue([]); // No validation errors
    mockUtils.validateContentType.mockReturnValue(true);
    mockUtils.validatePlatform.mockReturnValue(true);

    const requestBody: ContentGenerationRequest = {
      userId: 'user_123',
      contentIdea: 'Test idea',
      targetPlatforms: ['twitter', 'linkedin'],
      contentTypes: ['social-post'],
    };

    // Mock first call to succeed, second to fail
    mockGeneratePlatformContent
      .mockResolvedValueOnce({
        contentId: 'content_123',
        ideaId: 'idea_123',
        userId: 'user_123',
        platform: 'twitter',
        contentType: 'social-post',
        generatedText: 'Success content',
        metadata: {
          wordCount: 2,
          characterCount: 15,
          hashtags: [],
          seoKeywords: ['success'],
          readingTime: 1,
        },
        version: 1,
        status: 'generated',
        createdAt: '2024-01-01T00:00:00Z',
      })
      .mockRejectedValueOnce(new Error('LinkedIn generation failed'));

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.data.status).toBe('partial');
    expect(responseBody.data.generatedContent).toHaveLength(1);
    expect(responseBody.data.errors).toHaveLength(1);
  });

  it('should extract hashtags and keywords correctly', async () => {
    mockUtils.validateRequired.mockReturnValue([]); // No validation errors
    mockUtils.validateContentType.mockReturnValue(true);
    mockUtils.validatePlatform.mockReturnValue(true);

    const requestBody: ContentGenerationRequest = {
      userId: 'user_123',
      contentIdea: 'Social media tips',
      targetPlatforms: ['twitter'],
      contentTypes: ['social-post'],
    };

    mockGeneratePlatformContent.mockResolvedValue({
      contentId: 'content_123',
      ideaId: 'idea_123',
      userId: 'user_123',
      platform: 'twitter',
      contentType: 'social-post',
      generatedText: 'Great social media tips for better engagement! #socialmedia #marketing #tips',
      metadata: {
        wordCount: 10,
        characterCount: 78,
        hashtags: ['socialmedia', 'marketing', 'tips'],
        seoKeywords: ['social', 'media', 'tips', 'engagement'],
        readingTime: 1,
      },
      version: 1,
      status: 'generated',
      createdAt: '2024-01-01T00:00:00Z',
    });

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    const generatedContent = responseBody.data.generatedContent[0];
    
    expect(generatedContent.metadata.hashtags).toEqual(['socialmedia', 'marketing', 'tips']);
    expect(generatedContent.metadata.seoKeywords).toContain('social');
    expect(generatedContent.metadata.seoKeywords).toContain('media');
    expect(generatedContent.metadata.readingTime).toBe(1);
  });

  it('should handle unexpected errors during validation', async () => {
    // Mock validateRequired to throw an error
    mockUtils.validateRequired.mockImplementation(() => {
      throw new Error('Validation system error');
    });

    const requestBody: ContentGenerationRequest = {
      userId: 'user_123',
      contentIdea: 'Test idea',
      targetPlatforms: ['twitter'],
      contentTypes: ['social-post'],
    };

    const event = createMockEvent(requestBody);
    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(mockUtils.handleLambdaError).toHaveBeenCalled();
  });

  it('should generate content with variations when requested', async () => {
    mockUtils.validateRequired.mockReturnValue([]); // No validation errors
    mockUtils.validateContentType.mockReturnValue(true);
    mockUtils.validatePlatform.mockReturnValue(true);

    const mockVariationResult = {
      primaryContent: {
        contentId: 'primary_123',
        ideaId: 'idea_123',
        userId: 'user_123',
        platform: 'twitter',
        contentType: 'social-post',
        generatedText: 'Primary social media post about productivity',
        metadata: {
          wordCount: 8,
          characterCount: 45,
          hashtags: ['productivity'],
          seoKeywords: ['productivity', 'tips'],
          readingTime: 1,
        },
        version: 1,
        status: 'generated',
        createdAt: '2024-01-01T00:00:00Z',
      },
      variations: [
        {
          variationId: 'var_1',
          contentId: 'primary_123',
          generatedText: 'Boost your productivity with these amazing tips! 🚀',
          metadata: {
            wordCount: 9,
            characterCount: 50,
            hashtags: ['productivity', 'tips'],
            seoKeywords: ['productivity', 'boost'],
            readingTime: 1,
          },
          rankingScore: 0.85,
          variationType: 'tone-variation',
          customizationApplied: {
            tone: 'friendly',
            includeEmojis: true,
          },
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
      rankingMetadata: {
        totalVariations: 1,
        averageScore: 0.85,
        topScore: 0.85,
        lowestScore: 0.85,
      },
    };

    // Mock the generateContentWithVariations function
    mockGenerateContentWithVariations.mockResolvedValue(mockVariationResult);

    const requestBody: ContentGenerationRequest = {
      userId: 'user_123',
      contentIdea: 'Tips for productivity',
      targetPlatforms: ['twitter'],
      contentTypes: ['social-post'],
      variationCount: 3,
      customizationOptions: {
        tone: 'professional',
        includeEmojis: true,
        includeHashtags: true,
      },
    };

    const event = createMockEvent(requestBody);
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    
    expect(responseBody.data).toMatchObject({
      requestId: 'test-request-id',
      generatedContent: [mockVariationResult.primaryContent],
      variations: mockVariationResult.variations,
      processingTime: expect.any(Number),
      status: 'success',
    });

    expect(responseBody.data.variations).toHaveLength(1);
    expect(responseBody.data.variations[0]).toMatchObject({
      variationId: 'var_1',
      variationType: 'tone-variation',
      rankingScore: 0.85,
      customizationApplied: {
        tone: 'friendly',
        includeEmojis: true,
      },
    });

    expect(mockGenerateContentWithVariations).toHaveBeenCalledWith(
      'social-post',
      expect.objectContaining({
        contentIdea: 'Tips for productivity',
        userId: 'user_123',
        platform: 'twitter',
        variationCount: 3,
        customizationOptions: {
          tone: 'professional',
          includeEmojis: true,
          includeHashtags: true,
        },
      })
    );
  });

  it('should generate single content when no variations requested', async () => {
    mockUtils.validateRequired.mockReturnValue([]); // No validation errors
    mockUtils.validateContentType.mockReturnValue(true);
    mockUtils.validatePlatform.mockReturnValue(true);

    const requestBody: ContentGenerationRequest = {
      userId: 'user_123',
      contentIdea: 'Simple content idea',
      targetPlatforms: ['twitter'],
      contentTypes: ['social-post'],
      // No variationCount specified, should default to single content
    };

    mockGeneratePlatformContent.mockResolvedValue({
      contentId: 'content_123',
      ideaId: 'idea_123',
      userId: 'user_123',
      platform: 'twitter',
      contentType: 'social-post',
      generatedText: 'Simple social media post',
      metadata: {
        wordCount: 4,
        characterCount: 25,
        hashtags: [],
        seoKeywords: ['simple'],
        readingTime: 1,
      },
      version: 1,
      status: 'generated',
      createdAt: '2024-01-01T00:00:00Z',
    });

    const event = createMockEvent(requestBody);
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    
    expect(responseBody.data.generatedContent).toHaveLength(1);
    expect(responseBody.data.variations).toBeUndefined();
    expect(mockGeneratePlatformContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateContentWithVariations).not.toHaveBeenCalled();
  });
});