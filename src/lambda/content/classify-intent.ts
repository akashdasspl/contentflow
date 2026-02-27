// Lambda function for intent classification
// Requirements: 2.2

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { intentClassificationService } from '../../services/intent-classification';
import { contentIdeaService } from '../../services/database';
import {
  createSuccessResponse,
  createErrorResponse,
  handleLambdaError,
  extractTokenFromEvent,
  verifyJWT,
  logInfo,
  logError,
  validateContentIntent,
} from '../../utils';
import {
  IntentClassificationResult,
  IntentClassificationOptions,
  ContentIdea,
  ContentIntent,
} from '../../types';

interface ClassifyIntentRequest {
  text?: string;
  ideaId?: string;
  options?: IntentClassificationOptions;
}

interface ClassifyIntentResponse {
  classification: IntentClassificationResult;
  ideaId?: string;
  ideaUpdated: boolean;
}

interface BatchClassifyIntentRequest {
  texts: string[];
  options?: IntentClassificationOptions;
}

interface BatchClassifyIntentResponse {
  classifications: IntentClassificationResult[];
  totalProcessed: number;
  averageConfidence: number;
}

/**
 * Lambda handler for intent classification
 * POST /content/classify-intent
 * 
 * Requirements:
 * - 2.2: Classify content purpose as informational, promotional, educational, or entertainment
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Intent classification request received', {
      httpMethod: event.httpMethod,
      path: event.path,
      requestId: event.requestContext.requestId,
    });

    // Validate HTTP method
    if (event.httpMethod !== 'POST') {
      return createErrorResponse('Method not allowed', 405);
    }

    // Extract and verify JWT token
    const token = extractTokenFromEvent(event);
    if (!token) {
      return createErrorResponse('Authorization token required', 401);
    }

    let userId: string;
    try {
      const decoded = verifyJWT(token);
      userId = decoded.userId;
    } catch (error) {
      return createErrorResponse('Invalid or expired token', 401);
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse('Request body is required', 400);
    }

    let requestData: ClassifyIntentRequest;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    // Validate request - either text or ideaId must be provided
    if (!requestData.text && !requestData.ideaId) {
      return createErrorResponse('Either text or ideaId must be provided', 400);
    }

    let textToClassify: string;
    let contentIdea: ContentIdea | null = null;

    // Get text from either direct input or content idea
    if (requestData.ideaId) {
      // Fetch content idea from database
      contentIdea = await contentIdeaService.getContentIdea(requestData.ideaId, userId);
      
      if (!contentIdea) {
        return createErrorResponse('Content idea not found', 404);
      }

      textToClassify = contentIdea.content;
      
      logInfo('Classifying intent for existing content idea', {
        userId,
        ideaId: requestData.ideaId,
        textLength: textToClassify.length,
      });
    } else {
      textToClassify = requestData.text!;
      
      logInfo('Classifying intent for provided text', {
        userId,
        textLength: textToClassify.length,
      });
    }

    // Validate text content
    if (!textToClassify || textToClassify.trim().length === 0) {
      return createErrorResponse('Text content cannot be empty', 400);
    }

    if (textToClassify.length > 5000) {
      logInfo('Text length exceeds limit, will be truncated', {
        originalLength: textToClassify.length,
        userId,
      });
    }

    // Perform intent classification
    const classificationOptions: IntentClassificationOptions = {
      useMLModel: true,
      minConfidence: 0.5,
      includeAlternatives: true,
      maxAlternatives: 3,
      enableFeatureExtraction: true,
      ...requestData.options,
    };

    const classificationResult = await intentClassificationService.classifyIntent(
      textToClassify,
      classificationOptions
    );

    // Update content idea with intent classification if ideaId was provided
    let ideaUpdated = false;
    if (requestData.ideaId && contentIdea) {
      try {
        // Update content idea with intent information
        await contentIdeaService.updateContentIdea(requestData.ideaId, userId, {
          intent: classificationResult.intent,
          confidenceScore: classificationResult.confidenceScore,
        });

        ideaUpdated = true;

        logInfo('Content idea updated with intent classification', {
          userId,
          ideaId: requestData.ideaId,
          intent: classificationResult.intent,
          confidenceScore: classificationResult.confidenceScore,
        });
      } catch (error) {
        logError('Failed to update content idea with intent classification', {
          error: error instanceof Error ? error.message : String(error),
          userId,
          ideaId: requestData.ideaId,
        });
        // Don't fail the entire request if update fails
      }
    }

    // Prepare response
    const response: ClassifyIntentResponse = {
      classification: classificationResult,
      ideaId: requestData.ideaId,
      ideaUpdated,
    };

    logInfo('Intent classification completed successfully', {
      userId,
      ideaId: requestData.ideaId,
      intent: classificationResult.intent,
      confidenceScore: classificationResult.confidenceScore,
      processingTime: classificationResult.processingTime,
      modelVersion: classificationResult.modelVersion,
      alternativeIntents: classificationResult.alternativeIntents.length,
      ideaUpdated,
    });

    return createSuccessResponse(response, 200);

  } catch (error) {
    logError('Intent classification failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: event.requestContext.requestId,
    });

    return handleLambdaError(error);
  }
};

/**
 * Lambda handler for batch intent classification
 * POST /content/classify-intent/batch
 */
