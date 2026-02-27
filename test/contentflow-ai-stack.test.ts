import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ContentFlowAiStack } from '../lib/contentflow-ai-stack';

describe('ContentFlowAiStack', () => {
  let app: cdk.App;
  let stack: ContentFlowAiStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new ContentFlowAiStack(app, 'TestContentFlowAiStack');
    template = Template.fromStack(stack);
  });

  test('creates DynamoDB tables with correct configuration', () => {
    // Test Users table
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'contentflow-users',
      BillingMode: 'PAY_PER_REQUEST',
      SSESpecification: {
        SSEEnabled: true,
      },
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true,
      },
    });

    // Test Content Ideas table
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'contentflow-content-ideas',
      BillingMode: 'PAY_PER_REQUEST',
    });

    // Test Generated Content table
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'contentflow-generated-content',
      BillingMode: 'PAY_PER_REQUEST',
    });

    // Test Engagement Feedback table
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'contentflow-engagement-feedback',
      BillingMode: 'PAY_PER_REQUEST',
    });

    // Test Audience Profiles table
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'contentflow-audience-profiles',
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  test('creates S3 buckets with proper configuration', () => {
    // Test Content Storage bucket
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
          },
        ],
      },
      VersioningConfiguration: {
        Status: 'Enabled',
      },
    });

    // Verify CORS configuration exists
    template.hasResourceProperties('AWS::S3::Bucket', {
      CorsConfiguration: {
        CorsRules: [
          {
            AllowedMethods: ['GET', 'PUT', 'POST'],
            AllowedOrigins: ['*'],
            AllowedHeaders: ['*'],
            MaxAge: 3000,
          },
        ],
      },
    });
  });

  test('creates API Gateway with CORS configuration', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'ContentFlow AI API',
      Description: 'API for ContentFlow AI content generation platform',
    });

    // Test stage configuration with throttling
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'prod',
      ThrottleSettings: {
        RateLimit: 1000,
        BurstLimit: 2000,
      },
    });
  });

  test('creates Cognito User Pool with proper configuration', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'contentflow-users',
      AutoVerifiedAttributes: ['email'],
      UsernameAttributes: ['email'],
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: true,
          RequireUppercase: true,
        },
      },
    });

    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      UserPoolId: {
        Ref: expect.any(String),
      },
      GenerateSecret: false,
      ExplicitAuthFlows: expect.arrayContaining(['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_USER_SRP_AUTH']),
    });
  });

  test('creates SQS queues with dead letter queues', () => {
    // Test content generation queue
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'contentflow-content-generation',
      VisibilityTimeout: 900, // 15 minutes
    });

    // Test feedback processing queue
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'contentflow-feedback-processing',
      VisibilityTimeout: 600, // 10 minutes
    });

    // Test analytics processing queue
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'contentflow-analytics-processing',
      VisibilityTimeoutSeconds: 300, // 5 minutes
    });

    // Test dead letter queues exist
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'contentflow-content-generation-dlq',
    });

    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'contentflow-feedback-processing-dlq',
    });
  });

  test('creates SNS topics for notifications', () => {
    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'contentflow-content-generation',
      DisplayName: 'ContentFlow Content Generation Notifications',
    });

    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'contentflow-feedback',
      DisplayName: 'ContentFlow Feedback Notifications',
    });

    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'contentflow-system-alerts',
      DisplayName: 'ContentFlow System Alerts',
    });
  });

  test('creates EventBridge custom event bus', () => {
    template.hasResourceProperties('AWS::Events::EventBus', {
      Name: 'contentflow-events',
    });
  });

  test('creates OpenSearch Serverless collection', () => {
    template.hasResourceProperties('AWS::OpenSearchServerless::Collection', {
      Name: 'contentflow-analytics',
      Type: 'SEARCH',
      Description: 'OpenSearch collection for ContentFlow analytics and insights',
    });

    template.hasResourceProperties('AWS::OpenSearchServerless::SecurityPolicy', {
      Name: 'contentflow-analytics-security-policy',
      Type: 'encryption',
    });
  });

  test('creates CloudWatch log groups', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/apigateway/contentflow-ai',
      RetentionInDays: 30,
    });

    // Test Lambda log groups
    const lambdaServices = [
      'auth-service',
      'content-generation-service',
      'audience-analysis-service',
      'platform-optimization-service',
      'feedback-processing-service',
      'analytics-service',
    ];

    lambdaServices.forEach(service => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/contentflow-${service}`,
        RetentionInDays: 30,
      });
    });
  });

  test('creates IAM role with necessary permissions', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'contentflow-lambda-execution-role',
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      },
    });

    // Test that IAM policies exist
    template.resourceCountIs('AWS::IAM::Policy', 1);
    template.resourceCountIs('AWS::IAM::Role', 1);
  });

  test('creates stack outputs', () => {
    template.hasOutput('ApiGatewayUrl', {
      Description: 'ContentFlow AI API Gateway URL',
      Export: {
        Name: 'ContentFlowApiUrl',
      },
    });

    template.hasOutput('UserPoolId', {
      Description: 'Cognito User Pool ID',
      Export: {
        Name: 'ContentFlowUserPoolId',
      },
    });

    template.hasOutput('UserPoolClientId', {
      Description: 'Cognito User Pool Client ID',
      Export: {
        Name: 'ContentFlowUserPoolClientId',
      },
    });
  });

  test('has correct number of resources', () => {
    // Verify we have the expected number of main resource types
    const resources = template.toJSON().Resources;
    const resourceTypes = Object.values(resources).map((resource: any) => resource.Type);

    // Count key resource types
    const dynamoTables = resourceTypes.filter(type => type === 'AWS::DynamoDB::Table').length;
    const s3Buckets = resourceTypes.filter(type => type === 'AWS::S3::Bucket').length;
    const sqsQueues = resourceTypes.filter(type => type === 'AWS::SQS::Queue').length;
    const snsTopics = resourceTypes.filter(type => type === 'AWS::SNS::Topic').length;

    expect(dynamoTables).toBe(5); // 5 main tables
    expect(s3Buckets).toBe(2); // 2 buckets
    expect(sqsQueues).toBeGreaterThanOrEqual(5); // At least 5 queues (including DLQs)
    expect(snsTopics).toBe(3); // 3 topics
  });
});