// Lambda function for getting learning insights

import { APIGatewayEvent, APIGatewayResponse } from '../../types';
import { learningIntegrationService } from '../../services/learning-integration';
import { validateToken } from '../../utils/auth';
import { logError, logInfo } from '../../utils';

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  try {
    // Validate authentication
    const authResult = await validateToken(event.headers.Authorization);
    if (!authResult.isValid) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Invalid or missing authentication token',
        }),
      };
    }

    const userId = authResult.userId!;
    
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const {
      includeMetrics = 'true',
      includeRecommendations = 'true',
      dateRange,
    } = queryParams;

    const options = {
      includeMetrics: includeMetrics === 'true',
      includeRecommendations: includeRecommendations === 'true',
      dateRange: dateRange ? JSON.parse(dateRange) : undefined,
    };

    logInfo('Learning insights request received', {
      userId,
      options,
    });

    // Get learning insights
    const insights = await learningIntegrationService.getLearningInsights(userId, options);

    logInfo('Learning insights generated', {
      userId,
      profileCount: Object.keys(insights.profileSummary).length,
      recommendationCount: insights.recommendations.length,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: insights,
      }),
    };

  } catch (error) {
    logError('Failed to get learning insights', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Learning Insights Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
    };
  }
};