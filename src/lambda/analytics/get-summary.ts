import { APIGatewayEvent, APIGatewayResponse } from '../../types';
import { analyticsDashboardService } from '../../services/analytics-dashboard';
import { validateToken, createResponse } from '../../utils';

/**
 * Lambda function to get analytics summary for a specific period
 * GET /analytics/summary
 */
export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  try {
    console.log('Get analytics summary request:', JSON.stringify(event, null, 2));

    // Validate authentication
    const authResult = await validateToken(event.headers.Authorization || '');
    if (!authResult.isValid || !authResult.userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const period = queryParams.period as 'week' | 'month' | 'quarter' | 'year' || 'month';

    // Validate period parameter
    const validPeriods = ['week', 'month', 'quarter', 'year'];
    if (!validPeriods.includes(period)) {
      return createResponse(400, { 
        error: 'Invalid period parameter',
        message: 'Period must be one of: week, month, quarter, year'
      });
    }

    // Get analytics summary
    const summary = await analyticsDashboardService.getAnalyticsSummary(
      authResult.userId,
      period
    );

    return createResponse(200, {
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error retrieving analytics summary:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: 'Failed to retrieve analytics summary'
    });
  }
};