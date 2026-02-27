// Tests for Brand Voice Lambda Functions

import { handler as analyzeBrandVoiceHandler } from '../src/lambda/platform/analyze-brand-voice';
import { handler as checkConsistencyHandler } from '../src/lambda/platform/check-consistency';
import { brandVoiceConsistencyEngine } from '../src/services/brand-voice-consistency';
import { DatabaseService } from '../src/services/database';
import { generateJWT } from '../src/utils';
import { APIGatewayEvent, GeneratedContent } from '../src/types';

// Mock dependencies
jest.mock('../src/services/brand-voice-consistency');
jest.mock('../src/services/database');

const mockBrandVoiceEngine = brandVoiceConsistencyEngine as jest.Mocked<typeof brandVoiceConsistencyEngine>;
const mockDatabaseService = new DatabaseService('test-table') as jest.Mocked<DatabaseService>;

describe('Brand Voice Lambda Functions', () => {
  const mockUserId = 'user-123';
  const mockToken = generateJWT({ userId: mockUserId, email: 'test@example.com' });

  const mockContent: GeneratedContent = {
    contentId: 'content-123',
    ideaId: 'idea-123',
    userId: mockUserId,
    platform: 'blog',
    contentType: 'blog-post',
    generatedText: 'This is a professional business guide.',
    metadata: {
      wordCount: 7,
      hashtags: [],
      seoKeywords: ['business', 'guide'],
      readingTime: 1,
    },
    version: 1,
    status: 'generated',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const mockVoiceAnalysisResult = {
    originalContent: 'Original content',
    optimizedContent: 'Optimized content with consistent brand voice',
    voiceAnalysis: {
      voiceId: 'voice-123',
      characteristics: {
        tone: 'professional',
        formality: 'semi-formal' as const,
        personality: ['trustworthy', 'knowledgeable'],
        vocabulary: {
          complexity: 'moderate' as const,
          industryTerms: [],
          avoidedWords: [],
          preferredWords: [],
          jargonLevel: 'minimal' as const,
        },
        sentenceStructure: {
          averageLength: 'medium' as const,
          complexity: 'compound' as const,
          activeVoicePreference: 0.7,
          questionUsage: 'occasional' as const,
        },
        emotionalTone: {
          enthusiasm: 0.6,
          empathy: 0.5,
          authority: 0.8,
          warmth: 0.5,
          urgency: 0.3,
        },
      },
      styleGuide: {
        writingPrinciples: ['Maintain professional tone'],
        dosList: ['Use active voice'],
        dontsList: ['Avoid jargon'],
        examplePhrases: [],
        brandKeywords: [],
        messagingPillars: [],
      },
      consistencyScore: 0.85,
      adaptationRules: [],
      platformSpecificAdjustments: {
        blog: {
          platform: 'blog',
          adjustments: {},
          platformSpecificRules: ['Maintain brand voice consistency'],
        },
        twitter: {
          platform: 'twitter',
          adjustments: {
            lengthPreference: 'shorter',
            emphasisStyle: 'punchy and direct',
            callToActionStyle: 'engagement-focused',
          },
          platformSpecificRules: [
            'Keep content concise and impactful',
            'Use relevant hashtags sparingly',
            'Encourage retweets and replies',
          ],
        },
        facebook: {
          platform: 'facebook',
          adjustments: {},
          platformSpecificRules: ['Maintain brand voice consistency'],
        },
        instagram: {
          platform: 'instagram',
          adjustments: {
            toneShift: 'more engaging and visual',
            emphasisStyle: 'storytelling',
            callToActionStyle: 'visual engagement',
          },
          platformSpecificRules: [
            'Reference visual content',
            'Use storytelling approach',
            'Include engaging call-to-actions',
          ],
        },
        linkedin: {
          platform: 'linkedin',
          adjustments: {
            formalityAdjustment: 0.2,
            emphasisStyle: 'professional insights',
            callToActionStyle: 'professional networking',
          },
          platformSpecificRules: [
            'Use industry-appropriate terminology',
            'Include professional insights',
            'Encourage professional engagement',
          ],
        },
        youtube: {
          platform: 'youtube',
          adjustments: {},
          platformSpecificRules: ['Maintain brand voice consistency'],
        },
        tiktok: {
          platform: 'tiktok',
          adjustments: {},
          platformSpecificRules: ['Maintain brand voice consistency'],
        },
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    consistencyScore: 0.85,
    appliedAdjustments: [],
    crossPlatformConsistency: {
      overallScore: 0.9,
      platformScores: { blog: 0.9 },
      inconsistencies: [],
      recommendations: ['Brand voice consistency is good'],
    },
    recommendations: ['Continue using professional tone'],
    processingTime: 1500,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockBrandVoiceEngine.applyBrandVoiceConsistency.mockResolvedValue(mockVoiceAnalysisResult);
  });

  describe('Analyze Brand Voice Handler', () => {
    const createAnalyzeEvent = (body: any, token?: string): APIGatewayEvent => ({
      httpMethod: 'POST',
      path: '/platform/analyze-brand-voice',
      pathParameters: null,
      queryStringParameters: null,
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      requestContext: {
        requestId: 'test-request-id',
        identity: {
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
        },
      },
    });

    it('should analyze brand voice successfully', async () => {
      const requestBody = {
        brandVoiceDescription: 'professional and approachable',
        sampleContent: 'This is sample content for analysis.',
      };

      const event = createAnalyzeEvent(requestBody, mockToken);
      const result = await analyzeBrandVoiceHandler(event);

      expect(result.statusCode).toBe(200);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.voiceAnalysis).toBeDefined();
      expect(responseBody.data.consistencyScore).toBe(0.85);
      expect(responseBody.data.recommendations).toBeInstanceOf(Array);
      expect(responseBody.data.processingTime).toBe(1500);

      expect(mockBrandVoiceEngine.applyBrandVoiceConsistency).toHaveBeenCalledWith({
        content: expect.objectContaining({
          generatedText: 'This is sample content for analysis.',
        }),
        userPreferences: expect.objectContaining({
          brandVoice: 'professional and approachable',
        }),
      });
    });

    it('should use default sample content when not provided', async () => {
      const requestBody = {
        brandVoiceDescription: 'professional and approachable',
      };

      const event = createAnalyzeEvent(requestBody, mockToken);
      const result = await analyzeBrandVoiceHandler(event);

      expect(result.statusCode).toBe(200);
      
      expect(mockBrandVoiceEngine.applyBrandVoiceConsistency).toHaveBeenCalledWith({
        content: expect.objectContaining({
          generatedText: 'Sample content for brand voice analysis.',
        }),
        userPreferences: expect.objectContaining({
          brandVoice: 'professional and approachable',
        }),
      });
    });

    it('should return 401 for invalid token', async () => {
      const requestBody = {
        brandVoiceDescription: 'professional and approachable',
      };

      const event = createAnalyzeEvent(requestBody, 'invalid-token');
      const result = await analyzeBrandVoiceHandler(event);

      expect(result.statusCode).toBe(401);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Unauthorized');
    });

    it('should return 400 for missing brand voice description', async () => {
      const requestBody = {
        sampleContent: 'This is sample content.',
      };

      const event = createAnalyzeEvent(requestBody, mockToken);
      const result = await analyzeBrandVoiceHandler(event);

      expect(result.statusCode).toBe(400);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Brand voice description is required');
    });

    it('should return 400 for missing request body', async () => {
      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        path: '/platform/analyze-brand-voice',
        pathParameters: null,
        queryStringParameters: null,
        headers: {
          'Authorization': `Bearer ${mockToken}`,
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

      const result = await analyzeBrandVoiceHandler(event);

      expect(result.statusCode).toBe(400);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Request body is required');
    });

    it('should handle brand voice analysis errors', async () => {
      mockBrandVoiceEngine.applyBrandVoiceConsistency.mockRejectedValueOnce(
        new Error('Brand voice analysis failed')
      );

      const requestBody = {
        brandVoiceDescription: 'professional and approachable',
      };

      const event = createAnalyzeEvent(requestBody, mockToken);
      const result = await analyzeBrandVoiceHandler(event);

      expect(result.statusCode).toBe(500);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Internal server error');
      expect(responseBody.message).toBe('Brand voice analysis failed');
    });
  });

  describe('Check Consistency Handler', () => {
    const createConsistencyEvent = (body: any, token?: string): APIGatewayEvent => ({
      httpMethod: 'POST',
      path: '/platform/check-consistency',
      pathParameters: null,
      queryStringParameters: null,
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      requestContext: {
        requestId: 'test-request-id',
        identity: {
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
        },
      },
    });

    beforeEach(() => {
      mockDatabaseService.getGeneratedContent.mockResolvedValue(mockContent);
    });

    it('should check cross-platform consistency successfully', async () => {
      const requestBody = {
        contentIds: ['content-123', 'content-456'],
        brandVoiceDescription: 'professional and approachable',
      };

      const event = createConsistencyEvent(requestBody, mockToken);
      const result = await checkConsistencyHandler(event);

      expect(result.statusCode).toBe(200);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.consistencyReport).toBeDefined();
      expect(responseBody.data.consistencyReport.overallScore).toBe(0.9);
      expect(responseBody.data.consistencyReport.contentAnalysis).toBeInstanceOf(Array);
      expect(responseBody.data.voiceAnalysis).toBeDefined();
      expect(responseBody.data.recommendations).toBeInstanceOf(Array);

      expect(mockDatabaseService.getGeneratedContent).toHaveBeenCalledTimes(2);
      expect(mockBrandVoiceEngine.applyBrandVoiceConsistency).toHaveBeenCalled();
    });

    it('should return 401 for invalid token', async () => {
      const requestBody = {
        contentIds: ['content-123'],
        brandVoiceDescription: 'professional and approachable',
      };

      const event = createConsistencyEvent(requestBody, 'invalid-token');
      const result = await checkConsistencyHandler(event);

      expect(result.statusCode).toBe(401);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Unauthorized');
    });

    it('should return 400 for missing content IDs', async () => {
      const requestBody = {
        brandVoiceDescription: 'professional and approachable',
      };

      const event = createConsistencyEvent(requestBody, mockToken);
      const result = await checkConsistencyHandler(event);

      expect(result.statusCode).toBe(400);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Content IDs are required');
    });

    it('should return 400 for empty content IDs array', async () => {
      const requestBody = {
        contentIds: [],
        brandVoiceDescription: 'professional and approachable',
      };

      const event = createConsistencyEvent(requestBody, mockToken);
      const result = await checkConsistencyHandler(event);

      expect(result.statusCode).toBe(400);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Content IDs are required');
    });

    it('should return 400 for missing brand voice description', async () => {
      const requestBody = {
        contentIds: ['content-123'],
      };

      const event = createConsistencyEvent(requestBody, mockToken);
      const result = await checkConsistencyHandler(event);

      expect(result.statusCode).toBe(400);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Brand voice description is required');
    });

    it('should return 404 when no valid content found', async () => {
      mockDatabaseService.getGeneratedContent.mockResolvedValue(null);

      const requestBody = {
        contentIds: ['content-123'],
        brandVoiceDescription: 'professional and approachable',
      };

      const event = createConsistencyEvent(requestBody, mockToken);
      const result = await checkConsistencyHandler(event);

      expect(result.statusCode).toBe(404);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('No valid content found');
    });

    it('should return 403 when user does not own content', async () => {
      const otherUserContent = { ...mockContent, userId: 'other-user' };
      mockDatabaseService.getGeneratedContent.mockResolvedValue(otherUserContent);

      const requestBody = {
        contentIds: ['content-123'],
        brandVoiceDescription: 'professional and approachable',
      };

      const event = createConsistencyEvent(requestBody, mockToken);
      const result = await checkConsistencyHandler(event);

      expect(result.statusCode).toBe(403);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Access denied to some content');
    });

    it('should handle consistency check errors', async () => {
      mockBrandVoiceEngine.applyBrandVoiceConsistency.mockRejectedValueOnce(
        new Error('Consistency check failed')
      );

      const requestBody = {
        contentIds: ['content-123'],
        brandVoiceDescription: 'professional and approachable',
      };

      const event = createConsistencyEvent(requestBody, mockToken);
      const result = await checkConsistencyHandler(event);

      expect(result.statusCode).toBe(500);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Internal server error');
      expect(responseBody.message).toBe('Consistency check failed');
    });

    it('should handle database errors', async () => {
      mockDatabaseService.getGeneratedContent.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const requestBody = {
        contentIds: ['content-123'],
        brandVoiceDescription: 'professional and approachable',
      };

      const event = createConsistencyEvent(requestBody, mockToken);
      const result = await checkConsistencyHandler(event);

      expect(result.statusCode).toBe(500);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Internal server error');
    });
  });
});