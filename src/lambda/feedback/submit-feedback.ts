import { APIGatewayEvent, APIGatewayResponse } from '../../types';
import { 
  engagementFeedbackService, 
  generatedContentService 
} from '../../services/database';
import { feedbackProcessingService } from '../../services/feedback-processing';
import { openSearchService } from '../../services/opensearch-service';
import { 
  validateToken, 
  createResponse, 
  generateFeedbackId,
  getCurrentTimestamp 
} from '../../utils';
import { EngagementFeedback, FeedbackSubmissionRequest, EngagementMetrics } from '../../types';

/**
 * Lambda function to submit engagement feedback data
 * Validates input, stores in DynamoDB, and sends to OpenSearch for analytics
 */
export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  try {
    console.log('Submit feedback request:', JSON.stringify(event, null, 2));

    // Validate authentication
    const authResult = await validateToken(event.headers.Authorization || '');
    if (!authResult.isValid || !authResult.userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Parse request body
    if (!event.body) {
      return createResponse(400, { error: 'Request body is required' });
    }

    let requestData: FeedbackSubmissionRequest;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      return createResponse(400, { error: 'Invalid JSON in request body' });
    }

    // Validate required fields
    const validationErrors = validateFeedbackRequest(requestData);
    if (validationErrors.length > 0) {
      return createResponse(400, { 
        error: 'Validation failed', 
        details: validationErrors 
      });
    }

    // Verify content exists and belongs to user
    const content = await generatedContentService.getGeneratedContent(requestData.contentId);
    if (!content) {
      return createResponse(404, { error: 'Content not found' });
    }

    if (content.userId !== authResult.userId) {
      return createResponse(403, { error: 'Access denied to this content' });
    }

    // Create feedback record
    const feedbackId = generateFeedbackId();
    const timestamp = requestData.timestamp || getCurrentTimestamp();

    const feedback: EngagementFeedback = {
      feedbackId,
      contentId: requestData.contentId,
      userId: authResult.userId,
      platform: requestData.platform,
      metrics: requestData.metrics,
      timestamp
    };

    // Store in DynamoDB
    await engagementFeedbackService.createFeedback(feedback);

    // Process feedback for insights and validation
    const processedFeedback = await feedbackProcessingService.processFeedback(feedback);

    // Send to OpenSearch for analytics (async - don't block response)
    openSearchService.indexFeedback(feedback, content).catch(error => {
      console.error('Failed to index feedback in OpenSearch:', error);
      // Don't throw - feedback is already stored in DynamoDB
    });

    console.log('Feedback submitted successfully:', feedbackId);

    return createResponse(201, {
      message: 'Feedback submitted successfully',
      feedbackId,
      timestamp,
      insights: processedFeedback.insights,
      performanceCategory: processedFeedback.derivedMetrics.performanceCategory,
      qualityScore: processedFeedback.derivedMetrics.qualityScore
    });

  } catch (error) {
    console.error('Error submitting feedback:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: 'Failed to submit feedback'
    });
  }
};

/**
 * Validate feedback submission request
 */
function validateFeedbackRequest(request: FeedbackSubmissionRequest): string[] {
  const errors: string[] = [];

  if (!request.contentId || typeof request.contentId !== 'string') {
    errors.push('contentId is required and must be a string');
  }

  if (!request.platform || typeof request.platform !== 'string') {
    errors.push('platform is required and must be a string');
  }

  const validPlatforms = ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'];
  if (request.platform && !validPlatforms.includes(request.platform)) {
    errors.push(`platform must be one of: ${validPlatforms.join(', ')}`);
  }

  if (!request.metrics || typeof request.metrics !== 'object') {
    errors.push('metrics is required and must be an object');
  } else {
    const metricsErrors = validateEngagementMetrics(request.metrics);
    errors.push(...metricsErrors);
  }

  if (request.timestamp && typeof request.timestamp !== 'string') {
    errors.push('timestamp must be a string if provided');
  }

  return errors;
}

/**
 * Validate engagement metrics
 */
function validateEngagementMetrics(metrics: EngagementMetrics): string[] {
  const errors: string[] = [];

  // Required metrics
  const requiredMetrics = ['likes', 'shares', 'comments', 'clickThroughRate', 'engagementRate'];
  
  for (const metric of requiredMetrics) {
    if (!(metric in metrics)) {
      errors.push(`metrics.${metric} is required`);
    } else if (typeof metrics[metric as keyof EngagementMetrics] !== 'number') {
      errors.push(`metrics.${metric} must be a number`);
    } else if (metrics[metric as keyof EngagementMetrics] < 0) {
      errors.push(`metrics.${metric} must be non-negative`);
    }
  }

  // Validate rate metrics are between 0 and 1
  const rateMetrics = ['clickThroughRate', 'engagementRate'];
  for (const metric of rateMetrics) {
    if (metric in metrics) {
      const value = metrics[metric as keyof EngagementMetrics];
      if (typeof value === 'number' && (value < 0 || value > 1)) {
        errors.push(`metrics.${metric} must be between 0 and 1`);
      }
    }
  }

  // Optional metrics validation
  const optionalMetrics = ['impressions', 'reach'];
  for (const metric of optionalMetrics) {
    if (metric in metrics) {
      const value = metrics[metric as keyof EngagementMetrics];
      if (typeof value !== 'number' || value < 0) {
        errors.push(`metrics.${metric} must be a non-negative number if provided`);
      }
    }
  }

  return errors;
}

/**
 * Categorize performance based on engagement metrics
 */
function categorizePerformance(metrics: EngagementMetrics): string {
  const engagementRate = metrics.engagementRate || 0;
  const clickThroughRate = metrics.clickThroughRate || 0;

  if (engagementRate >= 0.1 || clickThroughRate >= 0.05) {
    return 'high';
  } else if (engagementRate >= 0.05 || clickThroughRate >= 0.02) {
    return 'medium';
  } else {
    return 'low';
  }
}