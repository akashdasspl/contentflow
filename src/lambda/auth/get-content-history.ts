// Get user content history Lambda function
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  extractTokenFromEvent,
  verifyJWT,
  getCurrentTimestamp,
  logInfo,
  logError,
  handleLambdaError
} from '../../utils';
import { 
  contentIdeaService, 
  generatedContentService, 
  engagementFeedbackService 
} from '../../services/database';
import { ContentIdea, GeneratedContent, EngagementFeedback } from '../../types';

interface ContentHistoryResponse {
  userId: string;
  totalContentIdeas: number;
  totalGeneratedContent: number;
  totalFeedbackEntries: number;
  recentContentIdeas: ContentIdea[];
  recentGeneratedContent: GeneratedContent[];
  recentFeedback: EngagementFeedback[];
  statistics: {
    contentByPlatform: Record<string, number>;
    contentByType: Record<string, number>;
    averageEngagementRate: number;
    mostUsedPlatforms: string[];
    contentGenerationTrend: Array<{
      date: string;
      count: number;
    }>;
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Get user content history request received', { 
      path: event.path,
      httpMethod: event.httpMethod 
    });

    // Extract and verify JWT token
    const token = extractTokenFromEvent(event);
    if (!token) {
      return createErrorResponse('Authorization token is required', 401);
    }

    let decodedToken;
    try {
      decodedToken = verifyJWT(token);
    } catch (error) {
      return createErrorResponse('Invalid or expired token', 401);
    }

    const userId = decodedToken.userId;
    if (!userId) {
      return createErrorResponse('Invalid token payload', 401);
    }

    // Parse query parameters for pagination and filtering
    const limit = event.queryStringParameters?.limit ? 
      Math.min(parseInt(event.queryStringParameters.limit), 100) : 20;
    
    const platform = event.queryStringParameters?.platform;
    const contentType = event.queryStringParameters?.contentType;
    const dateFrom = event.queryStringParameters?.dateFrom;
    const dateTo = event.queryStringParameters?.dateTo;

    logInfo('Fetching user content history', { 
      userId, 
      limit, 
      platform, 
      contentType, 
      dateFrom, 
      dateTo 
    });

    // Get user's content ideas
    const contentIdeas = await contentIdeaService.getUserContentIdeas(userId, limit);
    
    // Get user's generated content
    const generatedContent = await generatedContentService.getUserGeneratedContent(userId, limit);
    
    // Get user's engagement feedback
    const feedbackData = await engagementFeedbackService.getUserFeedback(userId, limit);

    // Apply filters if specified
    let filteredGeneratedContent = generatedContent;
    let filteredFeedback = feedbackData;

    if (platform) {
      filteredGeneratedContent = generatedContent.filter(content => content.platform === platform);
      filteredFeedback = feedbackData.filter(feedback => feedback.platform === platform);
    }

    if (contentType) {
      filteredGeneratedContent = filteredGeneratedContent.filter(content => content.contentType === contentType);
    }

    if (dateFrom || dateTo) {
      const fromDate = dateFrom ? new Date(dateFrom) : new Date(0);
      const toDate = dateTo ? new Date(dateTo) : new Date();

      filteredGeneratedContent = filteredGeneratedContent.filter(content => {
        const contentDate = new Date(content.createdAt);
        return contentDate >= fromDate && contentDate <= toDate;
      });

      filteredFeedback = filteredFeedback.filter(feedback => {
        const feedbackDate = new Date(feedback.timestamp);
        return feedbackDate >= fromDate && feedbackDate <= toDate;
      });
    }

    // Calculate statistics
    const statistics = calculateStatistics(generatedContent, feedbackData);

    // Prepare response
    const historyResponse: ContentHistoryResponse = {
      userId,
      totalContentIdeas: contentIdeas.length,
      totalGeneratedContent: filteredGeneratedContent.length,
      totalFeedbackEntries: filteredFeedback.length,
      recentContentIdeas: contentIdeas.slice(0, limit),
      recentGeneratedContent: filteredGeneratedContent.slice(0, limit),
      recentFeedback: filteredFeedback.slice(0, limit),
      statistics,
    };

    logInfo('User content history retrieved successfully', { 
      userId,
      totalItems: historyResponse.totalContentIdeas + historyResponse.totalGeneratedContent + historyResponse.totalFeedbackEntries
    });

    return createSuccessResponse(historyResponse, 200);

  } catch (error: any) {
    logError('Get content history error', error);
    return handleLambdaError(error);
  }
};

// Helper function to calculate content statistics
function calculateStatistics(
  generatedContent: GeneratedContent[], 
  feedbackData: EngagementFeedback[]
): ContentHistoryResponse['statistics'] {
  // Content by platform
  const contentByPlatform: Record<string, number> = {};
  generatedContent.forEach(content => {
    contentByPlatform[content.platform] = (contentByPlatform[content.platform] || 0) + 1;
  });

  // Content by type
  const contentByType: Record<string, number> = {};
  generatedContent.forEach(content => {
    contentByType[content.contentType] = (contentByType[content.contentType] || 0) + 1;
  });

  // Average engagement rate
  let totalEngagementRate = 0;
  let engagementCount = 0;
  feedbackData.forEach(feedback => {
    if (feedback.metrics.engagementRate !== undefined) {
      totalEngagementRate += feedback.metrics.engagementRate;
      engagementCount++;
    }
  });
  const averageEngagementRate = engagementCount > 0 ? totalEngagementRate / engagementCount : 0;

  // Most used platforms (sorted by usage)
  const mostUsedPlatforms = Object.entries(contentByPlatform)
    .sort(([, a], [, b]) => b - a)
    .map(([platform]) => platform)
    .slice(0, 5);

  // Content generation trend (last 30 days)
  const contentGenerationTrend = calculateContentTrend(generatedContent);

  return {
    contentByPlatform,
    contentByType,
    averageEngagementRate: Math.round(averageEngagementRate * 10000) / 10000, // Round to 4 decimal places
    mostUsedPlatforms,
    contentGenerationTrend,
  };
}

// Helper function to calculate content generation trend
function calculateContentTrend(generatedContent: GeneratedContent[]): Array<{ date: string; count: number }> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Group content by date
  const contentByDate: Record<string, number> = {};
  
  generatedContent.forEach(content => {
    const contentDate = new Date(content.createdAt);
    if (contentDate >= thirtyDaysAgo) {
      const dateKey = contentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      contentByDate[dateKey] = (contentByDate[dateKey] || 0) + 1;
    }
  });

  // Create array with all dates in the last 30 days
  const trend: Array<{ date: string; count: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateKey = date.toISOString().split('T')[0];
    trend.push({
      date: dateKey,
      count: contentByDate[dateKey] || 0,
    });
  }

  return trend;
}