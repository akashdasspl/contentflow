// Lambda function for brand voice analysis

import { APIGatewayEvent, APIGatewayResponse } from '../../types';
import { brandVoiceConsistencyEngine } from '../../services/brand-voice-consistency';
import { validateJWT, createResponse, logInfo, logError } from '../../utils';

interface BrandVoiceAnalysisRequest {
  brandVoiceDescription: string;
  sampleContent?: string;
}

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  logInfo('Brand voice analysis request received', {
    path: event.path,
    method: event.httpMethod,
  });

  try {
    // Validate authentication
    const authResult = validateJWT(event.headers.Authorization || '');
    if (!authResult.valid) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Parse request body
    if (!event.body) {
      return createResponse(400, { error: 'Request body is required' });
    }

    const request: BrandVoiceAnalysisRequest = JSON.parse(event.body);

    // Validate required fields
    if (!request.brandVoiceDescription) {
      return createResponse(400, { error: 'Brand voice description is required' });
    }

    // Analyze brand voice
    const mockContent = {
      contentId: 'analysis_' + Date.now(),
      ideaId: 'temp',
      userId: authResult.payload.userId,
      platform: 'blog' as const,
      contentType: 'blog-post' as const,
      generatedText: request.sampleContent || 'Sample content for brand voice analysis.',
      metadata: {
        wordCount: 0,
        hashtags: [],
        seoKeywords: [],
        readingTime: 0,
      },
      version: 1,
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
    };

    const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
      content: mockContent,
      userPreferences: {
        brandVoice: request.brandVoiceDescription,
        targetAudience: {
          profileId: 'temp',
          userId: authResult.payload.userId,
          demographics: {
            ageRange: '25-45',
            location: 'Global',
            interests: [],
          },
          behaviorPatterns: {
            preferredContentTypes: ['blog-post'],
            engagementTimes: [],
            platformUsage: {},
          },
          updatedAt: new Date().toISOString(),
        },
        preferredPlatforms: ['blog'],
        contentStyle: 'professional',
      },
    });

    logInfo('Brand voice analysis completed', {
      userId: authResult.payload.userId,
      consistencyScore: result.consistencyScore,
      processingTime: result.processingTime,
    });

    return createResponse(200, {
      success: true,
      data: {
        voiceAnalysis: result.voiceAnalysis,
        consistencyScore: result.consistencyScore,
        recommendations: result.recommendations,
        processingTime: result.processingTime,
      },
    });

  } catch (error) {
    logError('Brand voice analysis failed', error);
    return createResponse(500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};