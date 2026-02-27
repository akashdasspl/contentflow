import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as events from 'aws-cdk-lib/aws-events';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import { Construct } from 'constructs';

export class ContentFlowAiStack extends cdk.Stack {
  public userTable: dynamodb.Table;
  public contentIdeasTable: dynamodb.Table;
  public generatedContentTable: dynamodb.Table;
  public engagementFeedbackTable: dynamodb.Table;
  public audienceProfilesTable: dynamodb.Table;
  public contentStorageBucket: s3.Bucket;
  public analyticsBucket: s3.Bucket;
  public api: apigateway.RestApi;
  public userPool: cognito.UserPool;
  public userPoolClient: cognito.UserPoolClient;
  public lambdaExecutionRole: iam.Role;

  // Lambda functions
  public registerFunction: lambda.Function;
  public loginFunction: lambda.Function;
  public validateTokenFunction: lambda.Function;
  public refreshTokenFunction: lambda.Function;
  public resetPasswordFunction: lambda.Function;
  public getProfileFunction: lambda.Function;
  public updateProfileFunction: lambda.Function;
  public deleteProfileFunction: lambda.Function;
  public getContentHistoryFunction: lambda.Function;
  public updatePreferencesFunction: lambda.Function;

  // Content idea Lambda functions
  public submitIdeaFunction: lambda.Function;
  public getIdeasFunction: lambda.Function;
  public getIdeaFunction: lambda.Function;
  public updateIdeaFunction: lambda.Function;
  public deleteIdeaFunction: lambda.Function;
  public extractThemesFunction: lambda.Function;

  // Platform optimization Lambda functions
  public optimizeContentFunction: lambda.Function;
  public getTemplatesFunction: lambda.Function;
  public getGuidelinesFunction: lambda.Function;

  // Feedback processing Lambda functions
  public submitFeedbackFunction: lambda.Function;
  public getAnalyticsFunction: lambda.Function;
  public getInsightsFunction: lambda.Function;
  public getPatternsFunction: lambda.Function;

  // Analytics dashboard Lambda functions
  public getDashboardFunction: lambda.Function;
  public getAnalyticsSummaryFunction: lambda.Function;
  public getContentStatsFunction: lambda.Function;
  public getPerformanceMetricsFunction: lambda.Function;
  public getPlatformStatsFunction: lambda.Function;
  public getActivityFeedFunction: lambda.Function;
  public exportReportFunction: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    this.createDynamoDBTables();

    // S3 Buckets
    this.createS3Buckets();

    // Cognito User Pool
    this.createCognitoUserPool();

    // API Gateway
    this.createApiGateway();

    // SQS Queues
    this.createSQSQueues();

    // SNS Topics
    this.createSNSTopics();

    // EventBridge
    this.createEventBridge();

    // OpenSearch for Analytics
    this.createOpenSearchCluster();

    // IAM Roles and Policies
    this.createIAMRoles();

    // Lambda Functions
    this.createLambdaFunctions();

    // API Gateway Integration
    this.integrateApiGateway();

    // CloudWatch Log Groups
    this.createCloudWatchLogGroups();

