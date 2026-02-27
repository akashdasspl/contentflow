import { APIGatewayEvent, APIGatewayResponse } from '../../types';
import { analyticsDashboardService } from '../../services/analytics-dashboard';
import { validateToken, createResponse } from '../../utils';

/**
 * Lambda function to get recent activity feed
 * GET /analytics/activity
 */
export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  try {
    console.log('Get activity feed request:', JSON.stringify(event, null, 2));

    // Validate authentication
    const authResult = await validateToken(event.headers.Authorization || '');
    if (!authResult.isValid || !authResult.userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const limitParam = queryParams.limit;
    const activityType = queryParams.type;

    // Validate and parse limit parameter
    let limit = 10; // default
    if (limitParam) {
      const parsedLimit = parseInt(limitParam);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return createResponse(400, { 
          error: 'Invalid limit parameter',
          message: 'Limit must be a number between 1 and 100'
        });
      }
      limit = parsedLimit;
    }

    // Validate activity type if provided
    const validTypes = ['content_generated', 'feedback_received', 'idea_submitted'];
    if (activityType && !validTypes.includes(activityType)) {
      return createResponse(400, { 
        error: 'Invalid activity type parameter',
        message: `Activity type must be one of: ${validTypes.join(', ')}`
      });
    }

    // Get recent activity
    const activities = await analyticsDashboardService.getRecentActivity(
      authResult.userId,
      limit
    );

    // Filter by activity type if specified
    const filteredActivities = activityType ? 
      activities.filter(activity => activity.type === activityType) : 
      activities;

    return createResponse(200, {
      success: true,
      data: {
        userId: authResult.userId,
        limit,
        activityType: activityType || 'all',
        totalActivities: filteredActivities.length,
        activities: filteredActivities
      }
    });

  } catch (error) {
    console.error('Error retrieving activity feed:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: 'Failed to retrieve activity feed'
    });
  }
};