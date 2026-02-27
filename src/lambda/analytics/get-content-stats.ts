import { APIGatewayEvent, APIGatewayResponse } from '../../types';
import { analyticsDashboardService } from '../../services/analytics-dashboard';
import { validateToken, createResponse } from '../../utils';

/**
 * Lambda function to get detailed content generation statistics
 * GET /analytics/content-stats
 */
export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  try {
    console.log('Get content stats request:', JSON.stringify(event, null, 2));

    // Validate authentication
    const authResult = await validateToken(event.headers.Authorization || '');
    if (!authResult.isValid || !authResult.userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const startDate = queryParams.startDate;
    const endDate = queryParams.endDate;

    // Validate and parse date range if provided
    let dateRange = undefined;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return createResponse(400, { 
          error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)' 
        });
      }

      if (start >= end) {
        return createResponse(400, { 
          error: 'Start date must be before end date' 
        });
      }

      dateRange = {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      };
    }

    // Get content generation statistics
    const contentStats = await analyticsDashboardService.getContentGenerationStats(
      authResult.userId,
      dateRange
    );

    return createResponse(200, {
      success: true,
      data: {
        userId: authResult.userId,
        dateRange: dateRange || 'all_time',
        contentStats
      }
    });

  } catch (error) {
    console.error('Error retrieving content statistics:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: 'Failed to retrieve content statistics'
    });
  }
};