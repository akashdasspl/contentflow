import { APIGatewayEvent, APIGatewayResponse } from '../../types';
import { patternRecognitionService } from '../../services/pattern-recognition';
import { createResponse } from '../../utils';

/**
 * Lambda function to retrieve performance patterns and analysis
 * Provides comprehensive pattern recognition for content performance
 */
export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  try {
    console.log('Get patterns request:', JSON.stringify(event, null, 2));

    // Extract user ID from path parameters
    const userId = event.pathParameters?.userId;
    if (!userId) {
      return createResponse(400, { error: 'User ID is required' });
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const analysisType = queryParams.type || 'performance';
    const platform = queryParams.platform;
    const dateFrom = queryParams.dateFrom;
    const dateTo = queryParams.dateTo;
    const timeInterval = queryParams.timeInterval || 'day';

    // Validate date range
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return createResponse(400, { 
        error: 'Invalid date range. dateFrom must be before dateTo.' 
      });
    }

    // Validate analysis type
    const validTypes = ['performance', 'content', 'trends'];
    if (!validTypes.includes(analysisType)) {
      return createResponse(400, { 
        error: `Invalid analysis type. Must be one of: ${validTypes.join(', ')}` 
      });
    }

    let result: any = {};

    // Get patterns based on analysis type
    switch (analysisType) {
      case 'performance':
        result = await patternRecognitionService.identifyPerformancePatterns(userId, {
          platform: platform as any,
          dateFrom,
          dateTo,
          timeInterval
        });
        break;

      case 'content':
        const minEngagementRate = queryParams.minEngagementRate ? 
          parseFloat(queryParams.minEngagementRate) : undefined;
        const minClickThroughRate = queryParams.minClickThroughRate ? 
          parseFloat(queryParams.minClickThroughRate) : undefined;
        const contentType = queryParams.contentType;

        result = await patternRecognitionService.analyzeSuccessfulContent(userId, {
          platform: platform as any,
          dateFrom,
          dateTo,
          contentType,
          minEngagementRate,
          minClickThroughRate
        });
        break;

      case 'trends':
        result = await patternRecognitionService.generateTrendAnalysis(userId, {
          platform: platform as any,
          dateFrom,
          dateTo,
          timeInterval
        });
        break;
    }

    return createResponse(200, {
      analysisType,
      filters: {
        platform: platform || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        timeInterval
      },
      generatedAt: new Date().toISOString(),
      ...result
    });

  } catch (error) {
    console.error('Error retrieving patterns:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: 'Failed to retrieve patterns'
    });
  }
};