    // Outputs
    this.createOutputs();
  }

  private createDynamoDBTables() {
    // Users Table
    this.userTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'contentflow-users',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
    });

    // Add GSI for email lookup
    this.userTable.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    });

    // Content Ideas Table
    this.contentIdeasTable = new dynamodb.Table(this, 'ContentIdeasTable', {
      tableName: 'contentflow-content-ideas',
      partitionKey: { name: 'ideaId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for user-based queries
    this.contentIdeasTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // Generated Content Table
    this.generatedContentTable = new dynamodb.Table(this, 'GeneratedContentTable', {
      tableName: 'contentflow-generated-content',
      partitionKey: { name: 'contentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for user and idea-based queries
    this.generatedContentTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    this.generatedContentTable.addGlobalSecondaryIndex({
      indexName: 'IdeaIdIndex',
      partitionKey: { name: 'ideaId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // Engagement Feedback Table
    this.engagementFeedbackTable = new dynamodb.Table(this, 'EngagementFeedbackTable', {
      tableName: 'contentflow-engagement-feedback',
      partitionKey: { name: 'feedbackId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for content and user-based queries
    this.engagementFeedbackTable.addGlobalSecondaryIndex({
      indexName: 'ContentIdIndex',
      partitionKey: { name: 'contentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    this.engagementFeedbackTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // Audience Profiles Table
    this.audienceProfilesTable = new dynamodb.Table(this, 'AudienceProfilesTable', {
      tableName: 'contentflow-audience-profiles',
      partitionKey: { name: 'profileId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for user-based queries
    this.audienceProfilesTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'updatedAt', type: dynamodb.AttributeType.STRING },
    });
  }

  private createS3Buckets() {
    // Content Storage Bucket
    this.contentStorageBucket = new s3.Bucket(this, 'ContentStorageBucket', {
      bucketName: `contentflow-content-storage-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // Restrict in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
    });

    // Analytics Bucket
    this.analyticsBucket = new s3.Bucket(this, 'AnalyticsBucket', {
      bucketName: `contentflow-analytics-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          id: 'ArchiveOldData',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  private createCognitoUserPool() {
    this.userPool = new cognito.UserPool(this, 'ContentFlowUserPool', {
      userPoolName: 'contentflow-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'ContentFlowUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'contentflow-web-client',
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
    });
  }

  private createApiGateway() {
    this.api = new apigateway.RestApi(this, 'ContentFlowApi', {
      restApiName: 'ContentFlow AI API',
      description: 'API for ContentFlow AI content generation platform',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Restrict in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
        ],
      },
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
    });

    // Create API resource structure
    const authResource = this.api.root.addResource('auth');
    const contentResource = this.api.root.addResource('content');
    const audienceResource = this.api.root.addResource('audience');
    const platformResource = this.api.root.addResource('platform');
    const feedbackResource = this.api.root.addResource('feedback');
    const analyticsResource = this.api.root.addResource('analytics');

    // Add nested resources
    authResource.addResource('register');
    authResource.addResource('login');
    authResource.addResource('profile');

    contentResource.addResource('generate');
    contentResource.addResource('history');
    contentResource.addResource('{id}');

    audienceResource.addResource('analyze');
    audienceResource.addResource('profile');

    platformResource.addResource('optimize');
    platformResource.addResource('templates');
    platformResource.addResource('guidelines');

    feedbackResource.addResource('submit');
    feedbackResource.addResource('analytics');
    feedbackResource.addResource('insights');

    analyticsResource.addResource('dashboard');
    analyticsResource.addResource('reports');
  }

  private createSQSQueues() {
    // Content Generation Queue
    const contentGenerationQueue = new sqs.Queue(this, 'ContentGenerationQueue', {
      queueName: 'contentflow-content-generation',
      visibilityTimeout: cdk.Duration.minutes(15),
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'ContentGenerationDLQ', {
          queueName: 'contentflow-content-generation-dlq',
        }),
        maxReceiveCount: 3,
      },
    });

    // Feedback Processing Queue
    const feedbackProcessingQueue = new sqs.Queue(this, 'FeedbackProcessingQueue', {
      queueName: 'contentflow-feedback-processing',
      visibilityTimeout: cdk.Duration.minutes(10),
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'FeedbackProcessingDLQ', {
          queueName: 'contentflow-feedback-processing-dlq',
        }),
        maxReceiveCount: 3,
      },
    });

    // Analytics Processing Queue
    const analyticsProcessingQueue = new sqs.Queue(this, 'AnalyticsProcessingQueue', {
      queueName: 'contentflow-analytics-processing',
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(7),
    });
  }

  private createSNSTopics() {
    // Content Generation Notifications
    const contentGenerationTopic = new sns.Topic(this, 'ContentGenerationTopic', {
      topicName: 'contentflow-content-generation',
      displayName: 'ContentFlow Content Generation Notifications',
    });

    // Feedback Notifications
    const feedbackTopic = new sns.Topic(this, 'FeedbackTopic', {
      topicName: 'contentflow-feedback',
      displayName: 'ContentFlow Feedback Notifications',
    });

    // System Alerts
    const systemAlertsTopic = new sns.Topic(this, 'SystemAlertsTopic', {
      topicName: 'contentflow-system-alerts',
      displayName: 'ContentFlow System Alerts',
    });
  }

  private createEventBridge() {
    // Custom Event Bus for ContentFlow events
    const contentFlowEventBus = new events.EventBus(this, 'ContentFlowEventBus', {
      eventBusName: 'contentflow-events',
    });

    // Event rules can be added here for specific event patterns
  }

  private createOpenSearchCluster() {
    // OpenSearch Serverless Collection for Analytics
    const analyticsCollection = new opensearch.CfnCollection(this, 'AnalyticsCollection', {
      name: 'contentflow-analytics',
      type: 'SEARCH',
      description: 'OpenSearch collection for ContentFlow analytics and insights',
    });

    // Security policy for the collection
    const securityPolicy = new opensearch.CfnSecurityPolicy(this, 'AnalyticsSecurityPolicy', {
      name: 'contentflow-analytics-security-policy',
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${analyticsCollection.name}`],
          },
        ],
        AWSOwnedKey: true,
      }),
    });

    analyticsCollection.addDependency(securityPolicy);
  }

  private createCloudWatchLogGroups() {
    // API Gateway Log Group
    new logs.LogGroup(this, 'ApiGatewayLogGroup', {
      logGroupName: '/aws/apigateway/contentflow-ai',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Log Groups (will be created automatically by Lambda functions)
    const lambdaLogGroups = [
      'auth-service',
      'content-generation-service',
      'audience-analysis-service',
      'platform-optimization-service',
      'feedback-processing-service',
      'analytics-service',
    ];

    lambdaLogGroups.forEach((serviceName) => {
      new logs.LogGroup(this, `${serviceName}LogGroup`, {
        logGroupName: `/aws/lambda/contentflow-${serviceName}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    });
  }

  private createIAMRoles() {
    // Lambda Execution Role with necessary permissions
    this.lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: 'contentflow-lambda-execution-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Add permissions for DynamoDB
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
          'dynamodb:BatchGetItem',
          'dynamodb:BatchWriteItem',
        ],
        resources: [
          this.userTable.tableArn,
          this.contentIdeasTable.tableArn,
          this.generatedContentTable.tableArn,
          this.engagementFeedbackTable.tableArn,
          this.audienceProfilesTable.tableArn,
          `${this.userTable.tableArn}/index/*`,
          `${this.contentIdeasTable.tableArn}/index/*`,
          `${this.generatedContentTable.tableArn}/index/*`,
          `${this.engagementFeedbackTable.tableArn}/index/*`,
          `${this.audienceProfilesTable.tableArn}/index/*`,
        ],
      })
    );

    // Add permissions for S3
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:DeleteObject',
          's3:ListBucket',
        ],
        resources: [
          this.contentStorageBucket.bucketArn,
          `${this.contentStorageBucket.bucketArn}/*`,
          this.analyticsBucket.bucketArn,
          `${this.analyticsBucket.bucketArn}/*`,
        ],
      })
    );

    // Add permissions for Bedrock
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: ['*'], // Bedrock models don't have specific ARNs
      })
    );

    // Add permissions for Comprehend
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'comprehend:DetectSentiment',
          'comprehend:DetectEntities',
          'comprehend:DetectKeyPhrases',
          'comprehend:DetectLanguage',
        ],
        resources: ['*'],
      })
    );

    // Add permissions for SQS
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:SendMessage',
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
        ],
        resources: ['arn:aws:sqs:*:*:contentflow-*'],
      })
    );

    // Add permissions for SNS
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'sns:Publish',
        ],
        resources: ['arn:aws:sns:*:*:contentflow-*'],
      })
    );

    // Add permissions for EventBridge
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'events:PutEvents',
        ],
        resources: ['arn:aws:events:*:*:event-bus/contentflow-*'],
      })
    );

    // Add permissions for Cognito
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminUpdateUserAttributes',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:AdminInitiateAuth',
          'cognito-idp:ListUsers',
        ],
        resources: [this.userPool.userPoolArn],
      })
    );

    // Add permissions for OpenSearch
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'aoss:APIAccessAll',
          'aoss:DashboardsAccessAll',
          'aoss:CreateIndex',
          'aoss:DeleteIndex',
          'aoss:UpdateIndex',
          'aoss:DescribeIndex',
          'aoss:ReadDocument',
          'aoss:WriteDocument',
          'aoss:CreateCollection',
          'aoss:DeleteCollection',
          'aoss:UpdateCollection',
          'aoss:DescribeCollection',
        ],
        resources: ['*'], // OpenSearch Serverless collections don't have specific ARNs
      })
    );
  }

  private createLambdaFunctions() {
    // Common Lambda environment variables
    const commonEnvironment = {
      AWS_REGION: this.region,
      USER_POOL_ID: this.userPool.userPoolId,
      USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
      USERS_TABLE_NAME: this.userTable.tableName,
      CONTENT_IDEAS_TABLE_NAME: this.contentIdeasTable.tableName,
      GENERATED_CONTENT_TABLE_NAME: this.generatedContentTable.tableName,
      ENGAGEMENT_FEEDBACK_TABLE_NAME: this.engagementFeedbackTable.tableName,
      AUDIENCE_PROFILES_TABLE_NAME: this.audienceProfilesTable.tableName,
      CONTENT_STORAGE_BUCKET_NAME: this.contentStorageBucket.bucketName,
      ANALYTICS_BUCKET_NAME: this.analyticsBucket.bucketName,
      JWT_SECRET: 'contentflow-jwt-secret-change-in-production', // Should be from Secrets Manager in production
    };

    // User Registration Lambda
    this.registerFunction = new lambda.Function(this, 'RegisterFunction', {
      functionName: 'contentflow-auth-register',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'register.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/auth'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'ContentFlow AI user registration function',
    });

    // User Login Lambda
    this.loginFunction = new lambda.Function(this, 'LoginFunction', {
      functionName: 'contentflow-auth-login',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'login.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/auth'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'ContentFlow AI user login function',
    });

    // Token Validation Lambda
    this.validateTokenFunction = new lambda.Function(this, 'ValidateTokenFunction', {
      functionName: 'contentflow-auth-validate-token',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'validate-token.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/auth'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      description: 'ContentFlow AI token validation function',
    });

    // Refresh Token Lambda
    this.refreshTokenFunction = new lambda.Function(this, 'RefreshTokenFunction', {
      functionName: 'contentflow-auth-refresh-token',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'refresh-token.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/auth'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
      description: 'ContentFlow AI token refresh function',
    });

    // Reset Password Lambda
    this.resetPasswordFunction = new lambda.Function(this, 'ResetPasswordFunction', {
      functionName: 'contentflow-auth-reset-password',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'reset-password.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/auth'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'ContentFlow AI password reset function',
    });

    // Get Profile Lambda
    this.getProfileFunction = new lambda.Function(this, 'GetProfileFunction', {
      functionName: 'contentflow-auth-get-profile',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-profile.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/auth'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
      description: 'ContentFlow AI get user profile function',
    });

    // Update Profile Lambda
    this.updateProfileFunction = new lambda.Function(this, 'UpdateProfileFunction', {
      functionName: 'contentflow-auth-update-profile',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'update-profile.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/auth'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'ContentFlow AI update user profile function',
    });

    // Delete Profile Lambda
    this.deleteProfileFunction = new lambda.Function(this, 'DeleteProfileFunction', {
      functionName: 'contentflow-auth-delete-profile',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'delete-profile.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/auth'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      description: 'ContentFlow AI delete user profile function',
    });

    // Get Content History Lambda
    this.getContentHistoryFunction = new lambda.Function(this, 'GetContentHistoryFunction', {
      functionName: 'contentflow-auth-get-content-history',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-content-history.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/auth'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'ContentFlow AI get user content history function',
    });

    // Update Preferences Lambda
    this.updatePreferencesFunction = new lambda.Function(this, 'UpdatePreferencesFunction', {
      functionName: 'contentflow-auth-update-preferences',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'update-preferences.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/auth'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'ContentFlow AI update user preferences function',
    });

    // Content Idea Lambda Functions
    
    // Submit Content Idea Lambda
    this.submitIdeaFunction = new lambda.Function(this, 'SubmitIdeaFunction', {
      functionName: 'contentflow-content-submit-idea',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'submit-idea.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/content'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'ContentFlow AI submit content idea function',
    });

    // Get Content Ideas Lambda
    this.getIdeasFunction = new lambda.Function(this, 'GetIdeasFunction', {
      functionName: 'contentflow-content-get-ideas',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-ideas.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/content'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'ContentFlow AI get content ideas function',
    });

    // Get Content Idea Lambda
    this.getIdeaFunction = new lambda.Function(this, 'GetIdeaFunction', {
      functionName: 'contentflow-content-get-idea',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-idea.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/content'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
      description: 'ContentFlow AI get specific content idea function',
    });

    // Update Content Idea Lambda
    this.updateIdeaFunction = new lambda.Function(this, 'UpdateIdeaFunction', {
      functionName: 'contentflow-content-update-idea',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'update-idea.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/content'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'ContentFlow AI update content idea function',
    });

    // Delete Content Idea Lambda
    this.deleteIdeaFunction = new lambda.Function(this, 'DeleteIdeaFunction', {
      functionName: 'contentflow-content-delete-idea',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'delete-idea.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/content'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
      description: 'ContentFlow AI delete content idea function',
    });

    // Extract Themes Lambda
    this.extractThemesFunction = new lambda.Function(this, 'ExtractThemesFunction', {
      functionName: 'contentflow-content-extract-themes',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'extract-themes.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/content'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30), // Allow up to 30 seconds for theme extraction
      memorySize: 512, // Higher memory for Comprehend processing
      description: 'ContentFlow AI theme and topic extraction function',
    });

    // Platform Optimization Lambda Functions
    this.optimizeContentFunction = new lambda.Function(this, 'OptimizeContentFunction', {
      functionName: 'contentflow-platform-optimize-content',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'optimize-content.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/platform'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(60), // Allow up to 60 seconds for optimization
      memorySize: 1024, // Higher memory for AI processing
      description: 'ContentFlow AI platform-specific content optimization function',
    });

    this.getTemplatesFunction = new lambda.Function(this, 'GetTemplatesFunction', {
      functionName: 'contentflow-platform-get-templates',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-templates.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/platform'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      description: 'ContentFlow AI platform templates retrieval function',
    });

    this.getGuidelinesFunction = new lambda.Function(this, 'GetGuidelinesFunction', {
      functionName: 'contentflow-platform-get-guidelines',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-guidelines.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/platform'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      description: 'ContentFlow AI platform guidelines retrieval function',
    });

    // Feedback Processing Lambda Functions
    this.submitFeedbackFunction = new lambda.Function(this, 'SubmitFeedbackFunction', {
      functionName: 'contentflow-feedback-submit-feedback',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'submit-feedback.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/feedback'),
      role: this.lambdaExecutionRole,
      environment: {
        ...commonEnvironment,
        OPENSEARCH_ENDPOINT: process.env.OPENSEARCH_ENDPOINT || '',
        OPENSEARCH_USERNAME: process.env.OPENSEARCH_USERNAME || 'admin',
        OPENSEARCH_PASSWORD: process.env.OPENSEARCH_PASSWORD || 'admin',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512, // Higher memory for OpenSearch operations
      description: 'ContentFlow AI feedback submission function',
    });

    this.getAnalyticsFunction = new lambda.Function(this, 'GetAnalyticsFunction', {
      functionName: 'contentflow-feedback-get-analytics',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-analytics.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/feedback'),
      role: this.lambdaExecutionRole,
      environment: {
        ...commonEnvironment,
        OPENSEARCH_ENDPOINT: process.env.OPENSEARCH_ENDPOINT || '',
        OPENSEARCH_USERNAME: process.env.OPENSEARCH_USERNAME || 'admin',
        OPENSEARCH_PASSWORD: process.env.OPENSEARCH_PASSWORD || 'admin',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      description: 'ContentFlow AI feedback analytics function',
    });

    this.getInsightsFunction = new lambda.Function(this, 'GetInsightsFunction', {
      functionName: 'contentflow-feedback-get-insights',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-insights.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/feedback'),
      role: this.lambdaExecutionRole,
      environment: {
        ...commonEnvironment,
        OPENSEARCH_ENDPOINT: process.env.OPENSEARCH_ENDPOINT || '',
        OPENSEARCH_USERNAME: process.env.OPENSEARCH_USERNAME || 'admin',
        OPENSEARCH_PASSWORD: process.env.OPENSEARCH_PASSWORD || 'admin',
      },
      timeout: cdk.Duration.seconds(60), // Higher timeout for complex analytics
      memorySize: 1024, // Higher memory for analytics processing
      description: 'ContentFlow AI feedback insights function',
    });

    // Analytics Dashboard Lambda Functions
    this.getDashboardFunction = new lambda.Function(this, 'GetDashboardFunction', {
      functionName: 'contentflow-analytics-get-dashboard',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-dashboard.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/analytics'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(60), // Higher timeout for comprehensive analytics
      memorySize: 1024, // Higher memory for analytics processing
      description: 'ContentFlow AI analytics dashboard function',
    });

    this.getAnalyticsSummaryFunction = new lambda.Function(this, 'GetAnalyticsSummaryFunction', {
      functionName: 'contentflow-analytics-get-summary',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-summary.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/analytics'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      description: 'ContentFlow AI analytics summary function',
    });

    this.getContentStatsFunction = new lambda.Function(this, 'GetContentStatsFunction', {
      functionName: 'contentflow-analytics-get-content-stats',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-content-stats.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/analytics'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      description: 'ContentFlow AI content statistics function',
    });

    this.getPerformanceMetricsFunction = new lambda.Function(this, 'GetPerformanceMetricsFunction', {
      functionName: 'contentflow-analytics-get-performance-metrics',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-performance-metrics.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/analytics'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      description: 'ContentFlow AI performance metrics function',
    });

    this.getPlatformStatsFunction = new lambda.Function(this, 'GetPlatformStatsFunction', {
      functionName: 'contentflow-analytics-get-platform-stats',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-platform-stats.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/analytics'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      description: 'ContentFlow AI platform statistics function',
    });

    this.getActivityFeedFunction = new lambda.Function(this, 'GetActivityFeedFunction', {
      functionName: 'contentflow-analytics-get-activity-feed',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-activity-feed.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/analytics'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'ContentFlow AI activity feed function',
    });

    this.exportReportFunction = new lambda.Function(this, 'ExportReportFunction', {
      functionName: 'contentflow-analytics-export-report',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'export-report.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/analytics'),
      role: this.lambdaExecutionRole,
      environment: commonEnvironment,
      timeout: cdk.Duration.minutes(5), // Higher timeout for report generation and S3 upload
      memorySize: 1024, // Higher memory for report processing
      description: 'ContentFlow AI analytics report export function',
    });
  }

  private integrateApiGateway() {
    // Get auth resource that was created in createApiGateway
    const authResource = this.api.root.getResource('auth');
    if (!authResource) {
      throw new Error('Auth resource not found in API Gateway');
    }

    // Register endpoint
    const registerResource = authResource.getResource('register');
    if (registerResource) {
      registerResource.addMethod('POST', new apigateway.LambdaIntegration(this.registerFunction), {
        methodResponses: [
          {
            statusCode: '201',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '409',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });
    }

    // Login endpoint
    const loginResource = authResource.getResource('login');
    if (loginResource) {
      loginResource.addMethod('POST', new apigateway.LambdaIntegration(this.loginFunction), {
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '429',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });
    }

    // Add additional auth endpoints
    authResource.addResource('validate').addMethod('POST', 
      new apigateway.LambdaIntegration(this.validateTokenFunction)
    );

    authResource.addResource('refresh').addMethod('POST', 
      new apigateway.LambdaIntegration(this.refreshTokenFunction)
    );

    authResource.addResource('reset-password').addMethod('POST', 
      new apigateway.LambdaIntegration(this.resetPasswordFunction)
    );

    // Profile management endpoints
    const profileResource = authResource.getResource('profile');
    if (profileResource) {
      // GET /auth/profile - Get user profile
      profileResource.addMethod('GET', new apigateway.LambdaIntegration(this.getProfileFunction), {
        authorizationType: apigateway.AuthorizationType.NONE, // JWT validation handled in Lambda
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '404',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });

      // PUT /auth/profile - Update user profile
      profileResource.addMethod('PUT', new apigateway.LambdaIntegration(this.updateProfileFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });

      // DELETE /auth/profile - Delete user profile
      profileResource.addMethod('DELETE', new apigateway.LambdaIntegration(this.deleteProfileFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '404',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });

      // Add nested resources for profile management
      const historyResource = profileResource.addResource('history');
      historyResource.addMethod('GET', new apigateway.LambdaIntegration(this.getContentHistoryFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        requestParameters: {
          'method.request.querystring.limit': false,
          'method.request.querystring.platform': false,
          'method.request.querystring.contentType': false,
          'method.request.querystring.dateFrom': false,
          'method.request.querystring.dateTo': false,
        },
      });

      const preferencesResource = profileResource.addResource('preferences');
      preferencesResource.addMethod('PUT', new apigateway.LambdaIntegration(this.updatePreferencesFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
      });
    }

    // Content idea endpoints
    const contentResource = this.api.root.getResource('content');
    if (contentResource) {
      // POST /content/ideas - Submit new content idea
      const ideasResource = contentResource.addResource('ideas');
      ideasResource.addMethod('POST', new apigateway.LambdaIntegration(this.submitIdeaFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        methodResponses: [
          {
            statusCode: '201',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });

      // GET /content/ideas - Get user's content ideas
      ideasResource.addMethod('GET', new apigateway.LambdaIntegration(this.getIdeasFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        requestParameters: {
          'method.request.querystring.limit': false,
        },
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });

      // Individual content idea endpoints
      const ideaResource = ideasResource.addResource('{ideaId}');
      
      // GET /content/ideas/{ideaId} - Get specific content idea
      ideaResource.addMethod('GET', new apigateway.LambdaIntegration(this.getIdeaFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        requestParameters: {
          'method.request.path.ideaId': true,
        },
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '404',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });

      // PUT /content/ideas/{ideaId} - Update content idea
      ideaResource.addMethod('PUT', new apigateway.LambdaIntegration(this.updateIdeaFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        requestParameters: {
          'method.request.path.ideaId': true,
        },
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '404',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });

      // DELETE /content/ideas/{ideaId} - Delete content idea
      ideaResource.addMethod('DELETE', new apigateway.LambdaIntegration(this.deleteIdeaFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        requestParameters: {
          'method.request.path.ideaId': true,
        },
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '404',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });

      // POST /content/extract-themes - Extract themes and topics
      const extractThemesResource = contentResource.addResource('extract-themes');
      extractThemesResource.addMethod('POST', new apigateway.LambdaIntegration(this.extractThemesFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '404',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });
    }

    // Platform Optimization API Integration
    const platformResource = this.api.root.getResource('platform');
    if (platformResource) {
      // POST /platform/optimize - Optimize content for platform
      const optimizeResource = platformResource.getResource('optimize');
      if (optimizeResource) {
        optimizeResource.addMethod('POST', new apigateway.LambdaIntegration(this.optimizeContentFunction), {
          authorizationType: apigateway.AuthorizationType.NONE,
          methodResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
                'method.response.header.Access-Control-Allow-Headers': true,
                'method.response.header.Access-Control-Allow-Methods': true,
              },
            },
            {
              statusCode: '400',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '401',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '403',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '404',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '500',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
          ],
        });
      }

      // GET /platform/templates - Get platform templates
      const templatesResource = platformResource.getResource('templates');
      if (templatesResource) {
        templatesResource.addMethod('GET', new apigateway.LambdaIntegration(this.getTemplatesFunction), {
          authorizationType: apigateway.AuthorizationType.NONE,
          requestParameters: {
            'method.request.querystring.platform': false,
            'method.request.querystring.templateId': false,
          },
          methodResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
                'method.response.header.Access-Control-Allow-Headers': true,
                'method.response.header.Access-Control-Allow-Methods': true,
              },
            },
            {
              statusCode: '400',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '401',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '404',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '500',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
          ],
        });
      }

      // GET /platform/guidelines/{platform} - Get platform guidelines
      const guidelinesResource = platformResource.getResource('guidelines');
      if (guidelinesResource) {
        const platformGuidelineResource = guidelinesResource.addResource('{platform}');
        platformGuidelineResource.addMethod('GET', new apigateway.LambdaIntegration(this.getGuidelinesFunction), {
          authorizationType: apigateway.AuthorizationType.NONE,
          requestParameters: {
            'method.request.path.platform': true,
          },
          methodResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
                'method.response.header.Access-Control-Allow-Headers': true,
                'method.response.header.Access-Control-Allow-Methods': true,
              },
            },
            {
              statusCode: '400',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '401',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '404',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '500',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
          ],
        });
      }
    }

    // Feedback API Integration
    const feedbackResource = this.api.root.getResource('feedback');
    if (feedbackResource) {
      // POST /feedback/submit - Submit engagement feedback
      const submitResource = feedbackResource.getResource('submit');
      if (submitResource) {
        submitResource.addMethod('POST', new apigateway.LambdaIntegration(this.submitFeedbackFunction), {
          authorizationType: apigateway.AuthorizationType.NONE,
          methodResponses: [
            {
              statusCode: '201',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
                'method.response.header.Access-Control-Allow-Headers': true,
                'method.response.header.Access-Control-Allow-Methods': true,
              },
            },
            {
              statusCode: '400',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '401',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '403',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '404',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '500',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
          ],
        });
      }

      // GET /feedback/analytics - Get user analytics
      const analyticsResource = feedbackResource.getResource('analytics');
      if (analyticsResource) {
        analyticsResource.addMethod('GET', new apigateway.LambdaIntegration(this.getAnalyticsFunction), {
          authorizationType: apigateway.AuthorizationType.NONE,
          requestParameters: {
            'method.request.querystring.limit': false,
            'method.request.querystring.platform': false,
            'method.request.querystring.contentType': false,
            'method.request.querystring.dateFrom': false,
            'method.request.querystring.dateTo': false,
          },
          methodResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
                'method.response.header.Access-Control-Allow-Headers': true,
                'method.response.header.Access-Control-Allow-Methods': true,
              },
            },
            {
              statusCode: '400',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '401',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '500',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
          ],
        });
      }

      // GET /feedback/insights - Get user insights and recommendations
      const insightsResource = feedbackResource.getResource('insights');
      if (insightsResource) {
        insightsResource.addMethod('GET', new apigateway.LambdaIntegration(this.getInsightsFunction), {
          authorizationType: apigateway.AuthorizationType.NONE,
          requestParameters: {
            'method.request.querystring.platform': false,
            'method.request.querystring.dateFrom': false,
            'method.request.querystring.dateTo': false,
            'method.request.querystring.timeInterval': false,
            'method.request.querystring.type': false,
          },
          methodResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
                'method.response.header.Access-Control-Allow-Headers': true,
                'method.response.header.Access-Control-Allow-Methods': true,
              },
            },
            {
              statusCode: '400',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '401',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '500',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
          ],
        });
      }
    }

    // Analytics Dashboard API Integration
    const analyticsResource = this.api.root.getResource('analytics');
    if (analyticsResource) {
      // GET /analytics/dashboard - Get comprehensive dashboard data
      const dashboardResource = analyticsResource.getResource('dashboard');
      if (dashboardResource) {
        dashboardResource.addMethod('GET', new apigateway.LambdaIntegration(this.getDashboardFunction), {
          authorizationType: apigateway.AuthorizationType.NONE,
          requestParameters: {
            'method.request.querystring.startDate': false,
            'method.request.querystring.endDate': false,
          },
          methodResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
                'method.response.header.Access-Control-Allow-Headers': true,
                'method.response.header.Access-Control-Allow-Methods': true,
              },
            },
            {
              statusCode: '400',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '401',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '500',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
          ],
        });
      }

      // GET /analytics/summary - Get analytics summary for a period
      const summaryResource = analyticsResource.addResource('summary');
      summaryResource.addMethod('GET', new apigateway.LambdaIntegration(this.getAnalyticsSummaryFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        requestParameters: {
          'method.request.querystring.period': false,
        },
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });

      // GET /analytics/content-stats - Get content generation statistics
      const contentStatsResource = analyticsResource.addResource('content-stats');
      contentStatsResource.addMethod('GET', new apigateway.LambdaIntegration(this.getContentStatsFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        requestParameters: {
          'method.request.querystring.startDate': false,
          'method.request.querystring.endDate': false,
        },
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });

      // GET /analytics/performance - Get performance metrics
      const performanceResource = analyticsResource.addResource('performance');
      performanceResource.addMethod('GET', new apigateway.LambdaIntegration(this.getPerformanceMetricsFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        requestParameters: {
          'method.request.querystring.startDate': false,
          'method.request.querystring.endDate': false,
        },
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });

      // GET /analytics/platforms - Get platform statistics
      const platformsResource = analyticsResource.addResource('platforms');
      platformsResource.addMethod('GET', new apigateway.LambdaIntegration(this.getPlatformStatsFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        requestParameters: {
          'method.request.querystring.startDate': false,
          'method.request.querystring.endDate': false,
          'method.request.querystring.platform': false,
        },
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });

      // GET /analytics/activity - Get recent activity feed
      const activityResource = analyticsResource.addResource('activity');
      activityResource.addMethod('GET', new apigateway.LambdaIntegration(this.getActivityFeedFunction), {
        authorizationType: apigateway.AuthorizationType.NONE,
        requestParameters: {
          'method.request.querystring.limit': false,
          'method.request.querystring.type': false,
        },
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      });

      // POST /analytics/export - Export analytics report
      const reportsResource = analyticsResource.getResource('reports');
      if (reportsResource) {
        reportsResource.addMethod('POST', new apigateway.LambdaIntegration(this.exportReportFunction), {
          authorizationType: apigateway.AuthorizationType.NONE,
          methodResponses: [
            {
              statusCode: '200',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
                'method.response.header.Access-Control-Allow-Headers': true,
                'method.response.header.Access-Control-Allow-Methods': true,
              },
            },
            {
              statusCode: '400',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '401',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
            {
              statusCode: '500',
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
              },
            },
          ],
        });
      }
    }
  }

  private createOutputs() {
    // API Gateway URL
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url,
      description: 'ContentFlow AI API Gateway URL',
      exportName: 'ContentFlowApiUrl',
    });

    // User Pool ID
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'ContentFlowUserPoolId',
    });

    // User Pool Client ID
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'ContentFlowUserPoolClientId',
    });

    // DynamoDB Table Names
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.userTable.tableName,
      description: 'Users DynamoDB Table Name',
      exportName: 'ContentFlowUsersTableName',
    });

    new cdk.CfnOutput(this, 'ContentIdeasTableName', {
      value: this.contentIdeasTable.tableName,
      description: 'Content Ideas DynamoDB Table Name',
      exportName: 'ContentFlowContentIdeasTableName',
    });

    new cdk.CfnOutput(this, 'GeneratedContentTableName', {
      value: this.generatedContentTable.tableName,
      description: 'Generated Content DynamoDB Table Name',
      exportName: 'ContentFlowGeneratedContentTableName',
    });

    // S3 Bucket Names
    new cdk.CfnOutput(this, 'ContentStorageBucketName', {
      value: this.contentStorageBucket.bucketName,
      description: 'Content Storage S3 Bucket Name',
      exportName: 'ContentFlowContentStorageBucketName',
    });

    new cdk.CfnOutput(this, 'AnalyticsBucketName', {
      value: this.analyticsBucket.bucketName,
      description: 'Analytics S3 Bucket Name',
      exportName: 'ContentFlowAnalyticsBucketName',
    });
  }
}