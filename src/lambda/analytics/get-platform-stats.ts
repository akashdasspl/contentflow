import { APIGatewayEvent, APIGatewayResponse } from '../../types';
import { analyticsDashboardService } from '../../services/analytics-dashboard';
import { validateToken, createResponse } from '../../utils';

/**
 * Lambda function to get platform-specific statistics
 * GET /analytics/platforms
 */
export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  try {
    console.log('Get platform stats request:', JSON.stringify(event, null, 2));

    // Validate authentication
    const authResult = await validateToken(event.headers.Authorization || '');
    if (!authResult.isValid || !authResult.userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const startDate = queryParams.startDate;
    const endDate = queryParams.endDate;
    const platform = queryParams.platform;

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

    // Validate platform parameter if provided
    const validPlatforms = ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'];
    if (platform && !validPlatforms.includes(platform)) {
      return createResponse(400, { 
        error: 'Invalid platform parameter',
        message: `Platform must be one of: ${validPlatforms.join(', ')}`
      });
    }

    // Get platform statistics
    const platformStats = await analyticsDashboardService.getPlatformStats(
      authResult.userId,
      dateRange
    );

    // Filter by specific platform if requested
    let responseData = platformStats;
    if (platform) {
      const platformData = platformStats.platformData[platform as keyof typeof platformStats.platformData];
      responseData = {
        platformData: { [platform]: platformData },
        bestPerformingPlatform: platformStats.bestPerformingPlatform === platform ? platform : null,
        worstPerformingPlatform: platformStats.worstPerformingPlatform === platform ? platform : null,
        platformRankings: platformStats.platformRankings.filter(p => p.platform === platform)
      };
    }

    return createResponse(200, {
      success: true,
      data: {
        userId: authResult.userId,
        dateRange: dateRange || 'all_time',
        platform: platform || 'all',
        platformStats: responseData
      }
    });

  } catch (error) {
    console.error('Error retrieving platform statistics:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: 'Failed to retrieve platform statistics'
    });
  }
};