export const batchHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Batch intent classification request received', {
      httpMethod: event.httpMethod,
      path: event.path,
      requestId: event.requestContext.requestId,
    });

    // Validate HTTP method
    if (event.httpMethod !== 'POST') {
      return createErrorResponse('Method not allowed', 405);
    }

    // Extract and verify JWT token
    const token = extractTokenFromEvent(event);
    if (!token) {
      return createErrorResponse('Authorization token required', 401);
    }

    let userId: string;
    try {
      const decoded = verifyJWT(token);
      userId = decoded.userId;
    } catch (error) {
      return createErrorResponse('Invalid or expired token', 401);
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse('Request body is required', 400);
    }

    let requestData: BatchClassifyIntentRequest;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    // Validate request
    if (!requestData.texts || !Array.isArray(requestData.texts) || requestData.texts.length === 0) {
      return createErrorResponse('texts array is required and must not be empty', 400);
    }

    if (requestData.texts.length > 50) {
      return createErrorResponse('Maximum 50 texts allowed per batch request', 400);
    }

    // Validate each text
    for (let i = 0; i < requestData.texts.length; i++) {
      const text = requestData.texts[i];
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return createErrorResponse(`Text at index ${i} is invalid or empty`, 400);
      }
    }

    logInfo('Processing batch intent classification', {
      userId,
      batchSize: requestData.texts.length,
      totalCharacters: requestData.texts.reduce((sum, text) => sum + text.length, 0),
    });

    // Perform batch intent classification
    const classificationOptions: IntentClassificationOptions = {
      useMLModel: true,
      minConfidence: 0.5,
      includeAlternatives: false, // Disable alternatives for batch processing to reduce response size
      maxAlternatives: 0,
      enableFeatureExtraction: true,
      ...requestData.options,
    };

    const classificationResults = await intentClassificationService.batchClassifyIntent(
      requestData.texts,
      classificationOptions
    );

    // Calculate statistics
    const averageConfidence = classificationResults.reduce((sum, result) => sum + result.confidenceScore, 0) / classificationResults.length;
    const intentDistribution = classificationResults.reduce((dist, result) => {
      dist[result.intent] = (dist[result.intent] || 0) + 1;
      return dist;
    }, {} as Record<ContentIntent, number>);

    // Prepare response
    const response: BatchClassifyIntentResponse = {
      classifications: classificationResults,
      totalProcessed: classificationResults.length,
      averageConfidence,
    };

    logInfo('Batch intent classification completed successfully', {
      userId,
      totalProcessed: classificationResults.length,
      averageConfidence,
      intentDistribution,
      totalProcessingTime: classificationResults.reduce((sum, result) => sum + result.processingTime, 0),
    });

    return createSuccessResponse(response, 200);

  } catch (error) {
    logError('Batch intent classification failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: event.requestContext.requestId,
    });

    return handleLambdaError(error);
  }
};

/**
 * Lambda handler for getting intent classification statistics
 * GET /content/intent-stats
 */
export const getIntentStatsHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Intent statistics request received', {
      httpMethod: event.httpMethod,
      path: event.path,
      requestId: event.requestContext.requestId,
    });

    // Validate HTTP method
    if (event.httpMethod !== 'GET') {
      return createErrorResponse('Method not allowed', 405);
    }

    // Extract and verify JWT token
    const token = extractTokenFromEvent(event);
    if (!token) {
      return createErrorResponse('Authorization token required', 401);
    }

    let userId: string;
    try {
      const decoded = verifyJWT(token);
      userId = decoded.userId;
    } catch (error) {
      return createErrorResponse('Invalid or expired token', 401);
    }

    // Get user's content ideas with intent classifications
    const userContentIdeas = await contentIdeaService.getUserContentIdeas(userId, 100);
    
    if (userContentIdeas.length === 0) {
      return createSuccessResponse({
        totalIdeas: 0,
        intentDistribution: {},
        averageConfidence: 0,
        recentClassifications: [],
      }, 200);
    }

    // Calculate statistics
    const intentDistribution = userContentIdeas.reduce((dist, idea) => {
      if (idea.intent) {
        dist[idea.intent] = (dist[idea.intent] || 0) + 1;
      }
      return dist;
    }, {} as Record<ContentIntent, number>);

    const ideasWithConfidence = userContentIdeas.filter(idea => idea.confidenceScore > 0);
    const averageConfidence = ideasWithConfidence.length > 0 
      ? ideasWithConfidence.reduce((sum, idea) => sum + idea.confidenceScore, 0) / ideasWithConfidence.length
      : 0;

    // Get recent classifications (last 10)
    const recentClassifications = userContentIdeas
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(idea => ({
        ideaId: idea.ideaId,
        intent: idea.intent,
        confidenceScore: idea.confidenceScore,
        createdAt: idea.createdAt,
        contentPreview: idea.content.substring(0, 100) + (idea.content.length > 100 ? '...' : ''),
      }));

    const response = {
      totalIdeas: userContentIdeas.length,
      intentDistribution,
      averageConfidence,
      recentClassifications,
      statistics: {
        highConfidenceClassifications: ideasWithConfidence.filter(idea => idea.confidenceScore >= 0.8).length,
        mediumConfidenceClassifications: ideasWithConfidence.filter(idea => idea.confidenceScore >= 0.5 && idea.confidenceScore < 0.8).length,
        lowConfidenceClassifications: ideasWithConfidence.filter(idea => idea.confidenceScore < 0.5).length,
      },
    };

    logInfo('Intent statistics retrieved successfully', {
      userId,
      totalIdeas: userContentIdeas.length,
      averageConfidence,
      intentDistribution,
    });

    return createSuccessResponse(response, 200);

  } catch (error) {
    logError('Get intent statistics failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: event.requestContext.requestId,
    });

    return handleLambdaError(error);
  }
};