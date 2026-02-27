// Lambda function for cross-platform brand voice consistency checking

import { APIGatewayEvent, APIGatewayResponse } from '../../types';
import { brandVoiceConsistencyEngine } from '../../services/brand-voice-consistency';
import { databaseService } from '../../services/database';
import { validateJWT, createResponse, logInfo, logError } from '../../utils';

interface ConsistencyCheckRequest {
  contentIds: string[];
  brandVoiceDescription: string;
  targetPlatform?: string;
}

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  logInfo('Cross-platform consistency check request received', {
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

    const request: ConsistencyCheckRequest = JSON.parse(event.body);

    // Validate required fields
    if (!request.contentIds || request.contentIds.length === 0) {
      return createResponse(400, { error: 'Content IDs are required' });
    }

    if (!request.brandVoiceDescription) {
      return createResponse(400, { error: 'Brand voice description is required' });
    }

    // Retrieve content from database
    const contentPromises = request.contentIds.map(contentId =>
      databaseService.getGeneratedContent(contentId)
    );

    const contentResults = await Promise.all(contentPromises);
    const validContent = contentResults.filter(content => content !== null);

    if (validContent.length === 0) {
      return createResponse(404, { error: 'No valid content found' });
    }

    // Verify user owns all content
    const userContent = validContent.filter(content => content!.userId === authResult.payload.userId);
    if (userContent.length !== validContent.length) {
      return createResponse(403, { error: 'Access denied to some content' });
    }

    // Use the first content item as the primary content for analysis
    const primaryContent = userContent[0]!;
    const referenceContent = userContent.slice(1);

    // Perform consistency check
    const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
      content: primaryContent,
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
      crossPlatformReference: referenceContent,
    });

    // Generate detailed consistency report
    const consistencyReport = {
      overallScore: result.crossPlatformConsistency.overallScore,
      platformBreakdown: result.crossPlatformConsistency.platformScores,
      inconsistencies: result.crossPlatformConsistency.inconsistencies,
      recommendations: result.crossPlatformConsistency.recommendations,
      contentAnalysis: userContent.map(content => ({
        contentId: content.contentId,
        platform: content.platform,
        contentType: content.contentType,
        consistencyScore: result.crossPlatformConsistency.platformScores[content.platform] || 0,
        wordCount: content.metadata.wordCount,
        createdAt: content.createdAt,
      })),
    };

    logInfo('Cross-platform consistency check completed', {
      userId: authResult.payload.userId,
      contentCount: userContent.length,
      overallScore: result.crossPlatformConsistency.overallScore,
      processingTime: result.processingTime,
    });

    return createResponse(200, {
      success: true,
      data: {
        consistencyReport,
        voiceAnalysis: result.voiceAnalysis,
        recommendations: result.recommendations,
        processingTime: result.processingTime,
      },
    });

  } catch (error) {
    logError('Cross-platform consistency check failed', error);
    return createResponse(500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};