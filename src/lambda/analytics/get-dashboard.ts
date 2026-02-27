import { APIGatewayEvent, APIGatewayResponse } from '../../types';
import { analyticsDashboardService } from '../../services/analytics-dashboard';
import { validateToken, createResponse } from '../../utils';

/**
 * Lambda function to get comprehensive dashboard data
 * GET /analytics/dashboard
 */
export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  try {
    console.log('Get dashboard request:', JSON.stringify(event, null, 2));

    // Validate authentication
    const authResult = await validateToken(event.headers.Authorization || '');
    if (!authResult.isValid || !authResult.userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const startDate = queryParams.startDate;
    const endDate = queryParams.endDate;

    // Validate date range if provided
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

      // Limit date range to prevent excessive data processing
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        return createResponse(400, { 
          error: 'Date range cannot exceed 365 days' 
        });
      }

      dateRange = {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      };
    }

    // Get dashboard data
    const dashboardData = await analyticsDashboardService.getDashboardData(
      authResult.userId,
      dateRange
    );

    return createResponse(200, {
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Error retrieving dashboard data:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: 'Failed to retrieve dashboard data'
    });
  }
};