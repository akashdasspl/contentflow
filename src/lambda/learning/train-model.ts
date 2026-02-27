// Lambda function for training user preference models

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
    
    // Parse request body
    const requestBody = event.body ? JSON.parse(event.body) : {};
    const {
      dateRange,
      instanceType,
      maxRuntimeSeconds,
      hyperParameters,
      minSamples = 10,
    } = requestBody;

    logInfo('Training model request received', {
      userId,
      dateRange,
      instanceType,
      minSamples,
    });

    // Start model training
    const trainingResult = await learningIntegrationService.trainUserPreferenceModel(userId, {
      dateRange,
      instanceType,
      maxRuntimeSeconds,
      hyperParameters,
      minSamples,
    });

    logInfo('Model training completed', {
      userId,
      trainingJobName: trainingResult.trainingJobName,
      status: trainingResult.status,
      trainingDataSize: trainingResult.trainingDataSize,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          trainingJobName: trainingResult.trainingJobName,
          modelName: trainingResult.modelName,
          endpoint: trainingResult.endpoint,
          status: trainingResult.status,
          trainingDataSize: trainingResult.trainingDataSize,
          metrics: trainingResult.metrics,
        },
      }),
    };

  } catch (error) {
    logError('Model training failed', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = errorMessage.includes('Insufficient training data') ? 400 : 500;

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Model Training Failed',
        message: errorMessage,
      }),
    };
  }
};