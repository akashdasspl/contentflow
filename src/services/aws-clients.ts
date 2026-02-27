// AWS service clients for ContentFlow AI

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { ComprehendClient } from '@aws-sdk/client-comprehend';
import { SageMakerClient } from '@aws-sdk/client-sagemaker';
import { SageMakerRuntimeClient } from '@aws-sdk/client-sagemaker-runtime';
import { getEnvVar } from '../utils';

// AWS Region
const AWS_REGION = getEnvVar('AWS_REGION', 'us-east-1');

// DynamoDB Client
const dynamoDBClient = new DynamoDBClient({
  region: AWS_REGION,
});

export const dynamoDBDocClient = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// S3 Client
export const s3Client = new S3Client({
  region: AWS_REGION,
});

// Bedrock Runtime Client
export const bedrockClient = new BedrockRuntimeClient({
  region: AWS_REGION,
});

// Comprehend Client
export const comprehendClient = new ComprehendClient({
  region: AWS_REGION,
});

// SageMaker Client
export const sageMakerClient = new SageMakerClient({
  region: AWS_REGION,
});

// SageMaker Runtime Client
export const sageMakerRuntimeClient = new SageMakerRuntimeClient({
  region: AWS_REGION,
});

// Client configuration helpers
export const getClientConfig = () => ({
  region: AWS_REGION,
  maxAttempts: 3,
  retryMode: 'adaptive' as const,
});

// Health check function for all clients
export const healthCheck = async (): Promise<Record<string, boolean>> => {
  const results: Record<string, boolean> = {};

  try {
    // Test DynamoDB
    await dynamoDBClient.send({ input: {} } as any);
    results.dynamodb = true;
  } catch {
    results.dynamodb = false;
  }

  try {
    // Test S3
    await s3Client.send({ input: {} } as any);
    results.s3 = true;
  } catch {
    results.s3 = false;
  }

  try {
    // Test Bedrock
    await bedrockClient.send({ input: {} } as any);
    results.bedrock = true;
  } catch {
    results.bedrock = false;
  }

  try {
    // Test Comprehend
    await comprehendClient.send({ input: {} } as any);
    results.comprehend = true;
  } catch {
    results.comprehend = false;
  }

  return results;
};